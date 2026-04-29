Právní obrazovky onboardingu v aplikaci
Současný dvoufázový model onboardingu
Verze
Verze 1.1
Poslední aktualizace
5. dubna 2026
Připraveno pro
Drivest Limited

Účel dokumentu
Tento interní dokument definuje aktuální právní a schvalovací proces (onboarding flow) schválený pro Drivest. Odráží implementaci, která je nyní v aplikaci přítomna, a nahrazuje starší znění, která plně nepopisovala model uloženého souhlasu.

1. Cíl
Tento dokument definuje aktuální proces onboardingu v aplikaci pro přijetí právních podmínek a oprávnění. Schválený model používá dvě fáze namísto delší právní cesty o více obrazovkách. Účelem je snížit tření na straně uživatele a zároveň zachovat platné právní potvrzení a samostatně zaznamenané volby, které mohou být vymáhány a prokazovány backendem.

2. Fáze 1: Kombinované právní přijetí
Fáze 1 je povinnou vstupní branou do aplikace.

Aktuální název:
Než začnete

Aktuální text těla:
Drivest je platforma pro podporu řízení. Poskytuje pouze pokyny a nenahrazuje váš úsudek, vašeho instruktora ani zákon.

Vždy se musíte řídit dopravním značením, dopravními předpisy a reálnými podmínkami. Pokud je v aplikaci cokoli v rozporu se situací na silnici, řiďte se situací na silnici.

Pokračováním potvrzujete, že je vám 16 let nebo více, že rozumíte bezpečnostnímu upozornění a přijímáte jej a že souhlasíte se Smluvními podmínkami a Zásadami ochrany osobních údajů.

Požadované ovládací prvky:
- Zobrazit Podmínky
- Zobrazit Soukromí
- jedno povinné zaškrtávací políčko
- Tlačítko Pokračovat (deaktivováno, dokud není zaškrtnuto políčko)

Aktuální text zaškrtávacího políčka:
Potvrzuji, že je mi 16 let nebo více, rozumím bezpečnostnímu upozornění a souhlasím se Smluvními podmínkami a Zásadami ochrany osobních údajů.

Tato fáze vytváří autoritativní záznam o právním přijetí.
Backend by měl uložit:
- termsVersion (verze podmínek)
- privacyVersion (verze soukromí)
- safetyVersion (verze bezpečnosti)
- ageConfirmed (potvrzení věku)
- safetyAccepted (přijetí bezpečnosti)
- acceptance timestamp (časové razítko přijetí)
- sourceScreen (zdrojová obrazovka)
- app version (verze aplikace)
- platform (platforma)
- install identifier (identifikátor instalace, je-li k dispozici)

3. Fáze 2: Oprávnění a volitelný souhlas
Fáze 2 je obrazovka provozních oprávnění.

Aktuální název:
Oprávnění

Aktuální text těla:
Drivest potřebuje určitá oprávnění, aby správně fungoval. Poloha se používá pro trasy a navigaci, když jsou aktivní. Analytika pomáhá zlepšovat výkon a spolehlivost a je volitelná. Oznámení vás informují o rezervacích a aktivitě.

Požadované ovládací prvky:
- akce pro polohu, která spouští nativní proces oprávnění k poloze
- samostatné akce pro povolení a nepovolení analytiky
- samostatné akce pro povolení a odložení oznámení
- Tlačítko Pokračovat

Aktuální sekce polohy:
Název: Poloha
Zpráva: Poloha se používá pro trasy a navigaci, když jsou aktivní.
Tlačítko: Požádat o přístup k poloze

Aktuální stavy přístupu k poloze:
- Přístup k poloze je již pro Drivest povolen.
- Přístup k poloze je aktuálně zamítnut. Můžete pokračovat, ale funkce tras zůstanou omezené, dokud jej nepovolíte.
- Poloha je prozatím volitelná, ale funkce tras a parkování ji potřebují, když je používáte.

Aktuální sekce analytiky:
Název: Volitelná analytika
Zpráva: Analytika pomáhá zlepšovat výkon a spolehlivost a je volitelná.
Akce:
- Povolit analytiku
- Nepovolovat

Aktuální sekce oznámení:
Název: Volitelná oznámení
Zpráva: Oznámení vás informují o rezervacích a aktivitě.
Akce:
- Povolit oznámení
- Nyní ne

4. Mapování na backend
Fáze 1 by měla minimálně vytvořit nebo aktualizovat záznamy v:
- legal_document_versions
- user_legal_acceptances

Fáze 2 by měla minimálně vytvořit nebo aktualizovat záznamy o aktuální volbě a historii pro:
- analyticsChoice
- notificationsChoice
- locationChoice

Pozdější změny nastavení musí být zapsány zpět do stejného backendového modelu shody s předpisy, aby společnost Drivest mohla prokázat jak původní volbu při onboardingu, tak pozdější změny nebo odvolání, kde je to relevantní.

5. Tvrdá pravidla
Žádné zaškrtávací políčko nesmí být předem vybráno.
Aplikace nesmí dovolit uživateli obejít fázi právního přijetí a pokračovat do produktu bez souhlasu.
Smluvní podmínky a Zásady ochrany osobních údajů musí být přístupné z právní fáze.
Bezpečnostní upozornění musí zůstat součástí textu pro právní přijetí, pokud se právní pozice nezmění a verze nejsou odpovídajícím způsobem aktualizovány.
Fáze oprávnění nesmí sdružovat analytiku, oznámení a polohu do jednoho vágního souhlasu.
Každá volba musí zůstat samostatně srozumitelná a samostatně zaznamenatelná.
Jakákoli podstatná změna právního textu, modelu oprávnění nebo sledovaného chování by měla vyvolat aktualizaci verze a opětovné přijetí, kde je to vyžadováno.
