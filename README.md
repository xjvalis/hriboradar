# Rostou?

Appka pro houbaře v ČR — pravděpodobnost růstu konkrétních druhů hub na
konkrétním místě, kombinující počasí, půdní vlhkost a druhovou skladbu lesa.

## Struktura repa

- `mobile/` — Expo (React Native + TypeScript) mobilní appka
- `api/` — Vercel serverless funkce (backend)
- `api/data/species.json` — species-condition tabulka pro 15 klíčových druhů
- `dev-server.mjs` — lokální náhrada za `vercel dev` (viz níže)

Jsou to dva nezávislé projekty ve stejném repu. `mobile/` má vlastní
`package.json`, kořenový `package.json` je jen pro `api/` (Vercel).

## Backend

- **`GET /api/forecast?lat=&lon=`** — hlavní endpoint. Pro všech 15 druhů a
  pro každý den od včerejška do +6 dní dopředu spočítá pravděpodobnost růstu
  ze čtyř faktorů:
  - **sezóna** — `season_months`/`season_peak_months` v `species.json`,
    odvozené empiricky z GBIF pozorování pro ČR (ne odhad)
  - **teplota** — průměr posledních dní vs. `temp_range_c` druhu
  - **dny od deště** — najde poslední den s dostatečným srážkovým úhrnem a
    porovná s `days_after_rain` oknem druhu
  - **vlhkost půdy** — skutečné % vody v půdě z Open-Meteo
    (`soil_moisture_3_to_9cm`), ne odhad
  - **shoda s lesem** — dřeviny v okolí z OpenStreetMap/Overpass (kde je
    naimportovaná ÚHÚL typologie, čte se přímo; jinak hrubší
    jehličnatý/listnatý/smíšený) vs. `host_trees` druhu

  Sezóna a shoda s lesem fungují jako tvrdé brány (dubová houba ve
  smrkovém lese nebo mimo sezónu spadne skoro na nulu); teplota/déšť/vlhkost
  se váženě zprůměrují, aby "dobré, ale ne dokonalé" počasí nekolabovalo.

- `GET /api/predict?lat=&lon=` — starší/jednodušší endpoint, jen vlhkostní
  API30 index. `forecast` ho nahrazuje, zůstává pro referenci.

### Co v modelu chybí

- **pH půdy** — VÚMOP/SOWAC-GIS nemá žádnou přímo dotazovatelnou pH vrstvu,
  jen odvozené charakteristiky (hloubka, skeletovitost, sklonitost, kód
  BPEJ). Reálné pH by šlo získat jen dekódováním BPEJ kódu přes tabulku
  hlavních půdních jednotek (HPJ) — to je samostatný výzkumný úkol.
- **Grid pro celou mapu ČR** — `/api/forecast` počítá jeden bod na dotaz.
  Na mapu s barevnými oblastmi po celé ČR potřeba buď grid předpočítaný
  cronem, nebo on-demand podle viditelného výřezu mapy.
- Konstanty (`temp_range_c`, `days_after_rain`, `min_rain_mm`) jsou zatím
  literatura-based odhady, ne kalibrované — časem doladit proti reálným
  NDOP/GBIF nálezům.

## Vývoj

```bash
# 1) backend lokálně (z kořene repa) — plain Node server, ne Vercel CLI,
#    protože ta chce interaktivní `vercel login`
npm run dev:api          # http://localhost:3001

# 2) mobilní appka (v mobile/, v druhém terminálu)
cd mobile
npm run web              # nebo `npm start` pro Android/iOS/Expo Go
```

`mobile/src/api.ts` teď volá natvrdo `http://localhost:3001` — až bude
appka mluvit s reálným Vercel nasazením, tenhle base URL se přepne.

## Nasazení

- **Vercel**: v nastavení projektu na vercel.com stačí připojit tenhle
  GitHub repo, Root Directory nechat na kořeni (Vercel si `/api` najde sám).
- **Expo/EAS**: `cd mobile && npx eas build` (potřebuje účet na expo.dev).

## Externí závislosti (všechno zdarma, bez klíče)

- [Open-Meteo](https://open-meteo.com/en/docs/chmi-api) — počasí + půdní
  vlhkost (CC BY 4.0, nutná atribuce)
- [Overpass API](https://overpass-api.de/) (OpenStreetMap) — dřevinná
  skladba lesa. `overpass.kumi.systems` byl v testování nejspolehlivější;
  veřejné instance chtějí smysluplný User-Agent, jinak vrací 406/429.
  **Pozor:** tohle je pro prototypování v pořádku, ale pro produkční provoz
  s reálným provozem by to chtělo vlastní Overpass instanci nebo
  předpočítaný extrakt — veřejné instance nejsou spolehlivé pod zátěží.
- [GBIF](https://www.gbif.org/) — použito jednorázově k odvození
  `season_months` v `species.json` (`api/data/gbif_phenology_raw.json`),
  za běhu appky se nevolá

## Stav

Funguje end-to-end: appka (`mobile/App.tsx`) reálně volá `/api/forecast`
a zobrazuje 15 druhů seřazených podle živě spočítané pravděpodobnosti,
ve vizuálním systému z Claude Artifact mockupu (Fraunces + Nunito,
skóre-pilulky podle barvy).

Další logické kroky: pH půdy (nebo rozhodnout se bez něj obejít),
grid pro mapu ČR, detail obrazovka druhu s podmínkami, uložená místa +
notifikace, a nasazení na Vercel/EAS.
