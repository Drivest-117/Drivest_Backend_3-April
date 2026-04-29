Alkalmazáson belüli Jogi Regisztrációs Képernyők
Jelenlegi kétlépcsős regisztrációs modell
Verzió
1.1-es verzió
Utoljára frissítve
2026. április 5.
Készült a
Drivest Limited részére

Dokumentum célja
Ez a belső dokumentum határozza meg a Drivest számára jóváhagyott jelenlegi jogi és engedélyezési regisztrációs folyamatot. Tükrözi az alkalmazásban jelenleg meglévő implementációt, és felváltja a korábbi megfogalmazásokat, amelyek nem írták le teljes körűen a tárolt hozzájárulási modellt.

1. Célkitűzés
Ez a dokumentum határozza meg a jelenlegi alkalmazáson belüli regisztrációs folyamatot a jogi elfogadás és az engedélyek tekintetében. A jóváhagyott modell két szakaszt használ a hosszabb, többképernyős jogi folyamat helyett. A cél a felhasználói súrlódás csökkentése, miközben továbbra is érvényes jogi visszaigazolást és külön rögzített választásokat rögzítünk, amelyeket a háttérrendszer (backend) érvényesíthet és bizonyíthat.

2. 1. szakasz: Kombinált jogi elfogadás
Az 1. szakasz a kötelező belépési kapu az alkalmazásba.

Jelenlegi cím:
Mielőtt elkezdené

Jelenlegi törzsszöveg:
A Drivest egy vezetéstámogató platform. Csak útmutatást nyújt, és nem helyettesíti az Ön ítélőképességét, az oktatóját vagy a törvényt.

Mindig kövesse a közúti jelzőtáblákat, a közlekedési szabályokat és a valós körülményeket. Ha az alkalmazásban bármi ellentmond az úton tapasztaltaknak, kövesse az utat.

A folytatással megerősíti, hogy elmúlt 16 éves, megértette és elfogadja a biztonsági közleményt, valamint egyetért a Felhasználási feltételekkel és az Adatvédelmi szabályzattal.

Szükséges vezérlők:
- Feltételek megtekintése
- Adatvédelem megtekintése
- egy kötelező jelölőnégyzet
- A Folytatás gomb le van tiltva, amíg a jelölőnégyzet nincs bejelölve

Jelenlegi jelölőnégyzet szövege:
Megerősítem, hogy elmúltam 16 éves, megértettem a biztonsági közleményt, és elfogadom a Felhasználási feltételeket és az Adatvédelmi szabályzatot.

Ez a szakasz hozza létre a hiteles jogi elfogadási rekordot.
A backendnek tárolnia kell:
- termsVersion (felhasználási feltételek verziója)
- privacyVersion (adatvédelmi szabályzat verziója)
- safetyVersion (biztonsági verzió)
- ageConfirmed (életkor megerősítve)
- safetyAccepted (biztonság elfogadva)
- elfogadás időbélyege
- sourceScreen (forrásképernyő)
- alkalmazás verziója
- platform
- telepítési azonosító, ahol elérhető

3. 2. szakasz: Engedélyek és opcionális hozzájárulás
A 2. szakasz a műveleti engedélyek képernyője.

Jelenlegi cím:
Engedélyek

Jelenlegi törzsszöveg:
A Drivestnek bizonyos engedélyekre van szüksége a megfelelő működéshez. A helymeghatározást az útvonalakhoz és a navigációhoz használjuk, amikor aktív. Az analitika segít a teljesítmény és a megbízhatóság javításában, és opcionális. Az értesítések tájékoztatják Önt a foglalásokról és a tevékenységekről.

Szükséges vezérlők:
- egy helymeghatározási művelet, amely elindítja a natív helymeghatározási engedélyezési folyamatot
- külön analitikai engedélyezési és elutasítási műveletek
- külön értesítési engedélyezési és "most ne" műveletek
- Folytatás gomb

Jelenlegi helymeghatározási szakasz:
Cím: Helymeghatározás
Üzenet: A helymeghatározást az útvonalakhoz és a navigációhoz használjuk, amikor aktív.
Gomb: Helyhozzáférés kérése

Jelenlegi helymeghatározási állapotok:
- A helyhozzáférés már engedélyezve van a Drivest számára.
- A helyhozzáférés jelenleg el van utasítva. Folytathatja, de az útvonalfunkciók korlátozottak maradnak, amíg nem engedélyezi.
- A helymeghatározás egyelőre opcionális, de az útvonal- és parkolási funkciókhoz szükség van rá, amikor használja őket.

Jelenlegi analitikai szakasz:
Cím: Opcionális analitika
Üzenet: Az analitika segít a teljesítmény és a megbízhatóság javításában, és opcionális.
Műveletek:
- Analitika engedélyezése
- Elutasítás

Jelenlegi értesítési szakasz:
Cím: Opcionális értesítések
Üzenet: Az értesítések tájékoztatják Önt a foglalásokról és a tevékenységekről.
Műveletek:
- Értesítések engedélyezése
- Most ne

4. Backend leképzés
Minimumként az 1. szakasznak rekordokat kell létrehoznia vagy frissítenie a következőkben:
- legal_document_versions (jogi dokumentum verziók)
- user_legal_acceptances (felhasználói jogi elfogadások)

Minimumként a 2. szakasznak aktuális választási és előzményrekordokat kell létrehoznia vagy frissítenie a következőköz:
- analyticsChoice (analitikai választás)
- notificationsChoice (értesítési választás)
- locationChoice (helymeghatározási választás)

A későbbi beállításmódosításokat ugyanabba a backend megfelelőségi modellbe kell visszaírni, hogy a Drivest igazolni tudja mind az eredeti regisztrációs választást, mind a későbbi módosításokat vagy visszavonásokat, ahol alkalmazható.

5. Szigorú szabályok
Egyetlen jelölőnégyzet sem lehet előre bejelölve.
Az alkalmazás nem teheti lehetővé a felhasználó számára, hogy megkerülje a jogi elfogadási szakaszt, és beleegyezés nélkül folytassa a termék használatát.
A Felhasználási feltételeknek és az Adatvédelmi szabályzatnak elérhetőnek kell lenniük a jogi szakaszból.
A biztonsági közleménynek a jogi elfogadási szöveg részének kell maradnia, hacsak a jogi álláspont meg nem változik, és a verziók ennek megfelelően nem frissülnek.
Az engedélyezési szakasz nem vonhatja össze az analitikát, az értesítéseket és a helymeghatározást egyetlen homályos hozzájárulásba.
Minden választásnak külön-külön érthetőnek és külön-külön rögzíthetőnek kell maradnia.
A jogi szöveg, az engedélyezési modell vagy a nyomon követett viselkedés bármilyen lényeges módosítása esetén verziófrissítést és szükség esetén újbóli elfogadást kell kezdeményezni.
