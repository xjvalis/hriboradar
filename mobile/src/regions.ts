// Curated, real Czech mycology-relevant regions (mostly CHKO - chráněné
// krajinné oblasti - chosen for genuine forest cover and known mushroom
// grounds, not invented). Used to drive "Kam dnes?" by running the real
// forecast engine against each center point and ranking by actual
// computed probability - no fabricated scores.
export interface Region {
  id: string;
  name: string;
  area: string;
  lat: number;
  lon: number;
}

export const REGIONS: Region[] = [
  { id: "brdy", name: "Brdy", area: "CHKO Brdy", lat: 49.688, lon: 13.9 },
  { id: "krivoklatsko", name: "Křivoklátsko", area: "CHKO Křivoklátsko", lat: 50.0, lon: 13.767 },
  { id: "sumava", name: "Šumava", area: "NP Šumava", lat: 49.1, lon: 13.6 },
  { id: "krkonose", name: "Krkonoše", area: "NP Krkonoše", lat: 50.73, lon: 15.7 },
  { id: "jizerky", name: "Jizerské hory", area: "CHKO Jizerské hory", lat: 50.8, lon: 15.25 },
  { id: "beskydy", name: "Beskydy", area: "CHKO Beskydy", lat: 49.5, lon: 18.4 },
  { id: "ceskesvycarsko", name: "České Švýcarsko", area: "NP České Švýcarsko", lat: 50.85, lon: 14.25 },
  { id: "zdarskevrchy", name: "Žďárské vrchy", area: "CHKO Žďárské vrchy", lat: 49.583, lon: 15.933 },
];
