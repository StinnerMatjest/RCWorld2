import { notFound } from 'next/navigation';
import Image from 'next/image';
import MainPageButton from '@/app/components/MainPageButton';

export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagePath: string;
}

// Fetch the park data by ID
async function getParkById(id: string): Promise<Park | null> {
  const parks: Park[] = [
    {
      id: 1,
      name: 'Toverland',
      continent: 'Europe',
      country: 'Netherlands',
      city: 'Sevenum',
      imagePath: '/images/parks/Toverland.PNG',
    },
    {
      id: 2,
      name: 'Walibi Belgium',
      continent: 'Europe',
      country: 'Belgium',
      city: 'Wavre',
      imagePath: '/images/parks/Walibi Belgium.PNG',
    },
    {
      id: 3,
      name: 'Phantasialand',
      continent: 'Europe',
      country: 'Germany',
      city: 'Brühl',
      imagePath: '/images/parks/Phantasialand.PNG',
    },
  ];

  return parks.find((park) => park.id.toString() === id) || null;
}

// Use Next.js's PageProps for dynamic routes
interface ParkPageProps {
  params: { id: string }; // Expecting the 'id' parameter from the URL
}

export default async function ParkPage({ params }: ParkPageProps) {
  const { id } = params;
  const park = await getParkById(id);

  if (!park) {
    notFound();
  }

  return (
    <div className="park-details">
      <h1 className="text-3xl font-bold">{park?.name}</h1>
      <Image src={park?.imagePath} alt={park?.name} height={100} width={1500} />
      <div>
        <p>
          <strong>Location:</strong> {park?.city}, {park?.country}, {park?.continent}
        </p>
        <p>
          <strong>Details:</strong> More info about the park here...
        </p>
        <MainPageButton />
      </div>
    </div>
  );
}
