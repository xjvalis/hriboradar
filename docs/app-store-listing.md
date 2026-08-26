# App Store Connect - listing draft

Copy-paste source for the App Store Connect app record. Not used by any
build process - just a reference so this doesn't need to be re-typed from
scratch in the App Store Connect UI.

## App name (max 30 chars)
```
Hřiboradar
```

## Subtitle (max 30 chars)
```
Kdy a kde rostou houby
```

## Promotional text (max 170 chars, editable anytime without a new review)
```
Houbařský index podle skutečného počasí, sezóny a typu lesa u vás - ne
obecná tabulka, ale předpověď na míru vašemu místu.
```

## Description (max 4000 chars)
```
Hřiboradar spočítá, jak velká je dnes šance najít houby - podle skutečného
počasí, ročního období a typu lesa v okolí, ne podle obecné tabulky.

CO APLIKACE UMÍ
• Houbový index pro vaše místo - dnes a na 7 dní dopředu
• Mapa celé ČR obarvená podle šance na nález, les po lese
• Atlas hub se sezónním přehledem, kdy má který druh vrchol
• Uložená místa (chalupa, oblíbený les) s vlastními upozorněními
• Sledování konkrétních druhů - upozorníme, když jim začíná sezóna
• Zápis vlastních pozorování, které appku dál zpřesňují

JAK TO POČÍTÁME
Model kombinuje aktuální a předpovídané počasí, vlhkost půdy, dny od
posledního vydatného deště a skutečné složení okolního lesa (jaké
stromy tam rostou) pro každý jednotlivý druh zvlášť - hřib potřebuje
jiné podmínky než liška nebo václavka.

Houbařina je sezónní - appka vás na to nenechá zapomenout. Jednou za
čas přijde tip, co má zrovna sezónu, nebo že se blíží ideální podmínky
u vašeho uloženého místa. Ne spam, jen občasné připomenutí.

Appka nenahrazuje jistotu při určování hub - u druhů se zaměnitelnými
jedovatými příbuznými (např. muchomůrka růžovka, smrž, václavka) vždy
najdete konkrétní varování a rozlišovací znaky přímo v detailu druhu.
Bez jistoty v určení nesbírejte.
```

## Keywords (max 100 chars, comma-separated)
```
houby,houbaření,hřiby,lišky,předpověď,počasí,mapa,atlas hub,sezóna,mykologie,sběr hub,houbař
```
(92 characters - fits under the 100-char limit)

## Support URL (required)
```
https://hriboradar.app/support.html
```
(still served from rostou-delta.vercel.app until the hriboradar.app domain is live in Vercel - see api.ts's PRODUCTION_API_BASE comment)

## Marketing URL (optional)
```
(none yet - leave blank, or reuse the support URL)
```

## Privacy Policy URL (required)
```
https://hriboradar.app/privacy.html
```

## Category
Primary: Food & Drink -or- Weather -or- Lifestyle - Food & Drink probably
fits best (foraging/mushroom apps commonly list there), Weather is
defensible too since the forecast is the core mechanic. Worth deciding
based on what similar foraging apps use, not guessed here.

## Age rating
Expect 4+ - no objectionable content. The species detail's edibility/
lookalike warnings are safety information, not content that raises the
rating.

## Copyright
```
(need the legal name/entity to put here - "© 2026 <name>")
```

---

## Still open (not filled in above - need your input)
- Category: Food & Drink vs Weather vs Lifestyle
- Copyright holder name
- Screenshots (need a real device/simulator build - can't produce these
  without running the actual app, which this environment can't do)
