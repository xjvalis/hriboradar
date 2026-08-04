# Rostou?

Appka pro houbaře v ČR — pravděpodobnost růstu konkrétních druhů hub na
konkrétním místě, kombinující počasí, půdu a druhovou skladbu lesa.

## Struktura repa

- `mobile/` — Expo (React Native + TypeScript) mobilní appka
- `api/` — Vercel serverless funkce (backend): počasí/predikce endpointy

Jsou to dva nezávislé projekty ve stejném repu. `mobile/` má vlastní
`package.json`, kořenový `package.json` je jen pro `api/` (Vercel).

## Backend

- `GET /api/predict?lat=&lon=` — stáhne 30 dní srážek a 7 dní teplot z
  [Open-Meteo](https://open-meteo.com/en/docs/chmi-api) (model CHMI ALADIN,
  zdarma, bez klíče) a spočítá API30 index (vážený součet srážek s klesající
  vahou do minulosti) + teplotní korekci. Zatím bez sezónního koeficientu a
  bez shody s druhem houby/dřevinou/půdou — to přijde s species-condition
  tabulkou.

## Vývoj

```bash
# mobilní appka
cd mobile
npm start          # Expo dev server (w = web, a = Android, i = iOS)

# backend lokálně
npx vercel dev      # z kořene repa, potřebuje `vercel login`
```

## Nasazení

- **Vercel**: v nastavení projektu na vercel.com stačí připojit tenhle
  GitHub repo, Root Directory nechat na kořeni (Vercel si `/api` najde sám).
- **Expo/EAS**: `cd mobile && npx eas build` (potřebuje účet na expo.dev).

## Stav

Backend zatím počítá jen vlhkostní část modelu (API30 + teplotní korekce).
Chybí: sezónní koeficient podle druhu, shoda s hostitelským stromem a pH
půdy (potřebuje statickou geo vrstvu z ÚHÚL/OSM a VÚMOP/BPEJ), a samotná
species-condition tabulka pro ~15 klíčových druhů. Mobilní appka je zatím
holý Expo šablona — vizuální systém (Fraunces + Nunito, viz Claude Artifact
mockup z předchozí konverzace) se do ní ještě musí přenést.
