Rámec pro oprávnění a souhlas
Mobilní oprávnění, volitelný souhlas a model protokolování Drivest
Verze
Verze 1.1
Poslední aktualizace
5. dubna 2026
Připraveno pro
Drivest Limited

Účel dokumentu
Tento interní dokument definuje, jak by se nyní mělo v aplikaci žádat o oprávnění a souhlas, aby mobilní proces zůstal plynulý, právně obhajitelný a v souladu s aktuálními webovými stránkami, chováním aplikace a backendovým modelem protokolování.

1. Účel tohoto dokumentu
Tento dokument stanovuje aktuální rámec pro oprávnění a souhlas pro Drivest. Jeho cílem je zachovat použitelnost mobilního prostředí a zároveň jej udržet v souladu s aktivní právní pozicí, ochranou soukromí a požadavky obchodů s aplikacemi.
Základní princip zůstává stejný. Drivest by měl žádat pouze o oprávnění, která jsou nezbytná, měl by žádat v kontextu, neměl by předem aktivovat volitelné volby a měl by být schopen prokázat, co a kdy si uživatel zvolil.

2. Současný model oprávnění při onboardingu
Drivest nyní používá dvoufázový model onboardingu.

Fáze 1 řeší povinné právní přijetí. Zahrnuje:
- Přijetí Smluvních podmínek
- Přijetí Zásad ochrany osobních údajů
- Potvrzení věku
- Potvrzení bezpečnostního upozornění

Fáze 2 řeší provozní oprávnění a volitelný souhlas. Představuje:
- Přístup k poloze
- Volbu analytiky
- Volbu oznámení

Poloha je provozně důležitá pro funkce související s trasami a parkováním, ale stále zůstává oprávněním operačního systému. Analytika je volitelná. Oznámení jsou volitelná.

3. Fáze povinného právního přijetí
První fáze onboardingu musí jasně uvést, že Drivest je platforma pro podporu řízení, která poskytuje pouze pokyny.
Musí jasně uvést, že Drivest nenahrazuje úsudek uživatele, instruktora řízení ani zákon.
Fáze musí uživateli umožnit přístup ke Smluvním podmínkám a Zásadám ochrany osobních údajů předtím, než bude pokračovat.
Uživatel musí před pokračováním aktivně zaškrtnout políčko.
Aplikace nesmí pokračovat, dokud není toto políčko vybráno.
Stejná fáze zachycuje potvrzení věku a potvrzení bezpečnosti jako součást události přijetí.
Backend musí uložit verzi přijatých podmínek, verzi soukromí, verzi bezpečnosti, časové razítko přijetí, zdrojovou obrazovku, verzi aplikace, platformu a identifikátor instalace, je-li k dispozici.

4. Oprávnění k poloze
Poloha by měla být vyžádána prostřednictvím akce v kontextu a poté prostřednictvím dialogového okna oprávnění operačního systému.
Vysvětlující text by měl zůstat v souladu s aktuální pozicí ochrany soukromí:
- poloha se používá pro trasy a navigaci, když jsou aktivní
- funkce tras a parkování potřebují polohu, když se je uživatel pokusí použít
- Drivest by neměl naznačovat, že na serverech je ukládána nepřetržitá historie polohy na pozadí

Pokud uživatel odmítne oprávnění k poloze, aplikace může omezit funkce související s trasami a parkováním, ale neměla by blokovat nesouvisející výukové funkce.
Aplikace by měla uložit efektivní volbu polohy uživatele jako jednu z následujících:
- povolit (allow)
- zamítnout (deny)
- přeskočit (skip)

5. Souhlas s analytikou
Analytika musí zůstat volitelná v případech, kdy je zamýšleným právním základem souhlas.
Chování analytiky by mělo zůstat vypnuté, dokud uživatel neprovede potvrzující volbu.
Uživatelské rozhraní by mělo analytiku popsat jako nástroj pomáhající zlepšovat výkon a spolehlivost.
Rozhraní nesmí naznačovat, že analytika je vyžadována k používání základní služby.
Backend by měl uložit:
- analyticsChoice (volba analytiky)
- timestamp (časové razítko)
- source surface (zdrojový povrch)
- app version (verze aplikace)
- platform (platforma)
- install identifier (identifikátor instalace, je-li k dispozici)

6. Souhlas s oznámeními
Oznámení musí zůstat volitelná.
Výzva by měla popsat jejich provozní účel, včetně aktualizací, rezervací, připomenutí a důležitých aktivit na účtu, kde je to relevantní.
Oznámení nesmí být ve výchozím nastavení předem povolena.
Aplikace by měla ukládat volbu preferencí v aplikaci odděleně od výsledku oprávnění operačního systému.
Backend by měl uložit:
- notificationsChoice (volba oznámení)
- timestamp (časové razítko)
- source surface (zdrojový povrch)
- app version (verze aplikace)
- platform (platforma)
- install identifier (identifikátor instalace, je-li k dispozici)

7. Požadavky na protokolování
Systém musí protokolovat událost právního přijetí odděleně od voleb oprávnění a souhlasu.
Backend by měl minimálně ukládat:
- verzi podmínek
- verzi soukromí
- verzi bezpečnosti
- časové razítko přijetí
- stav potvrzení věku
- volbu analytiky
- časové razítko analytiky
- volbu oznámení
- časové razítko oznámení
- volbu polohy
- časové razítko polohy
- zdrojovou obrazovku nebo zdrojový povrch
- verzi aplikace
- platformu
- identifikátor instalace, je-li k dispozici

8. Požadavek na aktuální implementaci
Rámec oprávnění musí odpovídat skutečnému chování aplikace.
Pokud právní tok popisuje analytiku jako volitelnou, musí být analytika v implementaci skutečně volitelná.
Pokud aplikace ukládá volbu polohy jako součást onboardingu, musí být tento datový model zohledněn v interní dokumentaci o shodě s předpisy.
Pokud aplikace později přidá nové oprávnění, nové chování sledování nebo nepřetržité zpracování polohy na pozadí, musí být rámec oprávnění, zásady ochrany osobních údajů, texty v aplikaci a prohlášení v obchodech aktualizovány společně před vydáním.

9. Konečný přehled oprávnění
Oprávnění nebo volba
Konečná pozice

Povinné kombinované právní potvrzení
Přijetí podmínek, přijetí soukromí, potvrzení věku a potvrzení bezpečnosti. Vyžadováno předtím, než uživatel může vstoupit do produktu.

Poloha
Vyžadována v kontextu pro podporu tras, navigace a funkcí závislých na poloze. Řízeno operačním systémem, ale aplikace také ukládá zaznamenaný stav volby.

Analytika
Volitelný souhlas. Musí zůstat vypnutá, dokud uživatel neprovede potvrzující volbu.

Oznámení
Volitelný souhlas. Nesmí být předem povolena. Konečnou autoritou pro oprávnění zůstává nastavení zařízení, zatímco aplikace ukládá volbu preferencí uživatele v aplikaci.
