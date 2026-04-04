import { ApiCoaster, Park } from "@/app/types"

export type ConnectionsCoaster = {
  id: number
  name: string
  manufacturer: string | null
  model: string | null
  scale: string | null
  parkId: number
  parkName: string
  country: string | null
  haveridden: boolean
  rating: number | null
  year: number | null
  inversions: number | null
  trackType: string | null
  classification: string | null
}

export async function fetchConnectionsData(): Promise<ConnectionsCoaster[]> {
  const [coasterRes, parkRes] = await Promise.all([
    fetch("/api/coasters"),
    fetch("/api/parks"),
  ])

  if (!coasterRes.ok) {
    throw new Error("Failed to load coasters")
  }

  if (!parkRes.ok) {
    throw new Error("Failed to load parks")
  }

  const coasterData = await coasterRes.json()
  const parkData = await parkRes.json()

  if (!Array.isArray(coasterData?.coasters)) {
    throw new Error("Unexpected coaster data format")
  }

  if (!Array.isArray(parkData?.parks)) {
    throw new Error("Unexpected park data format")
  }

  const parksById = new Map<number, Park>(
    (parkData.parks as Park[]).map((park) => [park.id, park])
  )

  return (coasterData.coasters as ApiCoaster[]).map((coaster) => {
    const park = parksById.get(coaster.parkId)

    return {
      id: coaster.id,
      name: coaster.name,
      manufacturer: coaster.manufacturer ?? null,
      model: coaster.model ?? null,
      scale: coaster.scale ?? null,
      parkId: coaster.parkId,
      parkName: coaster.parkName,
      country: park?.country ?? null,
      haveridden:
        (coaster as ApiCoaster & { haveridden?: boolean }).haveridden ??
        coaster.haveRidden ??
        false,
      rating:
        coaster.rating !== null && coaster.rating !== undefined
          ? Number(coaster.rating)
          : null,
      year: coaster.year ?? null,
      inversions: coaster.specs?.inversions ?? null,
      trackType: coaster.specs?.type ?? null,
      classification: coaster.specs?.classification ?? null,
    }
  })
}

export function getNotRiddenCoasters(
  coasters: ConnectionsCoaster[]
): ConnectionsCoaster[] {
  return coasters.filter((coaster) => coaster.haveridden === false)
}