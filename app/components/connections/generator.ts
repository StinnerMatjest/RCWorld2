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
  coasters: ConnectionsCoaster[]
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
  const names = coasters.map((coaster) => coaster.name.toLowerCase())
  return new Set(names).size !== names.length
}

function groupsOverlap(a: CandidateGroup, b: CandidateGroup): boolean {
  const aIds = new Set(a.coasters.map((coaster) => coaster.id))
  return b.coasters.some((coaster) => aIds.has(coaster.id))
}

function groupKey(coasters: ConnectionsCoaster[]): string {
  return coasters
    .map((coaster) => coaster.id)
    .sort((a, b) => a - b)
    .join("-")
}

function candidateSignature(group: CandidateGroup): string {
  return `${group.categoryId}:${groupKey(group.coasters)}`
}

/**
 * Prevents "5th group" issue:
 * Reject if ANY other valid group exists within the 16 coasters
 */
function hasExtraBoardGroup(
  chosenGroups: CandidateGroup[],
  allCandidates: CandidateGroup[]
): boolean {
  const boardIds = new Set(
    chosenGroups.flatMap((g) => g.coasters.map((c) => c.id))
  )

  const chosenKeys = new Set(chosenGroups.map(candidateSignature))

  return allCandidates.some((candidate) => {
    const fullyOnBoard = candidate.coasters.every((c) =>
      boardIds.has(c.id)
    )

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
  const maxStart = Math.min(shuffled.length, maxGroupsPerCategory * 2)

  for (let start = 0; start < maxStart; start++) {
    const pack = doubled.slice(start, start + 4)

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
  return categories.flatMap((category) =>
    buildCandidateGroupsForCategory(category, seed)
  )
}

function pickByDifficulty(
  candidates: CandidateGroup[],
  difficulty: CategoryDifficulty,
  chosen: CandidateGroup[],
  seed: string
): CandidateGroup[] {
  const usedKinds = new Set(chosen.map((group) => group.kind))
  const usedCategoryIds = new Set(chosen.map((group) => group.categoryId))

  const matchingDifficulty = candidates.filter(
    (group) => group.difficulty === difficulty
  )

  const noOverlap = matchingDifficulty.filter(
    (group) =>
      !usedCategoryIds.has(group.categoryId) &&
      !chosen.some((picked) => groupsOverlap(picked, group))
  )

  const preferred = noOverlap.filter((group) => !usedKinds.has(group.kind))
  const pool = preferred.length > 0 ? preferred : noOverlap

  return shuffleWithSeed(pool, `${seed}-${difficulty}-pick`)
}

function tryBuildPuzzleWithTargets(
  candidates: CandidateGroup[],
  seed: string,
  targetDifficulties: CategoryDifficulty[]
): CandidateGroup[] {
  function search(
    chosen: CandidateGroup[],
    difficultyIndex: number
  ): CandidateGroup[] {
    if (difficultyIndex >= targetDifficulties.length) {
      if (hasExtraBoardGroup(chosen, candidates)) return []
      return chosen
    }

    const difficulty = targetDifficulties[difficultyIndex]
    const options = pickByDifficulty(
      candidates,
      difficulty,
      chosen,
      `${seed}-${difficultyIndex}`
    )

    for (const option of options) {
      const nextChosen = [...chosen, option]
      const result = search(nextChosen, difficultyIndex + 1)

      if (result.length === targetDifficulties.length) {
        return result
      }
    }

    return []
  }

  return search([], 0)
}

export function buildDailyPuzzleGroups(
  categories: ResolvedConnectionsCategory[],
  seed: string
): CandidateGroup[] {
  const seedAttempts = [
    seed,
    `${seed}-a`,
    `${seed}-b`,
    `${seed}-c`,
    `${seed}-d`,
    `${seed}-e`,
    `${seed}-f`,
    `${seed}-g`,
  ]

  const difficultyPatterns: CategoryDifficulty[][] = [
    ["yellow", "green", "blue", "purple"],
    ["yellow", "green", "purple", "purple"],
  ]

  for (const attemptSeed of seedAttempts) {
    const candidates = shuffleWithSeed(
      buildCandidateGroups(categories, attemptSeed),
      `${attemptSeed}-all`
    )

    for (const pattern of difficultyPatterns) {
      const result = tryBuildPuzzleWithTargets(
        candidates,
        attemptSeed,
        pattern
      )

      if (result.length === 4) {
        return result
      }
    }
  }

  return []
}