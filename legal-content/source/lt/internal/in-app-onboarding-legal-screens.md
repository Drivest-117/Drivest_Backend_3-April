Teisiniai programėlės registracijos ekranai
Dabartinis dviejų etapų registracijos modelis
Versija
1.1 versija
Paskutinį kartą atnaujinta
2026 m. balandžio 5 d.
Parengta
Drivest Limited

Dokumento paskirtis
Šis vidinis dokumentas apibrėžia dabartinį „Drivest“ patvirtintą teisinį ir leidimų suteikimo procesą registracijos metu. Jis atspindi šiuo metu programėlėje esantį įgyvendinimą ir pakeičia senesnes formuluotes, kurios nevisiškai aprašė saugomą sutikimo modelį.

1. Tikslas
Šis dokumentas apibrėžia dabartinį teisinių dokumentų priėmimo ir leidimų suteikimo procesą programėlėje. Patvirtintas modelis naudoja du etapus vietoj ilgo kelių ekranų proceso. Tikslas — sumažinti naudotojų kliūtis, kartu užfiksuojant galiojantį teisinį patvirtinimą ir atskirai įrašytus pasirinkimus, kuriuos galima įrodyti per backend sistemą.

2. 1 etapas: Jungtinis teisinis patvirtinimas
1 etapas yra privalomas įėjimo į programėlę vartai.

Dabartinis pavadinimas:
Prieš pradedant

Dabartinis tekstas:
„Drivest“ yra vairavimo pagalbos platforma. Ji teikia tik gaires ir nepakeičia jūsų pačių sprendimo, jūsų instruktoriaus ar įstatymų.

Visada privalote vadovautis kelio ženklais, kelių eismo taisyklėmis ir realiomis sąlygomis. Jei kas nors programėlėje prieštarauja situacijai kelyje, vadovaukitės situacija kelyje.

Tęsdami patvirtinate, kad esate 16 metų ar vyresni, kad suprantate ir sutinkate su saugos pranešimu bei sutinkate su Nuostatomis ir sąlygomis bei Privatumo politika.

Reikalingi valdikliai:
- Peržiūrėti sąlygas
- Peržiūrėti privatumą
- vienas privalomas žymimasis langelis (checkbox)
- Mygtukas „Tęsti“ išjungtas, kol nepažymėtas langelis

Dabartinis langelio tekstas:
Patvirtinu, kad esu 16 metų ar vyresnis, suprantu saugos pranešimą ir sutinku su Nuostatomis ir sąlygomis bei Privatumo politika.

Šis etapas sukuria autoritetingą teisinio priėmimo įrašą.
Backend sistemoje turi būti saugoma:
- termsVersion
- privacyVersion
- safetyVersion
- ageConfirmed
- safetyAccepted
- priėmimo laiko žyma
- sourceScreen
- programėlės versija
- platforma
- diegimo identifikatorius (jei prieinamas)

3. 2 etapas: Leidimai ir pasirenkamas sutikimas
2 etapas yra operacinių leidimų ekranas.

Dabartinis pavadinimas:
Leidimai

Dabartinis tekstas:
„Drivest“ reikia tam tikrų leidimų, kad ji tinkamai veiktų. Buvimo vieta naudojama maršrutams ir navigacijai, kai jie yra aktyvūs. Analitika padeda pagerinti veikimą ir patikimumą, ji yra pasirenkama. Pranešimai informuoja jus apie užsakymus ir veiklą.

Reikalingi valdikliai:
- buvimo vietos veiksmas, iššaukiantis sisteminį leidimo užklausos langą
- atskiri analitikos „leisti“ ir „neleisti“ veiksmai
- atskiri pranešimų „įjungti“ ir „ne dabar“ veiksmai
- Mygtukas „Tęsti“

Dabartinė buvimo vietos skiltis:
Pavadinimas: Buvimo vieta
Pranešimas: Buvimo vieta naudojama maršrutams ir navigacijai, kai jie yra aktyvūs.
Mygtukas: Prašyti prieigos prie vietos duomenų

Dabartinės buvimo vietos būsenos:
- Prieiga prie vietos duomenų jau suteikta.
- Prieiga prie vietos duomenų šiuo metu uždrausta. Galite tęsti, tačiau maršrutų funkcijos bus apribotos, kol jos neįjungsite.
- Buvimo vieta kol kas nebūtina, tačiau maršrutų ir parkavimo funkcijoms jos reikės, kai jas naudosite.

Dabartinė analitikos skiltis:
Pavadinimas: Pasirenkama analitika
Pranešimas: Analitika padeda pagerinti veikimą ir patikimumą, ji yra pasirenkama.
Veiksmai:
- Leisti analitiką
- Neleisti

Dabartinė pranešimų skiltis:
Pavadinimas: Pasirenkami pranešimai
Pranešimas: Pranešimai informuoja jus apie užsakymus ir veiklą.
Veiksmai:
- Įjungti pranešimus
- Ne dabar

4. Backend susiejimas
Mažiausiai 1 etapas turi sukurti ar atnaujinti įrašus šiose skiltyse:
- legal_document_versions
- user_legal_acceptances

Mažiausiai 2 etapas turi sukurti ar atnaujinti dabartinio pasirinkimo ir istorijos įrašus:
- analyticsChoice
- notificationsChoice
- locationChoice

Vėlesni nustatymų pakeitimai turi būti įrašomi į tą patį atitikties modelį, kad „Drivest“ galėtų įrodyti tiek pradinį pasirinkimą registracijos metu, tiek vėlesnius pakeitimus ar atšaukimus.

5. Griežtos taisyklės
Joks žymimasis langelis negali būti pažymėtas iš anksto.
Programėlė neturi leisti naudotojui apeiti teisinio patvirtinimo etapo ir tęsti naudojimąsi produktu be sutikimo.
Nuostatos ir sąlygos bei Privatumo politika turi būti pasiekiamos teisinio etapo metu.
Saugos pranešimas turi likti teisinio patvirtinimo teksto dalimi, nebent pasikeičia teisinė pozicija ir atitinkamai atnaujinamos versijos.
Leidimų etapas neturi apjungti analitikos, pranešimų ir buvimo vietos į vieną neaiškų sutikimą.
Kiekvienas pasirinkimas turi likti atskirai suprantamas ir atskirai įrašomas.
Bet koks esminis teisinio teksto, leidimų modelio ar stebimos elgsenos pakeitimas turėtų iššaukti versijos atnaujinimą ir pakartotinį sutikimą, kur to reikalaujama.
