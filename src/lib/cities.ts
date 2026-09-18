export type City = { name: string; lat: number; lng: number };

export const FR_CITIES: City[] = [
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Neuilly-sur-Seine", lat: 48.8846, lng: 2.2686 },
  { name: "Boulogne-Billancourt", lat: 48.8432, lng: 2.2399 },
  { name: "Rueil-Malmaison", lat: 48.8765, lng: 2.1897 },
  { name: "Créteil", lat: 48.7904, lng: 2.4556 },
  { name: "Sarcelles", lat: 48.9974, lng: 2.3781 },
  { name: "Saint-Denis", lat: 48.9362, lng: 2.3574 },
  { name: "Vincennes", lat: 48.8479, lng: 2.437 },
  { name: "Levallois-Perret", lat: 48.8932, lng: 2.2879 },
  { name: "Marseille", lat: 43.2965, lng: 5.3698 },
  { name: "Lyon", lat: 45.764, lng: 4.8357 },
  { name: "Strasbourg", lat: 48.5734, lng: 7.7521 },
  { name: "Nice", lat: 43.7102, lng: 7.262 },
  { name: "Toulouse", lat: 43.6047, lng: 1.4442 },
  { name: "Bordeaux", lat: 44.8378, lng: -0.5792 },
  { name: "Lille", lat: 50.6292, lng: 3.0573 },
  { name: "Nantes", lat: 47.2184, lng: -1.5536 },
  { name: "Montpellier", lat: 43.6108, lng: 3.8767 },
  { name: "Aix-en-Provence", lat: 43.5297, lng: 5.4474 },
];

export function findCity(name: string): City | undefined {
  const n = name.trim().toLowerCase();
  return FR_CITIES.find((c) => c.name.toLowerCase() === n);
}
