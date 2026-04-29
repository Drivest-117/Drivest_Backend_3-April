Leidimų ir sutikimų sistema
„Drivest“ mobiliųjų įrenginių leidimai, pasirenkamas sutikimas ir žurnalų vedimo modelis
Versija
1.1 versija
Paskutinį kartą atnaujinta
2026 m. balandžio 5 d.
Parengta
Drivest Limited

Dokumento paskirtis
Šis vidinis dokumentas apibrėžia, kaip programėlėje turėtų būti prašoma leidimų ir sutikimų, kad naudotojo kelionė išliktų paprasta, teisiškai pagrįsta ir nuosekli su dabartine svetaine, programėlės elgsena bei backend žurnalų vedimo modeliu.

1. Šio dokumento tikslas
Šis dokumentas nustato dabartinę „Drivest“ leidimų ir sutikimų sistemą. Juo siekiama, kad mobiliųjų įrenginių patirtis būtų patogi naudoti, kartu išliekant suderintai su galiojančia teisine, privatumo ir programėlių parduotuvių pozicija.
Pagrindinis principas išlieka tas pats: „Drivest“ turėtų prašyti tik būtinų leidimų, prašyti jų kontekste, neįjungti pasirenkamų nustatymų iš anksto ir gebėti įrodyti, ką ir kada naudotojas pasirinko.

2. Dabartinis registracijos leidimų modelis
„Drivest“ dabar naudoja dviejų etapų registracijos modelį.

1 etapas skirtas privalomam teisiniam patvirtinimui. Jis apima:
- Nuostatų ir sąlygų priėmimą
- Privatumo politikos priėmimą
- Amžiaus patvirtinimą
- Saugos pranešimo pripažinimą

2 etapas skirtas operaciniams leidimams ir pasirenkamam sutikimui. Jis pateikia:
- prieigą prie buvimo vietos
- analitikos pasirinkimą
- pranešimų pasirinkimą

Buvimo vieta yra operaciškai svarbi maršrutų ir parkavimo funkcijoms, tačiau vis tiek lieka operacinės sistemos leidimu. Analitika yra pasirenkama. Pranešimai yra pasirenkami.

3. Privalomas teisinio patvirtinimo etapas
Pirmasis registracijos etapas turi aiškiai nurodyti, kad „Drivest“ yra vairavimo pagalbos platforma, teikianti tik gaires.
Turi būti aiškiai nurodyta, kad „Drivest“ nepakeičia naudotojo sprendimo, vairavimo instruktoriaus ar įstatymų.
Šiame etape turi būti suteikta prieiga prie Nuostatų ir sąlygų bei Privatumo politikos prieš naudotojui tęsiant.
Naudotojas privalo aktyviai pažymėti langelį prieš tęsdamas.
Programėlė neturi leisti tęsti, kol šis langelis nepažymėtas.
Tuo pačiu metu užfiksuojamas amžiaus patvirtinimas ir saugos pranešimo pripažinimas.
Backend sistemoje turi būti saugoma priimtų sąlygų versija, privatumo versija, saugos versija, priėmimo laiko žyma, ekrano šaltinis, programėlės versija, platforma ir diegimo identifikatorius.

4. Leidimas naudoti buvimo vietos duomenis
Buvimo vietos duomenų turėtų būti prašoma per kontekstinį veiksmą, o po to — per operacinės sistemos leidimų dialogą.
Paaiškinanti formuluotė turėtų išlikti nuosekli su dabartine privatumo pozicija:
- buvimo vieta naudojama maršrutams ir navigacijai, kai jie aktyvūs
- maršrutų ir parkavimo funkcijoms reikia buvimo vietos, kai naudotojas bando jomis naudotis
- „Drivest“ neturėtų teigti, kad serveriuose saugoma nuolatinė foninė buvimo vietos istorija

Jei naudotojas atsisako suteikti leidimą vietos duomenims, programėlė gali apriboti maršrutų ir parkavimo funkcijas, tačiau neturėtų blokuoti nesusijusių mokymosi funkcijų.
Programėlė turėtų saugoti naudotojo vietos pasirinkimą kaip vieną iš:
- leisti (allow)
- neleisti (deny)
- praleisti (skip)

5. Sutikimas dėl analitikos
Analitika privalo likti pasirenkama, kai sutikimas yra numatytas teisinis pagrindas.
Analitikos veikimas turi būti išjungtas, kol naudotojas neatlieka teigiamo pasirinkimo.
Naudotojo sąsajoje analitika turėtų būti apibūdinama kaip padedanti gerinti veikimą ir patikimumą.
Sąsaja neturi leisti suprasti, kad analitika yra būtina norint naudotis pagrindine paslauga.
Backend sistemoje turėtų būti saugoma:
- analyticsChoice
- laiko žyma
- šaltinio paviršius (source surface)
- programėlės versija
- platforma
- diegimo identifikatorius

6. Sutikimas dėl pranešimų
Pranešimai privalo likti pasirenkami.
Užklausoje turėtų būti aprašyta jų operacinė paskirtis, įskaitant atnaujinimus, užsakymus, priminimus ir svarbią paskyros veiklą.
Pranešimai neturi būti įjungti automatiškai pagal numatytuosius nustatymus.
Programėlė turėtų saugoti naudotojo pasirinkimą programėlėje atskirai nuo operacinės sistemos leidimo rezultato.
Backend sistemoje turėtų būti saugoma:
- notificationsChoice
- laiko žyma
- šaltinio paviršius
- programėlės versija
- platforma
- diegimo identifikatorius

7. Žurnalų vedimo reikalavimai
Sistema privalo loguoti teisinio patvirtinimo įvykį atskirai nuo leidimų ir sutikimų pasirinkimų.
Backend sistemoje turi būti saugoma:
- sąlygų versija
- privatumo versija
- saugos versija
- priėmimo laiko žyma
- amžiaus patvirtinimo būsena
- analitikos pasirinkimas
- analitikos laiko žyma
- pranešimų pasirinkimas
- pranešimų laiko žyma
- vietos pasirinkimas
- vietos laiko žyma
- šaltinio ekranas arba paviršius
- programėlės versija
- platforma
- diegimo identifikatorius

8. Dabartinis įgyvendinimo reikalavimas
Leidimų sistema privalo atitikti faktinį programėlės elgesį.
Jei teisiniame procese analitika apibūdinama kaip pasirenkama, ji privalo būti faktiškai pasirenkama įgyvendinant.
Jei programėlė saugo vietos pasirinkimą registracijos metu, tas duomenų modelis turi būti atspindėtas vidinėje atitikties dokumentacijoje.
Jei vėliau programėlė pridės naują leidimą, naują sekimo elgseną ar nuolatinį foninį buvimo vietos apdorojimą, leidimų sistema, privatumo politika, tekstai programėlėje ir parduotuvių deklaracijos turi būti atnaujinti kartu prieš išleidimą.

9. Galutinis leidimų sąrašas
Leidimas ar pasirinkimas
Galutinė pozicija

Privalomas jungtinis teisinis patvirtinimas
Sąlygų priėmimas, Privatumo priėmimas, amžiaus patvirtinimas ir saugos pripažinimas. Reikalaujama prieš naudotojui patenkant į produktą.

Buvimo vieta
Prašoma kontekste palaikyti maršrutus, navigaciją ir nuo vietos priklausančias funkcijas. Valdoma operacinės sistemos, tačiau programėlė taip pat saugo įrašytą pasirinkimo būseną.

Analitika
Pasirenkamas sutikimas. Privalo likti išjungta, kol naudotojas neatlieka teigiamo pasirinkimo.

Pranešimai
Pasirenkamas sutikimas. Neturi būti įjungti iš anksto. Įrenginio nustatymai lieka galutinis leidimų autoritetas, o programėlė saugo naudotojo pasirinkimą programėlėje.
