import type { ConnectionsCoaster } from "./utils"

export type CategoryRisk = "safe" | "medium" | "risky"
export type CategoryDifficulty = "yellow" | "green" | "blue" | "purple"

export type CategoryKind =
  | "manufacturer"
  | "country"
  | "park"
  | "inversions"
  | "track_type"
  | "scale"
  | "status"
  | "rating"
  | "year"
  | "decade"
  | "ride_type"
  | "name_structure"
  | "name_theme"

export type CategoryDefinition = {
  id: string
  label: string
  enabled: boolean
  risk: CategoryRisk
  difficulty: CategoryDifficulty
  kind: CategoryKind
  filter: (coasters: ConnectionsCoaster[]) => ConnectionsCoaster[]
}

export type ResolvedConnectionsCategory = {
  id: string
  label: string
  enabled: boolean
  risk: CategoryRisk
  difficulty: CategoryDifficulty
  kind: CategoryKind
  matches: ConnectionsCoaster[]
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function lower(value: string | null | undefined): string {
  return (value ?? "").toLowerCase()
}

function hasAny(text: string | null | undefined, keywords: string[]): boolean {
  const normalized = lower(text)
  return keywords.some((keyword) => normalized.includes(keyword))
}

function getClassification(coaster: ConnectionsCoaster): string {
  return lower(coaster.classification)
}

function getDecadeLabel(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10
  return `${decadeStart}s`
}

function getWordCount(name: string): number {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function createCategoryDefinition(
  id: string,
  label: string,
  enabled: boolean,
  risk: CategoryRisk,
  difficulty: CategoryDifficulty,
  kind: CategoryKind,
  filter: (coasters: ConnectionsCoaster[]) => ConnectionsCoaster[]
): CategoryDefinition {
  return {
    id,
    label,
    enabled,
    risk,
    difficulty,
    kind,
    filter,
  }
}

function uniqueValues(values: Array<string | number | null | undefined>) {
  return [
    ...new Set(
      values.filter(
        (value) => value !== null && value !== undefined && value !== ""
      )
    ),
  ]
}

function buildDynamicCategories(coasters: ConnectionsCoaster[]): CategoryDefinition[] {
  const categories: CategoryDefinition[] = []

  const push = (category: CategoryDefinition) => {
    if (categories.some((existing) => existing.id === category.id)) return
    categories.push(category)
  }

  // status
  push(
    createCategoryDefinition(
      "ridden",
      "Ridden coasters",
      true,
      "safe",
      "yellow",
      "status",
      (items) => items.filter((coaster) => coaster.haveridden === true)
    )
  )

  push(
    createCategoryDefinition(
      "not-ridden",
      "Not ridden coasters",
      true,
      "safe",
      "yellow",
      "status",
      (items) => items.filter((coaster) => coaster.haveridden === false)
    )
  )

  // manufacturers
  for (const manufacturer of uniqueValues(
    coasters.map((coaster) => coaster.manufacturer)
  )) {
    const value = String(manufacturer)
    push(
      createCategoryDefinition(
        `manufacturer-${slugify(value)}`,
        `${value} coasters`,
        true,
        "safe",
        "yellow",
        "manufacturer",
        (items) => items.filter((coaster) => coaster.manufacturer === value)
      )
    )
  }

  // countries
  for (const country of uniqueValues(coasters.map((coaster) => coaster.country))) {
    const value = String(country)
    push(
      createCategoryDefinition(
        `country-${slugify(value)}`,
        `Coasters in ${value}`,
        true,
        "safe",
        "yellow",
        "country",
        (items) => items.filter((coaster) => coaster.country === value)
      )
    )
  }

  // parks
  for (const parkName of uniqueValues(coasters.map((coaster) => coaster.parkName))) {
    const value = String(parkName)
    push(
      createCategoryDefinition(
        `park-${slugify(value)}`,
        `${value} coasters`,
        true,
        "safe",
        "green",
        "park",
        (items) => items.filter((coaster) => coaster.parkName === value)
      )
    )
  }

  // inversions
  for (const inversions of uniqueValues(
    coasters.map((coaster) => coaster.inversions)
  )) {
    const value = Number(inversions)
    push(
      createCategoryDefinition(
        `inversions-${value}`,
        value === 1
          ? "Coasters with 1 inversion"
          : `Coasters with ${value} inversions`,
        true,
        "safe",
        value <= 1 ? "yellow" : value <= 3 ? "green" : "blue",
        "inversions",
        (items) => items.filter((coaster) => coaster.inversions === value)
      )
    )
  }

  // track type
  for (const trackType of uniqueValues(
    coasters.map((coaster) => coaster.trackType)
  )) {
    const value = String(trackType)
    push(
      createCategoryDefinition(
        `track-type-${slugify(value)}`,
        `${value} coasters`,
        true,
        "safe",
        "green",
        "track_type",
        (items) => items.filter((coaster) => coaster.trackType === value)
      )
    )
  }

  // scale
  for (const scale of uniqueValues(coasters.map((coaster) => coaster.scale))) {
    const value = String(scale)
    push(
      createCategoryDefinition(
        `scale-${slugify(value)}`,
        `${value} scale coasters`,
        true,
        "medium",
        "green",
        "scale",
        (items) => items.filter((coaster) => coaster.scale === value)
      )
    )
  }

  // exact ratings
  for (const rating of uniqueValues(coasters.map((coaster) => coaster.rating))) {
    const value = Number(rating)
    push(
      createCategoryDefinition(
        `rating-${String(value).replace(".", "-")}`,
        `Rated ${value}`,
        false,
        "medium",
        "blue",
        "rating",
        (items) => items.filter((coaster) => coaster.rating === value)
      )
    )
  }

  // rating buckets
  const ratingBuckets: Array<{
    id: string
    label: string
    difficulty: CategoryDifficulty
    test: (rating: number) => boolean
  }> = [
    {
      id: "rating-lte-3",
      label: "Rated 3.0 or below",
      difficulty: "yellow",
      test: (rating) => rating <= 3,
    },
    {
      id: "rating-lte-3-5",
      label: "Rated 3.5 or below",
      difficulty: "green",
      test: (rating) => rating <= 3.5,
    },
    {
      id: "rating-gte-4-5",
      label: "Rated 4.5 or above",
      difficulty: "green",
      test: (rating) => rating >= 4.5,
    },
    {
      id: "rating-gte-5",
      label: "Rated 5.0 or above",
      difficulty: "green",
      test: (rating) => rating >= 5,
    },
    {
      id: "rating-gte-6",
      label: "Rated 6.0 or above",
      difficulty: "blue",
      test: (rating) => rating >= 6,
    },
    {
      id: "rating-gte-7",
      label: "Rated 7.0 or above",
      difficulty: "blue",
      test: (rating) => rating >= 7,
    },
    {
      id: "rating-gte-8",
      label: "Rated 8.0 or above",
      difficulty: "blue",
      test: (rating) => rating >= 8,
    },
    {
      id: "rating-gte-9",
      label: "Rated 9.0 or above",
      difficulty: "purple",
      test: (rating) => rating >= 9,
    },
    {
      id: "rating-gte-10",
      label: "Rated 10.0 or above",
      difficulty: "purple",
      test: (rating) => rating >= 10,
    },
  ]

  for (const bucket of ratingBuckets) {
    push(
      createCategoryDefinition(
        bucket.id,
        bucket.label,
        true,
        "safe",
        bucket.difficulty,
        "rating",
        (items) =>
          items.filter(
            (coaster) => coaster.rating !== null && bucket.test(coaster.rating)
          )
      )
    )
  }

  // decades
  const decades = uniqueValues(
    coasters
      .filter((coaster) => coaster.year !== null)
      .map((coaster) => getDecadeLabel(coaster.year as number))
  )

  for (const decade of decades) {
    const value = String(decade)
    push(
      createCategoryDefinition(
        `decade-${slugify(value)}`,
        `Coasters from the ${value}`,
        true,
        "safe",
        "green",
        "decade",
        (items) =>
          items.filter(
            (coaster) =>
              coaster.year !== null && getDecadeLabel(coaster.year) === value
          )
      )
    )
  }

  // exact year
  for (const year of uniqueValues(coasters.map((coaster) => coaster.year))) {
    const value = Number(year)
    push(
      createCategoryDefinition(
        `year-${value}`,
        `Coasters from ${value}`,
        false,
        "medium",
        "blue",
        "year",
        (items) => items.filter((coaster) => coaster.year === value)
      )
    )
  }

  // ride / model / classification
  const classificationRules: Array<{
    id: string
    label: string
    keywords: string[]
    enabled: boolean
    risk: CategoryRisk
    difficulty: CategoryDifficulty
  }> = [
    {
      id: "launched",
      label: "Launched coasters",
      keywords: ["launched"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "multi-launched",
      label: "Multi-launched coasters",
      keywords: ["multi-launched"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "spinning",
      label: "Spinning coasters",
      keywords: ["spinning"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "inverted",
      label: "Inverted coasters",
      keywords: ["inverted"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "flying",
      label: "Flying coasters",
      keywords: ["flying"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "wing",
      label: "Wing coasters",
      keywords: ["wing"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "floorless",
      label: "Floorless coasters",
      keywords: ["floorless"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "dive",
      label: "Dive coasters",
      keywords: ["dive machine"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "vertical-drop",
      label: "Vertical drop coasters",
      keywords: ["vertical drop"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "wild-mouse",
      label: "Wild Mouse coasters",
      keywords: ["wild mouse"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "mine-train",
      label: "Mine train coasters",
      keywords: ["mine train"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "hyper",
      label: "Hyper coasters",
      keywords: ["hyper"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "mega",
      label: "Mega coasters",
      keywords: ["mega"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "shuttle",
      label: "Shuttle coasters",
      keywords: ["shuttle"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "powered",
      label: "Powered coasters",
      keywords: ["powered"],
      enabled: true,
      risk: "medium",
      difficulty: "green",
    },
    {
      id: "bobsled",
      label: "Bobsled coasters",
      keywords: ["bobsled"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "lsm",
      label: "LSM coasters",
      keywords: ["lsm"],
      enabled: true,
      risk: "medium",
      difficulty: "blue",
    },
    {
      id: "lim",
      label: "LIM coasters",
      keywords: ["lim"],
      enabled: false,
      risk: "medium",
      difficulty: "purple",
    },
    {
      id: "boost-launch",
      label: "Boost launch coasters",
      keywords: ["boost launch"],
      enabled: true,
      risk: "medium",
      difficulty: "purple",
    },
  ]

  for (const rule of classificationRules) {
    push(
      createCategoryDefinition(
        rule.id,
        rule.label,
        rule.enabled,
        rule.risk,
        rule.difficulty,
        "ride_type",
        (items) =>
          items.filter(
            (coaster) =>
              hasAny(getClassification(coaster), rule.keywords) ||
              hasAny(coaster.model, rule.keywords)
          )
      )
    )
  }

  // name structure
  push(
    createCategoryDefinition(
      "one-word-name",
      "One-word coaster names",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => getWordCount(coaster.name) === 1)
    )
  )

  push(
    createCategoryDefinition(
      "two-word-name",
      "Two-word coaster names",
      false,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => getWordCount(coaster.name) === 2)
    )
  )

  push(
    createCategoryDefinition(
      "three-plus-word-name",
      "Three-or-more-word coaster names",
      false,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => getWordCount(coaster.name) >= 3)
    )
  )

  push(
    createCategoryDefinition(
      "hyphenated-names",
      "Hyphenated coaster names",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => coaster.name.includes("-"))
    )
  )

  push(
    createCategoryDefinition(
      "apostrophe-names",
      "Coaster names with apostrophes",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => /['’]/.test(coaster.name))
    )
  )

  push(
    createCategoryDefinition(
      "punctuation-names",
      "Coaster names with punctuation",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => /[.'’:’-]/.test(coaster.name))
    )
  )

    push(
    createCategoryDefinition(
      "long-names",
      "Long coaster names (10+ characters)",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => coaster.name.length >= 10)
    )
  )

  push(
    createCategoryDefinition(
      "short-names",
      "Short coaster names (5 letters or fewer)",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => coaster.name.length <= 5)
    )
  )

  push(
    createCategoryDefinition(
      "double-letter-names",
      "Names with double letters",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) =>
        /(.)\1/.test(coaster.name.toLowerCase())
      )
    )
  )

  push(
    createCategoryDefinition(
      "ends-with-n",
      'Names ending with "n"',
      true,
      "risky",
      "purple",
      "name_structure",
      (items) =>
        items.filter((coaster) =>
          coaster.name.toLowerCase().endsWith("n")
        )
    )
  )

  push(
    createCategoryDefinition(
      "number-names",
      "Names containing numbers",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) => items.filter((coaster) => /\d/.test(coaster.name))
    )
  )

  push(
    createCategoryDefinition(
      "repeated-pattern-names",
      "Names with repeated patterns",
      true,
      "risky",
      "purple",
      "name_structure",
      (items) =>
        items.filter((coaster) =>
          /(\w{2,}).*\1/i.test(coaster.name)
        )
    )
  )

  // starts with letter
  const startingLetters = uniqueValues(
    coasters.map((coaster) => coaster.name.trim().charAt(0).toUpperCase())
  )

  for (const letter of startingLetters) {
    const value = String(letter)
    push(
      createCategoryDefinition(
        `starts-with-${slugify(value)}`,
        `Coaster names starting with "${value}"`,
        true,
        "risky",
        "purple",
        "name_structure",
        (items) =>
          items.filter(
            (coaster) =>
              coaster.name.trim().charAt(0).toUpperCase() === value
          )
      )
    )
  }

  // name themes
  const nameRules: Array<{
    id: string
    label: string
    keywords: string[]
    enabled: boolean
    difficulty: CategoryDifficulty
  }> = [
    {
      id: "dragon-names",
      label: "Dragon-related coaster names",
      keywords: ["dragon", "drage", "dragen", "draken"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "weather-names",
      label: "Weather-related coaster names",
      keywords: ["storm", "tornado", "orkan", "tyfon", "lynet", "thunder", "lightning"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "animal-names",
      label: "Animal-related coaster names",
      keywords: [
        "wolf",
        "ulven",
        "kat",
        "cat",
        "dog",
        "hunde",
        "camel",
        "kamel",
        "bat",
        "flagermus",
        "boar",
        "svin",
        "falcon",
        "falk",
        "hedgehog",
        "pindsvin",
        "mamba",
        "vampire",
        "bee",
        "dragon",
      ],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "mythic-names",
      label: "Mythical / legendary names",
      keywords: ["hyperion", "valkyria", "pegasus", "thor", "wodan", "fønix", "fēnix", "phoenix"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "space-names",
      label: "Space-related coaster names",
      keywords: ["mars", "luna", "eurosat", "mælkevejen", "milky way"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "fear-names",
      label: "Fear / danger-themed coaster names",
      keywords: ["devil", "demon", "monster", "psyké", "vampire"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "speed-names",
      label: "Speed / force-themed coaster names",
      keywords: ["speed", "formula", "force", "boost", "lynet"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "royal-names",
      label: "Royal / ruler-themed coaster names",
      keywords: ["king", "queen", "kongen"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-coaster",
      label: 'Names containing "coaster"',
      keywords: ["coaster"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-express",
      label: 'Names containing "express"',
      keywords: ["express"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-loop",
      label: 'Names containing "loop"',
      keywords: ["loop"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-fire",
      label: 'Names containing "fire"',
      keywords: ["fire"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-light",
      label: 'Names containing "light"',
      keywords: ["light"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-blue",
      label: 'Names containing "blue"',
      keywords: ["blue"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-star",
      label: 'Names containing "star"',
      keywords: ["star"],
      enabled: true,
      difficulty: "purple",
    },
    {
      id: "contains-family",
      label: 'Names containing "family"',
      keywords: ["family"],
      enabled: true,
      difficulty: "purple",
    },
  ]

  for (const rule of nameRules) {
    push(
      createCategoryDefinition(
        rule.id,
        rule.label,
        rule.enabled,
        "risky",
        rule.difficulty,
        "name_theme",
        (items) => items.filter((coaster) => hasAny(coaster.name, rule.keywords))
      )
    )
  }

  return categories
}

export function getAllCategories(
  coasters: ConnectionsCoaster[]
): CategoryDefinition[] {
  return buildDynamicCategories(coasters).sort((a, b) => {
    const difficultyOrder: Record<CategoryDifficulty, number> = {
      yellow: 0,
      green: 1,
      blue: 2,
      purple: 3,
    }

    if (a.difficulty !== b.difficulty) {
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
    }

    const riskOrder: Record<CategoryRisk, number> = {
      safe: 0,
      medium: 1,
      risky: 2,
    }

    if (a.risk !== b.risk) {
      return riskOrder[a.risk] - riskOrder[b.risk]
    }

    return a.label.localeCompare(b.label)
  })
}

export function getUsableCategories(
  coasters: ConnectionsCoaster[]
): ResolvedConnectionsCategory[] {
  return getAllCategories(coasters)
    .map((category) => ({
      id: category.id,
      label: category.label,
      enabled: category.enabled,
      risk: category.risk,
      difficulty: category.difficulty,
      kind: category.kind,
      matches: category.filter(coasters),
    }))
    .filter((category) => category.enabled && category.matches.length >= 4)
}

export const ALL_CATEGORIES: CategoryDefinition[] = []