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
  const names = coasters.map((c) => c.name.toLowerCase())
  return new Set(names).size !== names.length
}

function groupsOverlap(a: CandidateGroup, b: CandidateGroup): boolean {
  const aIds = new Set(a.coasters.map((c) => c.id))
  return b.coasters.some((c) => aIds.has(c.id))
}

function groupKey(coasters: ConnectionsCoaster[]): string {
  return coasters.map((c) => c.id).sort((a, b) => a - b).join("-")
}

function candidateSignature(group: CandidateGroup): string {
  return `${group.categoryId}:${groupKey(group.coasters)}`
}

function hasExtraBoardGroup(
  chosenGroups: CandidateGroup[],
  allCandidates: CandidateGroup[]
): boolean {
  const boardIds = new Set(
    chosenGroups.flatMap((g) => g.coasters.map((c) => c.id))
  )

  const chosenKeys = new Set(chosenGroups.map(candidateSignature))

  return allCandidates.some((candidate) => {
    const fullyOnBoard = candidate.coasters.every((c) => boardIds.has(c.id))
    if (!fullyOnBoard) return false

    return !chosenKeys.has(candidateSignature(candidate))
  })
}

function buildCandidateGroupsForCategory(
  category: ResolvedConnectionsCategory,
  seed: string,
  maxGroupsPerCategory = 12
): CandidateGroup[] {
  if (category.matches.length < 4) return []

  const shuffled = shuffleWithSeed(category.matches, `${seed}-${category.id}`)
  const candidates: CandidateGroup[] = []
  const seen = new Set<string>()

  const doubled = [...shuffled, ...shuffled]

  for (let i = 0; i < doubled.length; i++) {
    const pack = doubled.slice(i, i + 4)

    if (pack.length < 4) continue
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

    if (candidates.length >= maxGroupsPerCategory) break
  }

  return candidates
}

export function buildCandidateGroups(
  categories: ResolvedConnectionsCategory[],
  seed: string
): CandidateGroup[] {
  return categories.flatMap((c) =>
    buildCandidateGroupsForCategory(c, seed)
  )
}

function normalizedValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim().toLowerCase()
  return str.length > 0 ? str : null
}

function getIntendedGroupKeys(groups: CandidateGroup[]): Set<string> {
  return new Set(groups.map((g) => groupKey(g.coasters)))
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

      // Ignore intended groups
      if (intendedKeys.has(attrGroupKey)) continue

      // Only punish real accidental 4+ groups
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

function findBestBoard(
  pool: CandidateGroup[],
  allCandidates: CandidateGroup[]
): CandidateGroup[] {
  let best: CandidateGroup[] = []
  let bestScore = -1

  const max = Math.min(pool.length, 25)

  for (let a = 0; a < max; a++) {
    for (let b = a + 1; b < max; b++) {
      for (let c = b + 1; c < max; c++) {
        for (let d = c + 1; d < max; d++) {
          const combo = [pool[a], pool[b], pool[c], pool[d]]

            const counts: Record<string, number> = {}

            for (const g of combo) {
              counts[g.difficulty] = (counts[g.difficulty] || 0) + 1
            }

            // Rule: max 2 of same difficulty
            if (Object.values(counts).some(count => count > 2)) continue

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

  for (let i = 0; i < 30; i++) {
    const attemptSeed = `${seed}-${i}`
    const shuffled = shuffleWithSeed(candidates, attemptSeed)

    const pool = shuffled.slice(0, 25)
    const board = findBestBoard(pool, candidates)

    if (board.length !== 4) continue

    const score = getBoardScore(board)

    boards.push({
      groups: board,
      score,
      seed: attemptSeed,
      isStandardValid: board.every(g => !g.adminOnly),
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