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
  ridecount: number
  lastVisitDate: string | null
  specs?: {
    height: number | null
    speed: number | null
    duration: number | null
    verticalAngle: number | null
  }
}

// Client-side loader (practice/test pages). The daily board itself is built by
// /api/connections/daily on the server using the same mapping below.
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

  return toConnectionsCoasters(coasterData.coasters as ApiCoaster[], parkData.parks as Park[])
}

export function toConnectionsCoasters(coasters: ApiCoaster[], parks: Park[]): ConnectionsCoaster[] {
  const parksById = new Map<number, Park>(parks.map((park) => [park.id, park]))
  // Two coasters with the same name (Rutschebanen at Tivoli and at Bakken) are
  // told apart by their park, so a tile never leaves the player guessing which one.
  const nameCount = new Map<string, number>()
  for (const c of coasters) { const k = c.name.trim().toLowerCase(); nameCount.set(k, (nameCount.get(k) ?? 0) + 1) }

  return coasters.map((coaster) => {
    const park = parksById.get(coaster.parkId)
    const shared = (nameCount.get(coaster.name.trim().toLowerCase()) ?? 0) > 1

    return {
      id: coaster.id,
      name: shared && coaster.parkName ? `${coaster.name} (${coaster.parkName})` : coaster.name,
      manufacturer: coaster.manufacturerName ?? null,
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
      ridecount: coaster.rideCount || 0,
      lastVisitDate: coaster.lastVisitDate ?? null,

      specs: {
        height: coaster.specs?.height ?? null,
        speed: coaster.specs?.speed ?? null,
        duration: coaster.specs?.duration ?? null,
        verticalAngle: coaster.specs?.verticalAngle ?? null,
      },
    }
  })
}

export function getNotRiddenCoasters(
  coasters: ConnectionsCoaster[]
): ConnectionsCoaster[] {
  return coasters.filter((coaster) => coaster.haveridden === false)
}