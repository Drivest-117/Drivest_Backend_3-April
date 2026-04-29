Právne obrazovky registrácie v aplikácii
Aktuálny dvojfázový model registrácie
Verzia
Verzia 1.1
Naposledy aktualizované
5. apríla 2026
Pripravené pre
Drivest Limited

Účel dokumentu
Tento interný dokument definuje aktuálny proces právneho schvaľovania a udeľovania povolení pri registrácii schválený pre Drivest. Odráža implementáciu, ktorá sa v súčasnosti nachádza v aplikácii, a nahrádza staršie znenia, ktoré plne neopisovali model uloženého súhlasu.

1. Cieľ
Tento dokument definuje aktuálny proces registrácie v aplikácii na účely právneho súhlasu a povolení. Schválený model využíva dve fázy namiesto dlhšej viacobrazovkovej právnej cesty. Účelom je znížiť trenie pre používateľa pri súčasnom zachovaní platného právneho potvrdenia a samostatne zaznamenaných volieb, ktoré môžu byť vynútené a preukázané backendom.

2. Fáza 1: Kombinovaný právny súhlas
Fáza 1 je povinnou vstupnou bránou do aplikácie.

Aktuálny názov:
Skôr než začnete

Aktuálny text hlavnej časti:
Drivest je platforma na podporu vodičov. Poskytuje iba usmernenia a nenahrádza váš úsudok, vášho inštruktora ani zákon.

Vždy musíte dodržiavať dopravné značky, dopravné predpisy a reálne podmienky na ceste. Ak je niečo v aplikácii v rozpore so situáciou na ceste, riaďte sa situáciou na ceste.

Pokračovaním potvrdzujete, že máte 16 alebo viac rokov, že rozumiete a akceptujete bezpečnostné upozornenie a že súhlasíte so Zmluvnými podmienkami a Zásadami ochrany osobných údajov.

Požadované ovládacie prvky:
- Zobraziť podmienky
- Zobraziť ochranu súkromia
- jedno povinné začiarkavacie políčko
- Tlačidlo Pokračovať deaktivované, kým nie je vybraté začiarkavacie políčko

Aktuálny text začiarkavacieho políčka:
Potvrdzujem, že mám 16 alebo viac rokov, rozumiem bezpečnostnému upozorneniu a súhlasím so Zmluvnými podmienkami a Zásadami ochrany osobných údajov.

Táto fáza vytvára autoritatívny záznam o právnom súhlase.
Backend by mal ukladať:
- termsVersion (verzia podmienok)
- privacyVersion (verzia ochrany súkromia)
- safetyVersion (verzia bezpečnosti)
- ageConfirmed (potvrdenie veku)
- safetyAccepted (akceptovanie bezpečnosti)
- časová pečiatka súhlasu
- sourceScreen (zdrojová obrazovka)
- verzia aplikácie
- platforma
- identifikátor inštalácie, ak je k dispozícii

3. Fáza 2: Povolenia a voliteľný súhlas
Fáza 2 je obrazovka prevádzkových povolení.

Aktuálny názov:
Povolenia

Aktuálny text hlavnej časti:
Drivest potrebuje určité povolenia, aby správne fungoval. Poloha sa používa pre trasy a navigáciu, keď je aktívna. Analytika pomáha zlepšovať výkon a spoľahlivosť a je voliteľná. Upozornenia vás informujú o rezerváciách a aktivite.

Požadované ovládacie prvky:
- akcia polohy, ktorá spustí natívny proces povolenia polohy
- samostatné akcie na povolenie a nepovolenie analytiky
- samostatné akcie na povolenie a zakázanie upozornení
- Tlačidlo Pokračovať

Aktuálna sekcia polohy:
Názov: Poloha
Správa: Poloha sa používa pre trasy a navigáciu, keď je aktívna.
Tlačidlo: Požiadať o prístup k polohe

Aktuálne stavy stavu polohy:
- Prístup k polohe je už pre Drivest povolený.
- Prístup k polohe je momentálne zamietnutý. Môžete pokračovať, ale funkcie trasy zostanú obmedzené, kým ho nepovolíte.
- Poloha je nateraz voliteľná, ale funkcie trasy a parkovania ju vyžadujú, keď ich používate.

Aktuálna sekcia analytiky:
Názov: Voliteľná analytika
Správa: Analytika pomáha zlepšovať výkon a spoľahlivosť a je voliteľná.
Akcie:
- Povoliť analytiku
- Nepovoliť

Aktuálna sekcia upozornení:
Názov: Voliteľné upozornenia
Správa: Upozornenia vás informujú o rezerváciách a aktivite.
Akcie:
- Povoliť upozornenia
- Teraz nie

4. Mapovanie backendu
Fáza 1 by mala minimálne vytvárať alebo aktualizovať záznamy v:
- legal_document_versions (verzie právnych dokumentov)
- user_legal_acceptances (právne súhlasy používateľov)

Fáza 2 by mala minimálne vytvárať alebo aktualizovať záznamy o aktuálnej voľbe a histórii pre:
- analyticsChoice (voľba analytiky)
- notificationsChoice (voľba upozornení)
- locationChoice (voľba polohy)

Neskoršie zmeny nastavení sa musia zapísať späť do rovnakého modelu dodržiavania súladu na backende, aby spoločnosť Drivest mohla preukázať pôvodnú voľbu pri registrácii, ako aj neskoršie zmeny alebo odvolania, ak je to uplatniteľné.

5. Prísne pravidlá
Žiadne začiarkavacie políčko nesmie byť vopred vybraté.
Aplikácia nesmie umožniť používateľovi obísť fázu právneho súhlasu a pokračovať do produktu bez súhlasu.
Zmluvné podmienky a Zásady ochrany osobných údajov musia byť prístupné z právnej fázy.
Bezpečnostné upozornenie musí zostať súčasťou textu právneho súhlasu, pokiaľ sa nezmení právne stanovisko a verzie sa podľa toho neaktualizujú.
Fáza povolení nesmie spájať analytiku, upozornenia a polohu do jedného nejasného súhlasu.
Každá voľba musí zostať samostatne zrozumiteľná a samostatne zaznamenateľná.
Akákoľvek podstatná zmena právneho textu, modelu povolení alebo sledovaného správania by mala spustiť aktualizáciu verzie a opätovné udelenie súhlasu, ak sa to vyžaduje.
