Engedélyezési és Hozzájárulási Keretrendszer
Drivest mobil engedélyek, opcionális hozzájárulás és naplózási modell
Verzió
1.1-es verzió
Utoljára frissítve
2026. április 5.
Készült a
Drivest Limited részére

Dokumentum célja
Ez a belső dokumentum határozza meg, hogyan kell az engedélyeket és a hozzájárulást kérni az alkalmazásban annak érdekében, hogy a mobil folyamat továbbra is zökkenőmentes, jogilag védhető maradjon, és összhangban legyen a jelenlegi weboldallal, az alkalmazás viselkedésével és a backend naplózási modellel.

1. A dokumentum célja
Ez a dokumentum rögzíti a Drivest jelenlegi engedélyezési és hozzájárulási keretrendszerét. Célja, hogy a mobil élmény használható maradjon, miközben igazodik az aktív jogi, adatvédelmi és alkalmazásbolt-pozícióhoz.
Az alapelv változatlan marad. A Drivest csak a szükséges engedélyeket kérheti, azokat kontextusban kell kérnie, nem engedélyezheti előre az opcionális választásokat, és képesnek kell lennie igazolni, hogy a felhasználó mit és mikor választott.

2. Jelenlegi regisztrációs engedélyezési modell
A Drivest jelenleg kétlépcsős regisztrációs modellt használ.

Az 1. szakasz a kötelező jogi elfogadást kezeli. Ez a következőkre terjed ki:
- Felhasználási feltételek elfogadása
- Adatvédelmi szabályzat elfogadása
- életkor megerősítése
- biztonsági közlemény tudomásulvétele

A 2. szakasz a műveleti engedélyeket és az opcionális hozzájárulást kezeli. Ekkor jelenik meg:
- helyhozzáférés
- analitikai választás
- értesítési választás

A helymeghatározás műveletileg fontos az útvonal- és parkolással kapcsolatos funkciókhoz, de továbbra is az operációs rendszer engedélye marad. Az analitika opcionális. Az értesítések opcionálisak.

3. Kötelező jogi elfogadási szakasz
Az első regisztrációs szakasznak egyértelművé kell tennie, hogy a Drivest egy vezetéstámogató platform, amely csak útmutatást nyújt.
Egyértelművé kell tennie, hogy a Drivest nem helyettesíti a felhasználó ítélőképességét, a gépjárművezető-oktatót vagy a törvényt.
A szakasznak hozzáférést kell biztosítania a Felhasználási feltételekhez és az Adatvédelmi szabályzathoz, mielőtt a felhasználó folytatná a folyamatot.
A felhasználónak a folytatás előtt aktívan be kell jelölnie egy négyzetet.
Az alkalmazás nem folytatódhat, amíg a jelölőnégyzet nincs bejelölve.
Ugyanez a szakasz rögzíti az életkor megerősítését és a biztonság tudomásulvételét az elfogadási esemény részeként.
A backendnek tárolnia kell az elfogadott feltételek verzióját, az adatvédelmi verziót, a biztonsági verziót, az elfogadás időbélyegét, a forrásképernyőt, az alkalmazás verzióját, a platformot és a telepítési azonosítót, ahol elérhető.

4. Helymeghatározási engedély
A helymeghatározást egy kontextusba illesztett műveleten, majd az operációs rendszer engedélyezési párbeszédablakán keresztül kell kérni.
A magyarázó szövegnek összhangban kell maradnia a jelenlegi adatvédelmi állásponttal:
- a helymeghatározást az útvonalakhoz és a navigációhoz használjuk, amikor aktív
- az útvonal- és parkolási funkcióknak szükségük van a helymeghatározásra, amikor a felhasználó próbálja használni azokat
- a Drivest nem sugallhatja, hogy a folyamatos háttérbeli helymeghatározási előzményeket a szervereken tárolják

Ha a felhasználó megtagadja a helymeghatározási engedélyt, az alkalmazás korlátozhatja az útvonallal és parkolással kapcsolatos funkciókat, de nem blokkolhatja a nem kapcsolódó tanulási funkciókat.
Az alkalmazásnak tárolnia kell a felhasználó tényleges helymeghatározási választását a következők egyikeként:
- engedélyezés
- elutasítás
- kihagyás

5. Analitikai hozzájárulás
Az analitikának opcionálisnak kell maradnia, ahol a hozzájárulás a szándékolt jogalap.
Az analitikai viselkedésnek kikapcsolva kell maradnia, amíg a felhasználó megerősítő döntést nem hoz.
A felhasználói felületnek úgy kell leírnia az analitikát, mint ami segít a teljesítmény és a megbízhatóság javításában.
A felület nem sugallhatja, hogy az analitika szükséges az alapszolgáltatás használatához.
A backendnek tárolnia kell:
- analyticsChoice (analitikai választás)
- időbélyeg
- forrásfelület
- alkalmazás verziója
- platform
- telepítési azonosító, ahol elérhető

6. Értesítési hozzájárulás
Az értesítéseknek opcionálisnak kell maradniuk.
A felszólításnak le kell írnia a műveleti céljukat, beleértve a frissítéseket, foglalásokat, emlékeztetőket és adott esetben a fontos fióktevékenységeket.
Az értesítések nem lehetnek alapértelmezés szerint előre engedélyezve.
Az alkalmazásnak az alkalmazáson belüli preferenciát az operációs rendszer engedélyezési eredményétől elkülönítve kell tárolnia.
A backendnek tárolnia kell:
- notificationsChoice (értesítési választás)
- időbélyeg
- forrásfelület
- alkalmazás verziója
- platform
- telepítési azonosító, ahol elérhető

7. Naplózási követelmények
A rendszernek a jogi elfogadási eseményt az engedélyezési és hozzájárulási választásoktól elkülönítve kell naplóznia.
Minimumként a backendnek tárolnia kell:
- feltételek verziója
- adatvédelmi verzió
- biztonsági verzió
- elfogadás időbélyege
- életkor megerősítésének állapota
- analitikai választás
- analitikai időbélyeg
- értesítési választás
- értesítési időbélyeg
- helymeghatározási választás
- helymeghatározási időbélyeg
- forrásképernyő vagy forrásfelület
- alkalmazás verziója
- platform
- telepítési azonosító, ahol elérhető

8. Jelenlegi implementációs követelmény
Az engedélyezési keretrendszernek meg kell felelnie a tényleges alkalmazásviselkedésnek.
Ha a jogi folyamat az analitikát opcionálisnak írja le, az analitikának az implementációban is valóban opcionálisnak kell lennie.
Ha az alkalmazás a regisztráció részeként tárolja a helymeghatározási választást, annak az adatmodellnek tükröződnie kell a belső megfelelőségi dokumentációban is.
Ha az alkalmazás később új engedélyt, új nyomon követési viselkedést vagy folyamatos háttérbeli helymeghatározást ad hozzá, az engedélyezési keretrendszert, az adatvédelmi szabályzatot, az alkalmazáson belüli szöveget és az alkalmazásbolti nyilatkozatokat a kiadás előtt együttesen frissíteni kell.

9. Végső engedélyleltár
Engedély vagy választás
Végső álláspont

Kötelező összevont jogi visszaigazolás
Feltételek elfogadása, Adatvédelmi szabályzat elfogadása, életkor megerősítése és biztonsági tudomásulvétel. Szükséges, mielőtt a felhasználó beléphet a termékbe.

Helymeghatározás
Kontextusban kérve az útvonalak, a navigáció és a helyfüggő funkciók támogatásához. Az operációs rendszer vezérli, de az alkalmazás is tárol egy rögzített választási állapotot.

Analitika
Opcionális hozzájárulás. Kikapcsolva kell maradnia, amíg a felhasználó megerősítő döntést nem hoz.

Értesítések
Opcionális hozzájárulás. Nem lehet előre engedélyezve. Az eszközbeállítások maradnak a végső engedélyezési hatóság, miközben az alkalmazás tárolja a felhasználó alkalmazáson belüli választását.
