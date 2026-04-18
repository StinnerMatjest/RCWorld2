import type {
  CategoryDifficulty,
  CategoryKind,
  ResolvedConnectionsCategory,
} from "./categories"
import type { ConnectionsCoaster } from "./utils"

export type CandidateGroup = {
  categoryId: string
  label: string
  difficulty: CategoryDifficulty
  kind: CategoryKind
  adminOnly: boolean
  coasters: ConnectionsCoaster[]
}

export type GeneratedBoard = {
  groups: CandidateGroup[]
  score: number // higher = better
  seed: string
  isStandardValid: boolean
}

function seededRandom(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return function () {
    h += h << 13
    h ^= h >> 7
    h += h << 3
    h ^= h >> 17
    h += h << 5
    return (h >>> 0) / 4294967296
  }
}

function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const rand = seededRandom(seed)
  const result = [...array]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function hasDuplicateNames(coasters: ConnectionsCoaster[]): boolean {
  const names = coasters.map((c) => c.name.trim().toLowerCase())
  return new Set(names).size !== names.length
}

function groupsOverlap(a: CandidateGroup, b: CandidateGroup): boolean {
  const aIds = new Set(a.coasters.map((c) => c.id))
  return b.coasters.some((c) => aIds.has(c.id))
}

function groupKey(coasters: ConnectionsCoaster[]): string {
  return coasters
    .map((c) => c.id)
    .sort((a, b) => a - b)
    .join("-")
}

function candidateSignature(group: CandidateGroup): string {
  return `${group.categoryId}:${groupKey(group.coasters)}`
}

function normalizedValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim().toLowerCase()
  return str.length > 0 ? str : null
}

function getIntendedGroupKeys(groups: CandidateGroup[]): Set<string> {
  return new Set(groups.map((g) => groupKey(g.coasters)))
}

function combinationCount(n: number, r: number): number {
  if (r > n || r < 0) return 0
  if (r === 0 || r === n) return 1

  let result = 1
  for (let i = 1; i <= r; i++) {
    result = (result * (n - r + i)) / i
  }
  return Math.round(result)
}

function buildCandidateGroupsForCategory(
  category: ResolvedConnectionsCategory,
  seed: string,
  maxGroupsPerCategory = 20
): CandidateGroup[] {
  const validMatches = category.matches

  if (validMatches.length < 4) return []

  const shuffled = shuffleWithSeed(validMatches, `${seed}-${category.id}`)
  const candidates: CandidateGroup[] = []
  const seen = new Set<string>()

  // sliding window + offset variation (fast + diverse)
  for (let offset = 0; offset < 3; offset++) {
    for (let i = 0; i < shuffled.length - 3; i++) {
      const pack = [
        shuffled[i],
        shuffled[(i + 1 + offset) % shuffled.length],
        shuffled[(i + 2 + offset) % shuffled.length],
        shuffled[(i + 3 + offset) % shuffled.length],
      ]

      if (new Set(pack.map((c) => c.id)).size < 4) continue
      if (hasDuplicateNames(pack)) continue

      const key = groupKey(pack)
      if (seen.has(key)) continue
      seen.add(key)

      candidates.push({
        categoryId: category.id,
        label: category.label,
        difficulty: category.difficulty,
        kind: category.kind,
        adminOnly: category.adminOnly,
        coasters: pack,
      })

      if (candidates.length >= maxGroupsPerCategory) return candidates
    }
  }

  return candidates
}

export function buildCandidateGroups(
  categories: ResolvedConnectionsCategory[],
  seed: string
): CandidateGroup[] {
  return categories.flatMap((category) =>
    buildCandidateGroupsForCategory(category, seed)
  )
}

/**
 * True if the board contains any other valid candidate group
 * besides the four chosen ones.
 *
 * This is the core safeguard against:
 * - hidden alternative solutions
 * - 5-item category bleed like the Kondaa / 8.0+ issue
 * - country/manufacturer/etc. groups that the player could fairly spot
 *
 * Because candidate generation is now far more complete, this check is much stronger.
 */
function hasExtraBoardGroup(
  chosenGroups: CandidateGroup[],
  allCandidates: CandidateGroup[]
): boolean {
  const boardIds = new Set(
    chosenGroups.flatMap((g) => g.coasters.map((c) => c.id))
  )

  const chosenKeys = new Set(chosenGroups.map(candidateSignature))

  for (const candidate of allCandidates) {
    let matchCount = 0

    for (const c of candidate.coasters) {
      if (boardIds.has(c.id)) matchCount++
      if (matchCount === 4) break
    }

    if (matchCount === 4) {
      if (!chosenKeys.has(candidateSignature(candidate))) {
        return true
      }
    }
  }

  return false
}

function getBoardPenalty(groups: CandidateGroup[]): number {
  const board = groups.flatMap((g) => g.coasters)
  const intendedKeys = getIntendedGroupKeys(groups)

  const attributes = [
    { fn: (c: ConnectionsCoaster) => c.manufacturer, weight: 140 },
    { fn: (c: ConnectionsCoaster) => c.parkName, weight: 140 },
    { fn: (c: ConnectionsCoaster) => c.country, weight: 120 },
    { fn: (c: ConnectionsCoaster) => c.trackType, weight: 120 },
    { fn: (c: ConnectionsCoaster) => c.classification, weight: 120 },
  ] as const

  let penalty = 0

  for (const attr of attributes) {
    const map = new Map<string, ConnectionsCoaster[]>()

    for (const coaster of board) {
      const value = normalizedValue(attr.fn(coaster))
      if (!value) continue

      const existing = map.get(value) ?? []
      existing.push(coaster)
      map.set(value, existing)
    }

    for (const [, coasters] of map) {
      if (coasters.length < 4) continue

      const attrGroupKey = groupKey(coasters)

      // Ignore intended exact groups
      if (intendedKeys.has(attrGroupKey)) continue

      // Soft penalty for broad thematic overlap.
      // The hard validity filter is handled by hasExtraBoardGroup().
      penalty += attr.weight * 2
    }
  }

  return penalty
}

function getBoardScore(groups: CandidateGroup[]): number {
  const penalty = getBoardPenalty(groups)
  return Math.max(0, 1000 - Math.round(penalty))
}

function isStandardBoard(groups: CandidateGroup[]): boolean {
  return groups.every((group) => !group.adminOnly)
}

/**
 * Build a more category-diverse pool for each attempt.
 * This helps a lot once validity checks become stricter.
 */
function buildAttemptPool(
  candidates: CandidateGroup[],
  seed: string,
  maxPoolSize = 40
): CandidateGroup[] {
  const shuffled = shuffleWithSeed(candidates, seed)

  const byCategory = new Map<string, CandidateGroup[]>()
  for (const candidate of shuffled) {
    const arr = byCategory.get(candidate.categoryId) ?? []
    arr.push(candidate)
    byCategory.set(candidate.categoryId, arr)
  }

  const buckets = Array.from(byCategory.values())
  const pool: CandidateGroup[] = []

  let addedInRound = true
  while (pool.length < maxPoolSize && addedInRound) {
    addedInRound = false

    for (const bucket of buckets) {
      const next = bucket.shift()
      if (!next) continue

      pool.push(next)
      addedInRound = true

      if (pool.length >= maxPoolSize) break
    }
  }

  return pool
}

function findBestBoard(
  pool: CandidateGroup[],
  allCandidates: CandidateGroup[]
): CandidateGroup[] {
  let best: CandidateGroup[] = []
  let bestScore = -1

  const max = pool.length

  for (let a = 0; a < max; a++) {
    for (let b = a + 1; b < max; b++) {
      for (let c = b + 1; c < max; c++) {
        for (let d = c + 1; d < max; d++) {
          const combo = [pool[a], pool[b], pool[c], pool[d]]

          // Never allow the same category twice
          if (new Set(combo.map((g) => g.categoryId)).size !== 4) continue

          // Difficulty balance: max 2 of any one difficulty
          const counts: Record<string, number> = {}
          for (const g of combo) {
            counts[g.difficulty] = (counts[g.difficulty] || 0) + 1
          }
          if (Object.values(counts).some((count) => count > 2)) continue

          // Kind diversity: require at least 3 unique kinds
          const uniqueKinds = new Set(combo.map((g) => g.kind))
          if (uniqueKinds.size < 3) continue

          // No overlap in coaster IDs
          if (
            groupsOverlap(combo[0], combo[1]) ||
            groupsOverlap(combo[0], combo[2]) ||
            groupsOverlap(combo[0], combo[3]) ||
            groupsOverlap(combo[1], combo[2]) ||
            groupsOverlap(combo[1], combo[3]) ||
            groupsOverlap(combo[2], combo[3])
          ) {
            continue
          }

          // Hard reject if the board contains any extra valid group
          if (hasExtraBoardGroup(combo, allCandidates)) continue

          const score = getBoardScore(combo)

          if (score > bestScore) {
            bestScore = score
            best = combo

            if (score >= 950) return best
          }
        }
      }
    }
  }

  return best
}

export function buildDailyPuzzleGroups(
  categories: ResolvedConnectionsCategory[],
  seed: string
): {
  best: CandidateGroup[]
  bestStandard: CandidateGroup[]
  boards: GeneratedBoard[]
} {
  const candidates = buildCandidateGroups(categories, seed)

  let best: CandidateGroup[] = []
  let bestScore = -1

  let bestStandard: CandidateGroup[] = []
  let bestStandardScore = -1

  const boards: GeneratedBoard[] = []

  // Increased from 30 to 150 to compensate for stricter validity rules
  for (let i = 0; i < 50; i++) {
    const attemptSeed = `${seed}-${i}`
    const pool = buildAttemptPool(candidates, attemptSeed, 18)
    const board = findBestBoard(pool, candidates)

    if (board.length !== 4) continue

    const score = getBoardScore(board)

    boards.push({
      groups: board,
      score,
      seed: attemptSeed,
      isStandardValid: board.every((g) => !g.adminOnly),
    })

    if (score > bestScore) {
      bestScore = score
      best = board
    }

    if (isStandardBoard(board) && score > bestStandardScore) {
      bestStandardScore = score
      bestStandard = board
    }
  }

  boards.sort((a, b) => b.score - a.score)

  return {
    best: boards[0]?.groups || best,
    bestStandard,
    boards,
  }
}