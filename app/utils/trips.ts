import { Trip } from "@/app/components/TripCard"

export const trips: Trip[] = [
  {
    country: 'Poland',
    parks: ['EnergyLandia','Legendia'],
    rcdb: [
      'https://rcdb.com/12068.htm',
      'https://rcdb.com/5637.htm',
    ],
    startDate: '2025-10-11',
    endDate: '2025-10-17',
    status: 'past',
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
      'E-World'
    ],
    rcdb: [
      'https://rcdb.com/5016.htm',
      'https://rcdb.com/17315.htm',
      'https://rcdb.com/5017.htm',
      'https://rcdb.com/5019.htm',
      'https://rcdb.com/5040.htm',
      'https://rcdb.com/5041.htm',
    ],
    startDate: '2027-03-10',
    endDate: '2027-03-30',
    status: 'planned',
    notes: 'South Korea roadtrip including every park on the peninsula',
  },
  {
    country: 'Sweden',
    parks: [
      'Liseberg',
    ],
    rcdb: [
      'https://parkrating.com/park/39'
    ],
    startDate: '2026-04-25',
    endDate: '2026-04-25',
    status: 'booked',
    notes: 'Liseberg Opening day season 2026',
  },
  {
    country: 'Germany',
    parks: ['Europapark'],
    rcdb: ['https://rcdb.com/4870.htm'],
    startDate: '2025-11-20',
    endDate: '2025-11-24',
    status: 'past',
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
    parks: ['Legoland','Hansa-Park','Heidepark','Serengeti-Park' ],
    rcdb: [
      'https://rcdb.com/4903.htm',
      'https://rcdb.com/4873.htm',
      'https://rcdb.com/4874.htm',
      'https://rcdb.com/4890.htm',
    ],
    startDate: '2026-05-14',
    endDate: '2026-05-18',
    status: 'booked',
    notes: 'Legoland -> Heide -> Serengeti -> Hansa roadtrip',
  },
  {
    country: ['Denmark','Sweden'],
    parks: ['Tivoli Gardens','Liseberg','Bakken','BonBon-Land'],
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

  // --- Added Past Trips ---
  {
    country: ['Sweden', 'Norway'],
    parks: ['Tusenfryd', 'Liseberg'],
    rcdb: [
      'https://parkrating.com/park/38',
      'https://parkrating.com/park/79',
    ],
    startDate: '2024-10-04',
    endDate: '2024-10-05',
    status: 'past',
    tripLog: [
      { date: '2024-10-04', activity: 'Tusenfryd' },
      { date: '2024-10-05', activity: 'Liseberg' },
    ],
  },
  {
    country: ['Netherlands', 'Belgium', 'Germany'],
    parks: ['Toverland', 'Walibi Belgium', 'Phantasialand'],
    rcdb: [
      'https://parkrating.com/park/35',
      'https://parkrating.com/park/36',
      'https://parkrating.com/park/37',
    ],
    startDate: '2024-07-17',
    endDate: '2024-07-20',
    status: 'past',
    tripLog: [
      { date: '2024-07-17', activity: 'Toverland' },
      { date: '2024-07-18', activity: 'Walibi Belgium' },
      { date: '2024-07-19', activity: 'Rest day' },
      { date: '2024-07-20', activity: 'Phantasialand' },
    ],
  },
  {
    country: 'Denmark',
    parks: ['Djurs Sommerland', 'Fårup Sommerland', 'Tivoli Friheden'],
    rcdb: [
      'https://parkrating.com/park/36',
      'https://parkrating.com/park/60',
      'https://parkrating.com/park/61',
    ],
    startDate: '2025-04-15',
    endDate: '2025-04-17',
    status: 'past',
    tripLog: [
      { date: '2025-04-15', activity: 'Djurs Sommerland' },
      { date: '2025-04-16', activity: 'Fårup Sommerland' },
      { date: '2025-04-17', activity: 'Tivoli Friheden' },
    ],
  },

  // --- Backlog Trips with corrected RCDB + formatted notes ---
  {
    country: ['Netherlands', 'Belgium'],
    parks: [
      'Walibi Holland',
      'Efteling',
      'Bobbejaanland',
      'Walibi Belgium',
    ],
    rcdb: [
      'https://rcdb.com/4794.htm',
      'https://rcdb.com/4839.htm',
      'https://rcdb.com/4846.htm',
      'https://rcdb.com/4847.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Drive from Odense → Amsterdam → Brussels.\n\n' +
      '• Rough fuel cost: ≈ 2000 DKK.\n' +
      '• Public transport possible but slower.\n' +
      '✅ Car strongly recommended.',
    mapLink:
      "https://www.google.com/maps/dir/Odense,+Denmark/Walibi+Holland,+Spijkweg,+Biddinghuizen,+Netherlands/Efteling,+Europalaan,+Kaatsheuvel,+Netherlands/Bobbejaanland,+Olen,+Belgium/Walibi+Belgium,+Boulevard+de+l'Europe,+Wavre,+Belgium/Brussels,+Belgium",
    tripLog: [
      { date: 'Day 1', activity: 'Walibi Holland' },
      { date: 'Day 2', activity: 'Efteling' },
      { date: 'Day 3', activity: 'Bobbejaanland' },
      { date: 'Day 4', activity: "Walibi Belgium & drive home from Brussels" },
    ],
  },
  {
    country: 'France',
    parks: ['Disneyland Paris','Parc Astérix','Jardin d’Acclimatation'],
    rcdb: [
      'https://rcdb.com/4864.htm',
      'https://rcdb.com/4861.htm',
      'https://rcdb.com/14289.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Fly Copenhagen → Paris.\n\n' +
      '• Disneyland Paris: RER A train from central Paris (~40 min).\n' +
      '• Parc Astérix: Shuttle bus from Porte Maillot (~1h) or from airport (~20 min).\n' +
      '• Jardin d’Acclimatation: Metro line 1 to Les Sablons (~10 min walk).\n\n' +
      '✅ All reachable by public transport.',
    mapLink:
      "https://www.google.com/maps/dir/Paris,+France/Disneyland+Paris/Parc+Ast%C3%A9rix,+Plailly,+France/Jardin+d'Acclimatation,+Bois+de+Boulogne,+Paris,+France",
    tripLog: [
      { date: 'Day 1', activity: 'Disneyland Paris (Day 1)' },
      { date: 'Day 2', activity: 'Disneyland Paris (Day 2)' },
      { date: 'Day 3', activity: 'Parc Astérix' },
      { date: 'Day 4', activity: 'Jardin d’Acclimatation' },
    ],
  },
  {
    country: ['Spain'],
    parks: [
      'PortAventura World',
      'Tibidabo',
      'Parque Warner Madrid',
      'Parque de Atracciones de Madrid',
    ],
    rcdb: [
      'https://rcdb.com/4792.htm',
      'https://rcdb.com/4079.htm',
      'https://rcdb.com/5387.htm',
      'https://rcdb.com/4790.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Fly Copenhagen → Barcelona → Madrid → Copenhagen.\n\n' +
      '• PortAventura: Train from Barcelona Sants (~1h10).\n' +
      '• Tibidabo: Metro + funicular (~30–40 min).\n' +
      '• Parque Warner: Train Atocha → Pinto (~25 min) + shuttle bus (~15 min).\n' +
      '• Parque de Atracciones: Metro line 10 to Batán (~20 min).\n\n' +
      '✅ Entire trip doable by public transport.',
    mapLink:
      "https://www.google.com/maps/dir/Barcelona,+Spain/PortAventura+World/Tibidabo,+Barcelona/Parque+Warner+Madrid/Parque+de+Atracciones+de+Madrid/Madrid,+Spain",
    tripLog: [
      { date: 'Day 1', activity: 'PortAventura World (Day 1)' },
      { date: 'Day 2', activity: 'PortAventura World (Day 2) + Ferrari Land' },
      { date: 'Day 3', activity: 'Tibidabo + Barcelona city' },
      { date: 'Day 4', activity: 'Rest day / travel Barcelona → Madrid' },
      { date: 'Day 5', activity: 'Parque Warner Madrid' },
      { date: 'Day 6', activity: 'Parque de Atracciones de Madrid' },
    ],
  },
  {
    country: ['Germany','Netherlands'],
    parks: ['Phantasialand','Toverland','Movie Park Germany'],
    rcdb: [
      'https://rcdb.com/4872.htm',
      'https://rcdb.com/4900.htm',
      'https://rcdb.com/4869.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Fly Copenhagen → Düsseldorf/Cologne.\n\n' +
      '• Phantasialand: Train Cologne → Brühl (~20 min) + bus (~15 min).\n' +
      '• Toverland: Train to Horst-Sevenum (~1h15) + bus/taxi (~15 min).\n' +
      '• Movie Park Germany: Train to Bottrop (~1h) + bus (~15 min).\n\n' +
      '✅ All reachable by public transport, though a car is faster.',
    mapLink:
      "https://www.google.com/maps/dir/D%C3%BCsseldorf,+Germany/Phantasialand,+Br%C3%BChl,+Germany/Toverland,+Sevenum,+Netherlands/Movie+Park+Germany,+Bottrop,+Germany/D%C3%BCsseldorf,+Germany",
    tripLog: [
      { date: 'Day 1', activity: 'Phantasialand' },
      { date: 'Day 2', activity: 'Toverland' },
      { date: 'Day 3', activity: 'Movie Park Germany' },
    ],
  },
  {
    country: ['Finland'],
    parks: ['Linnanmäki','Särkänniemi','PowerPark'],
    rcdb: [
      'https://rcdb.com/4917.htm',
      'https://rcdb.com/4919.htm',
      'https://rcdb.com/5532.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Fly Copenhagen → Helsinki.\n\n' +
      '• Linnanmäki: Tram/metro (~15 min).\n' +
      '• Särkänniemi: Train Helsinki → Tampere (~1h30).\n' +
      '• PowerPark: Seasonal train dep 08:20 → Härmä arr 11:40. Return dep 18:49 → Helsinki arr 22:35.\n\n' +
      '✅ All reachable without a car if trains are planned.',
    mapLink:
      "https://www.google.com/maps/dir/Helsinki,+Finland/Linnanmäki,+Helsinki/Särkänniemi,+Tampere/PowerPark,+Härmä/Helsinki,+Finland",
    tripLog: [
      { date: 'Day 1', activity: 'Linnanmäki (Helsinki)' },
      { date: 'Day 2', activity: 'Särkänniemi (Tampere)' },
      { date: 'Day 3', activity: 'PowerPark (Day trip by train Härmä)' },
      { date: 'Day 4', activity: 'Helsinki sightseeing / rest day' },
    ],
  },
  {
    country: ['UnitedKingdom'],
    parks: ['Thorpe Park','Chessington World of Adventures','Alton Towers'],
    rcdb: [
      'https://rcdb.com/4814.htm',
      'https://rcdb.com/4798.htm',
      'https://rcdb.com/4796.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Fly Copenhagen → London.\n\n' +
      '• Thorpe Park: Train Waterloo → Staines (30–40 min) + shuttle bus (15 min).\n' +
      '• Chessington: Train Waterloo → Chessington South (35 min) + short walk.\n' +
      '• Alton Towers: Train Euston → Stoke-on-Trent (~1h30) + bus (~1h). Total ~2.5h each way.\n\n' +
      '✅ All parks doable without a car.',
    mapLink:
      "https://www.google.com/maps/dir/London,+UK/Thorpe+Park,+Staines-upon-Thames/Chessington+World+of+Adventures+Resort/Alton+Towers,+Alton,+UK/London,+UK",
    tripLog: [
      { date: 'Day 1', activity: 'Thorpe Park' },
      { date: 'Day 2', activity: 'Chessington World of Adventures' },
      { date: 'Day 3', activity: 'Alton Towers' },
    ],
  },
  {
    country: ['Italy'],
    parks: ['Gardaland','Mirabilandia'],
    rcdb: [
      'https://rcdb.com/4866.htm',
      'https://rcdb.com/4793.htm',
    ],
    startDate: 'undecided',
    endDate: 'undecided',
    status: 'backlog',
    notes:
      'Fly Copenhagen → Milan or Verona.\n\n' +
      '• Gardaland: Train Milan/Verona → Peschiera del Garda (~1h30) + shuttle bus (~5 min).\n' +
      '• Mirabilandia: Train Verona → Bologna → Ravenna (~3–4h) + bus (~20 min).\n' +
      '• Return flight from Bologna or Milan.\n\n' +
      '✅ Entire trip reachable by public transport.',
    mapLink:
      "https://www.google.com/maps/dir/Milan,+Italy/Gardaland,+Castelnuovo+del+Garda/Mirabilandia,+Ravenna/Milan,+Italy",
    tripLog: [
      { date: 'Day 1', activity: 'Gardaland' },
      { date: 'Day 2', activity: 'Travel to Ravenna + Mirabilandia (half day)' },
      { date: 'Day 3', activity: 'Mirabilandia (full day)' },
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
