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

// Hardcode park data for now (no need to fetch dynamically)
const park: Park = {
  id: 1,
  name: 'Toverland',
  continent: 'Europe',
  country: 'Netherlands',
  city: 'Sevenum',
  imagePath: '/images/parks/Toverland.PNG',
};

export default function ParkPage() {
  return (
    <div className="park-details">
      <h1 className="text-3xl font-bold">{park.name}</h1>
      <Image src={park.imagePath} alt={park.name} height={100} width={1500} />
      <div>
        <p>
          <strong>Location:</strong> {park.city}, {park.country}, {park.continent}
        </p>
        <p>
          <strong>Details:</strong> More info about the park here...
        </p>
        <MainPageButton />
      </div>
    </div>
  );
}
