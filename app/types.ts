export interface Park {
    id: number;
    name: string;
    continent: string;
    country: string;
    city: string;
    imagepath: string;
  }
  
  export interface Rating {
    id: number;
    date: string;
    parkAppearance: number;
    bestCoaster: number;
    waterRides: number;
    rideLineup: number;
    food: number;
    snacksAndDrinks: number;
    parkPracticality: number;
    rideOperations: number;
    parkManagement: number;
    overall: number;
    parkId: number;
  }
  
  export interface RollerCoaster {
    id: number;
    name: string;
    year: number;
    manufacturer: string;
    model: string;
    scale: string;
    haveridden: boolean;
    isbestcoaster: boolean;
    rcdbpath: string;
  }
  