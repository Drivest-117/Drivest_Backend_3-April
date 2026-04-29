Cadrul de permisiuni și consimțământ
Permisiuni mobile Drivest, consimțământ opțional și model de jurnalizare
Versiune
Versiunea 1.1
Ultima actualizare
5 aprilie 2026
Pregătit pentru
Drivest Limited

Scopul documentului
Acest document intern definește modul în care permisiunile și consimțământul ar trebui solicitate acum în aplicație, astfel încât parcursul mobil să rămână cu fricțiune redusă, sustenabil din punct de vedere legal și coerent cu site-ul web actual, comportamentul aplicației și modelul de jurnalizare backend.

1. Scopul acestui document
Acest document stabilește cadrul actual de permisiuni și consimțământ pentru Drivest. Acesta are rolul de a menține experiența mobilă utilizabilă, rămânând în același timp aliniat cu poziția legală activă, de confidențialitate și a magazinului de aplicații.
Principiul de bază rămâne același. Drivest ar trebui să solicite doar permisiunile care sunt necesare, ar trebui să solicite în context, nu ar trebui să pre-activeze opțiunile opționale și ar trebui să poată dovedi ce a ales utilizatorul și când.

2. Modelul actual de permisiuni pentru înregistrare
Drivest utilizează acum un model de înregistrare în două etape.

Etapa 1 gestionează acceptarea legală obligatorie. Aceasta acoperă:
- Acceptarea Termenilor și Condițiilor
- Acceptarea Politicii de Confidențialitate
- Confirmarea vârstei
- Luarea la cunoștință a notificării de siguranță

Etapa 2 gestionează permisiunile operaționale și consimțământul opțional. Aceasta prezintă:
- Accesul la locație
- Alegerea analizelor (analytics)
- Alegerea notificărilor

Locația este importantă din punct de vedere operațional pentru funcțiile legate de rută și parcare, dar rămâne în continuare o permisiune a sistemului de operare. Analizele sunt opționale. Notificările sunt opționale.

3. Etapa de acceptare legală obligatorie
Prima etapă de înregistrare trebuie să clarifice faptul că Drivest este o platformă de asistență pentru conducerea auto care oferă doar îndrumare.
Trebuie să clarifice faptul că Drivest nu înlocuiește judecata utilizatorului, un instructor auto sau legea.
Etapa trebuie să ofere acces la Termeni și Condiții și la Politica de Confidențialitate înainte ca utilizatorul să continue.
Utilizatorul trebuie să bifeze activ o casetă înainte de a continua.
Aplicația nu trebuie să continue până când acea casetă de selectare nu este selectată.
Aceeași etapă înregistrează confirmarea vârstei și luarea la cunoștință a siguranței ca parte a evenimentului de acceptare.
Backend-ul trebuie să stocheze versiunea termenilor acceptați, versiunea de confidențialitate, versiunea de siguranță, marca temporală a acceptării, ecranul sursă, versiunea aplicației, platforma și identificatorul de instalare acolo unde este disponibil.

4. Permisiunea de locație
Locația ar trebui solicitată printr-o acțiune în context și apoi prin dialogul de permisiune al sistemului de operare.
Formularea explicativă ar trebui să rămână coerentă cu poziția actuală de confidențialitate:
- locația este utilizată pentru rute și navigație atunci când este activă
- funcțiile de rută și parcare au nevoie de locație atunci când utilizatorul încearcă să le folosească
- Drivest nu ar trebui să sugereze că istoricul continuu al locației în fundal este stocat pe servere

Dacă un utilizator refuză permisiunea de locație, aplicația poate restricționa funcțiile legate de rută și parcare, dar nu ar trebui să blocheze funcțiile de învățare care nu au legătură.
Aplicația ar trebui să stocheze alegerea efectivă a locației utilizatorului ca una dintre:
- permite
- respinge
- omite

5. Consimțământul pentru analize
Analizele trebuie să rămână opționale acolo unde consimțământul este baza legală prevăzută.
Comportamentul analizelor ar trebui să rămână dezactivat până când utilizatorul face o alegere afirmativă.
Interfața de utilizator ar trebui să descrie analizele ca ajutând la îmbunătățirea performanței și fiabilității.
Interfața nu trebuie să sugereze că analizele sunt necesare pentru a utiliza serviciul de bază.
Backend-ul ar trebui să stocheze:
- analyticsChoice (alegere analize)
- marca temporală
- suprafața sursă
- versiunea aplicației
- platforma
- identificatorul de instalare acolo unde este disponibil

6. Consimțământul pentru notificări
Notificările trebuie să rămână opționale.
Mesajul ar trebui să descrie scopul lor operațional, inclusiv actualizări, rezervări, mementouri și activități importante ale contului, acolo unde este relevant.
Notificările nu trebuie să fie pre-activate implicit.
Aplicația ar trebui să stocheze alegerea preferințelor în aplicație ale utilizatorului separat de rezultatul permisiunii sistemului de operare.
Backend-ul ar trebui să stocheze:
- notificationsChoice (alegere notificări)
- marca temporală
- suprafața sursă
- versiunea aplicației
- platforma
- identificatorul de instalare acolo unde este disponibil

7. Cerințe de jurnalizare
Sistemul trebuie să înregistreze evenimentul de acceptare legală separat de alegerile de permisiune și consimțământ.
Cel puțin, backend-ul ar trebui să stocheze:
- versiunea termenilor
- versiunea de confidențialitate
- versiunea de siguranță
- marca temporală a acceptării
- starea confirmării vârstei
- alegerea analizelor
- marca temporală a analizelor
- alegerea notificărilor
- marca temporală a notificărilor
- alegerea locației
- marca temporală a locației
- ecranul sursă sau suprafața sursă
- versiunea aplicației
- platforma
- identificatorul de instalare acolo unde este disponibil

8. Cerință de implementare curentă
Cadrul de permisiuni trebuie să se potrivească cu comportamentul real al aplicației.
Dacă fluxul legal descrie analizele ca fiind opționale, analizele trebuie să fie efectiv opționale în implementare.
Dacă aplicația stochează alegerea locației ca parte a înregistrării, acel model de date trebuie să fie reflectat în documentația internă de conformitate.
Dacă aplicația adaugă ulterior o nouă permisiune, un nou comportament de urmărire sau procesarea continuă a locației în fundal, cadrul de permisiuni, politica de confidențialitate, textele din aplicație și declarațiile din magazin trebuie actualizate împreună înainte de lansare.

9. Inventarul final al permisiunilor
Permisiune sau alegere
Poziție finală

Luare la cunoștință legală combinată obligatorie
Acceptarea Termenilor, acceptarea Politicii de Confidențialitate, confirmarea vârstei și luarea la cunoștință a siguranței. Necesar înainte ca utilizatorul să poată intra în produs.

Locație
Solicitată în context pentru a sprijini rutele, navigația și funcțiile dependente de locație. Controlată de sistemul de operare, dar aplicația stochează, de asemenea, o stare de alegere înregistrată.

Analize (Analytics)
Consimțământ opțional. Trebuie să rămână dezactivat până când utilizatorul face o alegere afirmativă.

Notificări
Consimțământ opțional. Nu trebuie să fie pre-activate. Setările dispozitivului rămân autoritatea finală pentru permisiuni, în timp ce aplicația stochează alegerea preferințelor utilizatorului în aplicație.
