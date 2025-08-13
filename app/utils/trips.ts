import { Trip } from "@/app/components/TripCard"


export const trips: Trip[] = [
  {
    country: 'Poland',
    parks: [
        'EnergyLandia', 
        'Legendia'],
    rcdb: [
      'https://rcdb.com/12068.htm',
      'https://rcdb.com/5637.htm',
    ],
    startDate: '2025-10-11',
    endDate: '2025-10-17',
    status: 'booked',
    notes: 'ZADRA FUCK YE!!!!!!!',
    mapLink: 'https://maps.app.goo.gl/hZQC9Uc8XbwxEcAf8',
    tripLog: [
      { date: '2025-10-11', activity: 'Energylandia Day 1' },
      { date: '2025-10-12', activity: 'Energylandia Day 2' },
      { date: '2025-10-13', activity: 'Family Fun' },
      { date: '2025-10-14', activity: 'Legendia Day 1' },
      { date: '2025-10-15', activity: 'Katowice sightseeing' },
      { date: '2025-10-16', activity: 'Krakow sightseeing' },
      { date: '2025-10-17', activity: 'Return home' },
    ],
  },
  {
    country: 'SouthKorea',
    parks: [
        'Lotte World Seoul',
        'Lotte World Busan',
        'Everland',
        'Seoul Land',
        'Gyeoungju World',
        'E-World'],
     rcdb: [
      'https://rcdb.com/5016.htm',
      'https://rcdb.com/17315.htm',
      'https://rcdb.com/5017.htm',
      'https://rcdb.com/5019.htm',
      'https://rcdb.com/5040.htm',
      'https://rcdb.com/5041.htm',
    ],
    startDate: '2026-03-10',
    endDate: '2026-03-30',
    status: 'planned',
    notes: 'South Korea roadtrip including every park on the peninsula',
  },
    {
    country: 'Germany',
    parks: [
        'Europapark'],
    rcdb: [
      'https://rcdb.com/4870.htm',
    ],
    startDate: '2025-11-20',
    endDate: '2025-11-24',
    status: 'booked',
    notes: 'Hallowinter at Europapark',
    mapLink: 'https://maps.app.goo.gl/nf3HDX4KT5Zm2idk9',
    tripLog: [
      { date: '2025-11-21', activity: 'Europapark Day 1' },
      { date: '2025-11-22', activity: 'Europapark Day 2' },
      { date: '2025-11-23', activity: 'Europapark Day 3' },
    ],
  },
  {
    country: ['Denmark', 'Germany'],
    parks: [
        'Legoland',
        'Hansa-Park',
        'Heidepark'],
    rcdb: [
      'https://rcdb.com/4903.htm',
      'https://rcdb.com/4873.htm',
      'https://rcdb.com/4874.htm',
    ],
    startDate: '2026-09-10',
    endDate: '2026-09-14',
    status: 'planned',
    notes: 'Dates have to be specified, but this is the general plan',
  },

    {
    country: ['Denmark','Sweden'],
    parks: [
        'Tivoli Gardens',
        'Liseberg',
        'Bakken',
        'BonBon-Land'],
    rcdb: [
      'https://parkrating.com/park/78',
      'https://parkrating.com/park/39',
      'https://parkrating.com/park/79',
      'https://parkrating.com/park/77',
    ],
    
    startDate: '2025-07-12',
    endDate: '2025-07-14',
    status: 'past',
    notes: 'Denmark / Sweden roadtrip',
      tripLog: [
      { date: '2025-07-12', activity: 'BonBon-Land' },
      { date: '2025-07-12', activity: 'Tivoli Gardens by night' },
      { date: '2025-07-13', activity: 'Bakken' },
      { date: '2025-07-14', activity: 'Liseberg' },
    ],
  },
  
]

export const getDaysUntil = (date: string) => {
  const today = new Date()
  const target = new Date(date)
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : null
}

export const getNextTrip = () => {
  return trips
    .filter((t) => t.status === "booked" && getDaysUntil(t.startDate))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]
}
