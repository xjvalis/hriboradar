// The ~24 well-known scenic/CHKO/national-park entries from
// mobile/src/touristAreas.ts's TOURIST_AREAS list (Šumava..Pálava, before
// that file's ORP administrative-town entries start) - duplicated rather
// than imported because lib/ is Vercel serverless backend code and
// shouldn't depend on mobile/ (a separate app, built/deployed
// independently - see that file's own module comment for where these
// coordinates came from). Used by lib/dailyReport.ts to turn "highest-
// scoring grid point" into a real, recognizable place name for the daily
// report email, without needing the full ~200-entry ORP town list that
// file also carries (fine for a map-tap label, too obscure for a report
// meant to read as "somewhere worth a trip").
export interface ScenicArea {
  name: string;
  lat: number;
  lon: number;
}

export const SCENIC_AREAS: ScenicArea[] = [
  { name: "Šumava", lat: 49.0, lon: 13.5 },
  { name: "Krkonoše", lat: 50.75, lon: 15.583 },
  { name: "Český ráj", lat: 50.5197, lon: 15.1706 },
  { name: "České Švýcarsko", lat: 50.8835, lon: 14.3893 },
  { name: "Kokořínsko", lat: 50.5286, lon: 14.6067 },
  { name: "Křivoklátsko", lat: 49.9589, lon: 13.8806 },
  { name: "Jizerské hory", lat: 50.8333, lon: 15.25 },
  { name: "Žďárské vrchy", lat: 49.6706, lon: 16.0322 },
  { name: "Litovelské Pomoraví", lat: 49.698, lon: 17.118 },
  { name: "Poodří", lat: 49.71, lon: 18.09 },
  { name: "Bílé Karpaty", lat: 48.8575, lon: 17.6747 },
  { name: "Slavkovský les", lat: 50.1083, lon: 12.7833 },
  { name: "Orlické hory", lat: 50.2167, lon: 16.5 },
  { name: "Blaník", lat: 49.6422, lon: 14.8728 },
  { name: "Moravský kras", lat: 49.2781, lon: 16.7342 },
  { name: "Lužické hory", lat: 50.8489, lon: 14.6469 },
  { name: "Labské pískovce", lat: 50.843, lon: 14.289 },
  { name: "Český les", lat: 49.815, lon: 12.4967 },
  { name: "Železné hory", lat: 49.8333, lon: 15.6667 },
  { name: "Broumovsko", lat: 50.61, lon: 16.33 },
  { name: "Beskydy", lat: 49.4472, lon: 18.3259 },
  { name: "Brdy", lat: 49.64, lon: 13.74 },
  { name: "Adršpašsko-teplické skály", lat: 50.6114, lon: 16.115 },
  { name: "Pálava", lat: 48.8314, lon: 16.6742 },
];
