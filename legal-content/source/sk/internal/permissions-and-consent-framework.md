Rámec pre povolenia a súhlas
Povolenia v mobilnej aplikácii Drivest, voliteľný súhlas a model protokolovania
Verzia
Verzia 1.1
Naposledy aktualizované
5. apríla 2026
Pripravené pre
Drivest Limited

Účel dokumentu
Tento interný dokument definuje, ako by sa mali v aplikácii vyžadovať povolenia a súhlas, aby proces v mobilnej aplikácii zostal plynulý, právne obhájiteľný a v súlade s aktuálnou webovou stránkou, správaním aplikácie a modelom protokolovania na backende.

1. Účel tohto dokumentu
Tento dokument stanovuje aktuálny rámec pre povolenia a súhlas pre Drivest. Jeho cieľom je zachovať použiteľnosť mobilnej aplikácie pri súčasnom zosúladení s aktívnou právnou pozíciou, ochranou súkromia a požiadavkami obchodov s aplikáciami.
Základný princíp zostáva rovnaký. Drivest by mal žiadať len o povolenia, ktoré sú nevyhnutné, mal by o ne žiadať v kontexte, nemal by vopred povoľovať voliteľné možnosti a mal by byť schopný preukázať, čo si používateľ vybral a kedy.

2. Aktuálny model povolení pri registrácii
Drivest teraz používa dvojfázový model registrácie.

Fáza 1 rieši povinný právny súhlas. Zahŕňa:
- súhlas so Zmluvnými podmienkami
- súhlas so Zásadami ochrany osobných údajov
- potvrdenie veku
- potvrdenie bezpečnostného upozornenia

Fáza 2 rieši prevádzkové povolenia a voliteľný súhlas. Predstavuje:
- prístup k polohe
- voľbu analytiky
- voľbu upozornení

Poloha je prevádzkovo dôležitá pre funkcie súvisiace s trasami a parkovaním, ale stále zostáva povolením operačného systému. Analytika je voliteľná. Upozornenia sú voliteľné.

3. Fáza povinného právneho súhlasu
Prvá fáza registrácie musí jasne uvádzať, že Drivest je platforma na podporu jazdy, ktorá poskytuje iba usmernenia.
Musí jasne uvádzať, že Drivest nenahrádza úsudok používateľa, inštruktora jazdy ani zákon.
Táto fáza musí poskytnúť prístup k Zmluvným podmienkam a Zásadám ochrany osobných údajov predtým, ako používateľ pokračuje.
Používateľ musí pred pokračovaním aktívne začiarknuť políčko.
Aplikácia nesmie pokračovať, kým toto políčko nie je vybraté.
Rovnaká fáza zaznamenáva potvrdenie veku a potvrdenie bezpečnosti ako súčasť udalosti súhlasu.
Backend musí ukladať verziu schválených podmienok, verziu zásad ochrany súkromia, verziu bezpečnosti, časovú pečiatku súhlasu, zdrojovú obrazovku, verziu aplikácie, platformu a identifikátor inštalácie, ak je k dispozícii.

4. Povolenie polohy
Poloha by mala byť vyžiadaná prostredníctvom akcie v kontexte a následne prostredníctvom dialógového okna povolenia operačného systému.
Vysvetľujúce znenie by malo zostať v súlade s aktuálnou pozíciou v oblasti ochrany súkromia:
- poloha sa používa pre trasy a navigáciu, keď je aktívna
- funkcie trasy a parkovania potrebujú polohu, keď sa ich používateľ pokúša použiť
- Drivest by nemal naznačovať, že na serveroch sa ukladá nepretržitá história polohy na pozadí

Ak používateľ odmietne povolenie polohy, aplikácia môže obmedziť funkcie súvisiace s trasou a parkovaním, ale nemala by blokovať nesúvisiace vzdelávacie funkcie.
Aplikácia by mala uložiť efektívnu voľbu polohy používateľa ako jednu z možností:
- povoliť
- zamietnuť
- preskočiť

5. Súhlas s analytikou
Analytika musí zostať voliteľná tam, kde je zamýšľaným právnym základom súhlas.
Správanie analytiky by malo zostať vypnuté, kým používateľ neurobí súhlasnú voľbu.
Používateľské rozhranie by malo analytiku opísať ako pomoc pri zlepšovaní výkonu a spoľahlivosti.
Rozhranie nesmie naznačovať, že analytika je potrebná na používanie základnej služby.
Backend by mal ukladať:
- voľbu analytiky (analyticsChoice)
- časovú pečiatku
- zdrojový povrch
- verziu aplikácie
- platformu
- identifikátor inštalácie, ak je k dispozícii

6. Súhlas s upozorneniami
Upozornenia musia zostať voliteľné.
Výzva by mala opísať ich prevádzkový účel vrátane aktualizácií, rezervácií, pripomienok a dôležitej aktivity na účte, ak je to relevantné.
Upozornenia nesmú byť vopred povolené ako predvolené.
Aplikácia by mala ukladať voľbu preferencií v aplikácii oddelene od výsledku povolenia operačného systému.
Backend by mal ukladať:
- voľbu upozornení (notificationsChoice)
- časovú pečiatku
- zdrojový povrch
- verziu aplikácie
- platformu
- identifikátor inštalácie, ak je k dispozícii

7. Požiadavky na protokolovanie
Systém musí protokolovať udalosť právneho súhlasu oddelene od volieb povolení a súhlasu.
Backend by mal minimálne ukladať:
- verziu podmienok
- verziu ochrany súkromia
- verziu bezpečnosti
- časovú pečiatka súhlasu
- stav potvrdenia veku
- voľbu analytiky
- časovú pečiatku analytiky
- voľbu upozornení
- časovú pečiatku upozornení
- voľbu polohy
- časovú pečiatku polohy
- zdrojovú obrazovku alebo zdrojový povrch
- verziu aplikácie
- platformu
- identifikátor inštalácie, ak je k dispozícii

8. Požiadavka na aktuálnu implementáciu
Rámec povolení sa musí zhodovať so skutočným správaním aplikácie.
Ak právny proces opisuje analytiku ako voliteľnú, analytika musí byť v implementácii skutočne voliteľná.
Ak aplikácia ukladá voľbu polohy ako súčasť registrácie, tento dátový model sa musí odraziť v internej dokumentácii o dodržiavaní súladu.
Ak aplikácia neskôr pridá nové povolenie, nové správanie sledovania alebo nepretržité spracovanie polohy na pozadí, rámec povolení, zásady ochrany osobných údajov, text v aplikácii a deklarácie v obchodoch musia byť pred vydaním spoločne aktualizované.

9. Záverečný inventár povolení
Povolenie alebo voľba
Konečná pozícia

Povinné kombinované právne potvrdenie
Súhlas s podmienkami, súhlas s ochranou súkromia, potvrdenie veku a potvrdenie bezpečnosti. Vyžaduje sa predtým, ako používateľ môže vstúpiť do produktu.

Poloha
Vyžaduje sa v kontexte na podporu trás, navigácie a funkcií závislých od polohy. Riadené operačným systémom, ale aplikácia ukladá aj zaznamenaný stav voľby.

Analytika
Voliteľný súhlas. Musí zostať vypnutá, kým používateľ neurobí súhlasnú voľbu.

Upozornenia
Voliteľný súhlas. Nesmú byť vopred povolené. Nastavenia zariadenia zostávajú konečnou autoritou pre povolenia, zatiaľ čo aplikácia ukladá voľbu preferencií používateľa v aplikácii.
