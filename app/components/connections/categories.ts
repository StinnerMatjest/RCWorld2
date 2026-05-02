import type { ConnectionsCoaster } from "./utils"

export type CategoryRisk = "safe" | "medium" | "risky"
export type CategoryDifficulty = "yellow" | "green" | "blue" | "purple"

export type CategoryKind =
  | "manufacturer"
  | "country"
  | "region"
  | "park"
  | "inversions"
  | "track_type"
  | "scale"
  | "status"
  | "rating"
  | "year"
  | "decade"
  | "ride_type"
  | "ride_stats"
  | "name_structure"
  | "name_theme"

export type CategoryDefinition = {
  id: string
  label: string
  risk: CategoryRisk
  difficulty: CategoryDifficulty
  kind: CategoryKind
  adminOnly: boolean
  filter: (coasters: ConnectionsCoaster[]) => ConnectionsCoaster[]
}

export type ResolvedConnectionsCategory = {
  id: string
  label: string
  risk: CategoryRisk
  difficulty: CategoryDifficulty
  kind: CategoryKind
  adminOnly: boolean
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
  risk: CategoryRisk,
  difficulty: CategoryDifficulty,
  kind: CategoryKind,
  filter: (coasters: ConnectionsCoaster[]) => ConnectionsCoaster[],
  adminOnly: boolean = false
): CategoryDefinition {
  return {
    id,
    label,
    risk,
    difficulty,
    kind,
    adminOnly,
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
        "safe",
        "yellow",
        "country",
        (items) => items.filter((coaster) => coaster.country === value)
      )
    )
  }

  // geographic regions
  push(
    createCategoryDefinition(
      "region-scandinavia",
      "Scandinavian coasters",
      "safe",
      "green",
      "region",
      (items) =>
        items.filter((coaster) =>
          ["Denmark", "Sweden", "Norway", "Finland"].includes(coaster.country ?? "")
        )
    )
  )

  // parks
  for (const parkName of uniqueValues(coasters.map((coaster) => coaster.parkName))) {
    const value = String(parkName)
    push(
      createCategoryDefinition(
        `park-${slugify(value)}`,
        `${value} coasters`,
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
        "safe",
        value <= 1 ? "yellow" : value <= 3 ? "green" : "blue",
        "inversions",
        (items) => items.filter((coaster) => coaster.inversions === value)
      )
    )
  }


  // inversion bucket
  push(
    createCategoryDefinition(
      "inversions-5-plus",
      "Coasters with 5+ inversions",
      "safe",
      "blue",
      "inversions",
      (items) =>
        items.filter(
          (coaster) => coaster.inversions !== null && coaster.inversions >= 5
        )
    )
  )

  // speed / height / duration
  push(
    createCategoryDefinition(
      "vertical-angle-85",
      "Steep vertical drop coasters (85°+)",
      "medium",
      "blue",
      "ride_stats",
      (items) =>
        items.filter(
          (coaster) =>
            coaster.specs?.verticalAngle !== null &&
            coaster.specs?.verticalAngle !== undefined &&
            coaster.specs.verticalAngle >= 85
        )
    )
  )

  push(
    createCategoryDefinition(
      "tall-coasters",
      "Tall coasters (150ft+)",
      "safe",
      "green",
      "ride_stats",
      (items) =>
        items.filter(
          (coaster) =>
            coaster.specs?.height !== null &&
            coaster.specs?.height !== undefined &&
            coaster.specs.height >= 150
        )
    )
  )

  push(
    createCategoryDefinition(
      "fast-coasters",
      "Fast coasters (60+ mph)",
      "safe",
      "green",
      "ride_stats",
      (items) =>
        items.filter(
          (coaster) =>
            coaster.specs?.speed !== null &&
            coaster.specs?.speed !== undefined &&
            coaster.specs.speed >= 60
        )
    )
  )

  push(
    createCategoryDefinition(
      "short-duration",
      "Short rides (≤ 90 sec)",
      "medium",
      "green",
      "ride_stats",
      (items) =>
        items.filter(
          (coaster) =>
            coaster.specs?.duration !== null &&
            coaster.specs?.duration !== undefined &&
            coaster.specs.duration <= 90
        )
    )
  )

  push(
    createCategoryDefinition(
      "long-duration",
      "Long rides (150+ sec)",
      "medium",
      "blue",
      "ride_stats",
      (items) =>
        items.filter(
          (coaster) =>
            coaster.specs?.duration !== null &&
            coaster.specs?.duration !== undefined &&
            coaster.specs.duration >= 150
        )
    )
  )
  

  // track type
  for (const trackType of uniqueValues(
    coasters.map((coaster) => coaster.trackType)
  )) {
    const value = String(trackType)
    push(
      createCategoryDefinition(
        `track-type-${slugify(value)}`,
        `${value} coasters`,
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
        "medium",
        "blue",
        "rating",
        (items) => items.filter((coaster) => coaster.rating === value),
        true
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
        id: "rating-lte-4",
        label: "Rated 4.0 or below",
        difficulty: "blue",
        test: (rating) => rating <= 4,
      },
      {
        id: "rating-gte-8",
        label: "Rated 8.0 or above",
        difficulty: "blue",
        test: (rating) => rating >= 8,
      },
      {
        id: "rating-golden",
        label: "Golden Rating (11.0)",
        difficulty: "blue",
        test: (rating) => rating === 11,
      },
    ]

  for (const bucket of ratingBuckets) {
    push(
      createCategoryDefinition(
        bucket.id,
        bucket.label,
        "safe",
        bucket.difficulty,
        "rating",
        (items) =>
          items.filter(
            (coaster) => coaster.rating !== null && bucket.test(coaster.rating)
          ),
        true
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

  // ride / model / classification
  const classificationRules: Array<{
    id: string
    label: string
    keywords: string[]
    checkModel?: boolean // optional
    risk: CategoryRisk
    difficulty: CategoryDifficulty
  }> = [
      {
        id: "spinning",
        label: "Spinning coasters",
        keywords: ["spinning"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "inverted",
        label: "Inverted coasters",
        keywords: ["inverted"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "flying",
        label: "Flying coasters",
        keywords: ["flying"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "wing",
        label: "Wing coasters",
        keywords: ["wing"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "floorless",
        label: "Floorless coasters",
        keywords: ["floorless"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "dive",
        label: "Dive coasters",
        keywords: ["dive machine"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "vertical-drop",
        label: "Vertical drop coasters",
        keywords: ["vertical drop"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "wild-mouse",
        label: "Wild Mouse coasters",
        keywords: ["wild mouse"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "mine-train",
        label: "Mine train coasters",
        keywords: ["mine train"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "giga",
        label: "Giga coasters",
        keywords: ["giga"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "hyper",
        label: "Hyper coasters",
        keywords: ["hyper"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "mega",
        label: "Mega coasters",
        keywords: ["mega"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "shuttle",
        label: "Shuttle coasters",
        keywords: ["shuttle"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "powered",
        label: "Powered coasters",
        keywords: ["powered"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "bobsled",
        label: "Bobsled coasters",
        keywords: ["bobsled"],
        checkModel: false, // Don't check model
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "launched",
        label: "Launched coasters",
        keywords: ["launched"],
        risk: "medium",
        difficulty: "green",
      },
      {
        id: "multi-launched",
        label: "Multi-launched coasters",
        keywords: ["multi-launched"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "lsm",
        label: "LSM coasters",
        keywords: ["lsm"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "lim",
        label: "LIM coasters",
        keywords: ["lim"],
        risk: "medium",
        difficulty: "purple",
      },
      {
        id: "tire-launch",
        label: "Tire-launched coasters",
        keywords: ["tire launch"],
        risk: "medium",
        difficulty: "purple",
      },
      {
        id: "custom",
        label: "Custom Coasters",
        keywords: ["custom"],
        risk: "medium",
        difficulty: "blue",
      },
      {
        id: "clone",
        label: "Cloned coasters",
        keywords: ["clone"],
        risk: "medium",
        difficulty: "blue",
      },
    ]

  for (const rule of classificationRules) {
    push(
      createCategoryDefinition(
        rule.id,
        rule.label,
        rule.risk,
        rule.difficulty,
        "ride_type",
        (items) =>
          items.filter((coaster) => {
            const matchesClass = hasAny(getClassification(coaster), rule.keywords);
            const matchesModel = rule.checkModel !== false ? hasAny(coaster.model, rule.keywords) : false;

            return matchesClass || matchesModel;
          })
      )
    )
  }

  // name structure
  push(
    createCategoryDefinition(
      "one-word-name",
      "One-word coaster names",
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

  // Ride Count (admin only)
  push(
    createCategoryDefinition(
      "ones-and-dones",
      'The "One & Done" club (Ridden exactly once)',
      "medium",
      "purple",
      "status",
      (items) => items.filter((coaster) => coaster.ridecount === 1),
      true
    )
  )

  push(
    createCategoryDefinition(
      "comfort-coasters",
      "Comfort Coasters (Ridden 5+ times)",
      "medium",
      "purple",
      "status",
      (items) => items.filter((coaster) => coaster.ridecount >= 5),
      true
    )
  )

  // Last time ridden (admin only)
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(now.getFullYear() - 3);

  push(
    createCategoryDefinition(
      "recent-coasters",
      "Recent rides (Ridden within the last year)",
      "risky",
      "purple",
      "status",
      (items) => items.filter((coaster) => {
        if (!coaster.lastVisitDate) return false;
        const visitDate = new Date(coaster.lastVisitDate);
        return visitDate >= oneYearAgo;
      }),
      true
    )
  )

  push(
    createCategoryDefinition(
      "forgotten-coasters",
      "Forgotten coasters (Not ridden in 3+ years)",
      "risky",
      "purple",
      "status",
      (items) => items.filter((coaster) => {
        if (!coaster.lastVisitDate) return false;
        const visitDate = new Date(coaster.lastVisitDate);
        return visitDate <= threeYearsAgo;
      }),
      true
    )
  )

  // name themes
  const nameRules: Array<{
    id: string
    label: string
    keywords: string[]
    difficulty: CategoryDifficulty
  }> = [
      {
        id: "dragon-names",
        label: "Dragon-related coaster names",
        keywords: ["dragon", "drage", "dragen", "draken"],
        difficulty: "purple",
      },
      {
        id: "weather-names",
        label: "Weather-related coaster names",
        keywords: ["storm", "tornado", "orkan", "tyfon", "lynet", "thunder", "lightning"],
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
        difficulty: "purple",
      },
      {
        id: "mythic-names",
        label: "Mythical / legendary names",
        keywords: ["hyperion", "valkyria", "pegasus", "thor", "wodan", "fønix", "fēnix", "phoenix"],
        difficulty: "purple",
      },
      {
        id: "space-names",
        label: "Space-related coaster names",
        keywords: ["mars", "luna", "eurosat", "mælkevejen", "milky way"],
        difficulty: "purple",
      },
      {
        id: "fear-names",
        label: "Fear / danger-themed coaster names",
        keywords: ["devil", "demon", "monster", "psyké", "vampire"],
        difficulty: "purple",
      },
      {
        id: "speed-names",
        label: "Speed / force-themed coaster names",
        keywords: ["speed", "formula", "force", "boost", "lynet"],
        difficulty: "purple",
      },
      {
        id: "royal-names",
        label: "Royal / ruler-themed coaster names",
        keywords: ["king", "queen", "kongen"],
        difficulty: "purple",
      },
      {
        id: "contains-coaster",
        label: 'Names containing "coaster"',
        keywords: ["coaster"],
        difficulty: "purple",
      },
      {
        id: "contains-express",
        label: 'Names containing "express"',
        keywords: ["express"],
        difficulty: "purple",
      },
      {
        id: "contains-loop",
        label: 'Names containing "loop"',
        keywords: ["loop"],
        difficulty: "purple",
      },
      {
        id: "contains-fire",
        label: 'Names containing "fire"',
        keywords: ["fire"],
        difficulty: "purple",
      },
      {
        id: "contains-light",
        label: 'Names containing "light"',
        keywords: ["light"],
        difficulty: "purple",
      },
      {
        id: "contains-blue",
        label: 'Names containing "blue"',
        keywords: ["blue"],
        difficulty: "purple",
      },
      {
        id: "contains-star",
        label: 'Names containing "star"',
        keywords: ["star"],
        difficulty: "purple",
      },
      {
        id: "contains-family",
        label: 'Names containing "family"',
        keywords: ["family"],
        difficulty: "purple",
      },
    ]

  const classificationExtras: Array<{
    id: string
    label: string
    keyword: string
    difficulty: CategoryDifficulty
  }> = [
      {
        id: "onboard-sound",
        label: "Coasters with onboard audio",
        keyword: "onboard sound",
        difficulty: "purple",
      },
    ]

  for (const extra of classificationExtras) {
    push(
      createCategoryDefinition(
        extra.id,
        extra.label,
        "risky",
        extra.difficulty,
        "ride_type",
        (items) =>
          items.filter((coaster) =>
            lower(coaster.classification).includes(extra.keyword)
          )
      )
    )
  }

  for (const rule of nameRules) {
    push(
      createCategoryDefinition(
        rule.id,
        rule.label,
        "risky",
        rule.difficulty,
        "name_theme",
        (items) => items.filter((coaster) => hasAny(coaster.name, rule.keywords))
      )
    )
  }

  return categories.map((category) => {
    if (category.id === "ridden" || category.id === "not-ridden") {
      return category;
    }

    // force ALL other categories to only use ridden coasters
    return {
      ...category,
      filter: (items) =>
        category.filter(items.filter((coaster) => coaster.haveridden)),
    };
  });
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
  coasters: ConnectionsCoaster[],
  disabledIds: Set<string>,
  isAdmin: boolean = false //
): ResolvedConnectionsCategory[] {
  return getAllCategories(coasters)
    .map((category) => ({
      id: category.id,
      label: category.label,
      risk: category.risk,
      difficulty: category.difficulty,
      kind: category.kind,
      adminOnly: category.adminOnly,
      matches: category.filter(coasters),
    }))
    .filter((category) => category.matches.length >= 4 && !disabledIds.has(category.id))
    .filter((category) => isAdmin || !category.adminOnly);
}

export const ALL_CATEGORIES: CategoryDefinition[] = []