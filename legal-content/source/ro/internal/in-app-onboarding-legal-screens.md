Ecrane juridice de onboarding în aplicație
Modelul actual de onboarding în două etape
Versiune
Versiunea 1.1
Ultima actualizare
5 aprilie 2026
Pregătit pentru
Drivest Limited

Scopul documentului
Acest document intern definește fluxul actual de permisiuni și aspecte juridice pentru onboarding, aprobat pentru Drivest. Acesta reflectă implementarea prezentă acum în aplicație și înlocuiește formulările mai vechi care nu descriau complet modelul de consimțământ stocat.

1. Obiectiv
Acest document definește fluxul actual din aplicație pentru acceptarea juridică și permisiuni în timpul onboarding-ului. Modelul aprobat folosește două etape în locul unei călătorii juridice mai lungi, cu mai multe ecrane. Scopul este de a reduce fricțiunea pentru utilizator, capturând în același timp o confirmare juridică validă și opțiuni înregistrate separat, care pot fi aplicate și dovedite prin intermediul backend-ului.

2. Etapa 1: Acceptarea juridică combinată
Etapa 1 este poarta de intrare obligatorie în aplicație.

Titlu actual:
Înainte de a începe

Textul actual al corpului:
Drivest este o platformă de asistență la conducere. Aceasta oferă doar îndrumări și nu înlocuiește judecata dumneavoastră, instructorul sau legea.

Trebuie să urmați întotdeauna indicatoarele rutiere, legile de circulație și condițiile din lumea reală. Dacă ceva din aplicație intră în conflict cu drumul, urmați drumul.

Continuând, confirmați că aveți vârsta de 16 ani sau mai mult, că înțelegeți și acceptați notificarea de siguranță și că sunteți de acord cu Termenii și condițiile și Politica de confidențialitate.

Controale necesare:
- Vizualizare Termeni
- Vizualizare Confidențialitate
- o casetă de selectare obligatorie
- Butonul Continuare dezactivat până când caseta de selectare este selectată

Textul actual al casetei de selectare:
Confirm că am 16 ani sau mai mult, înțeleg notificarea de siguranță și sunt de acord cu Termenii și condițiile și Politica de confidențialitate.

Această etapă creează înregistrarea oficială de acceptare juridică.
Backend-ul ar trebui să stocheze:
- versiuneaTermenilor (termsVersion)
- versiuneaPoliticiiDeConfidențialitate (privacyVersion)
- versiuneaNotificăriiDeSiguranță (safetyVersion)
- vârstăConfirmată (ageConfirmed)
- siguranțăAcceptată (safetyAccepted)
- marcajul temporal al acceptării
- ecranulSursă (sourceScreen)
- versiunea aplicației
- platforma
- identificatorul de instalare, acolo unde este disponibil

3. Etapa 2: Permisiuni și consimțământ opțional
Etapa 2 este ecranul de permisiuni operaționale.

Titlu actual:
Permisiuni

Textul actual al corpului:
Drivest are nevoie de anumite permisiuni pentru a funcționa corect. Locația este utilizată pentru rute și navigare atunci când este activă. Analizele ajută la îmbunătățirea performanței și fiabilității și sunt opționale. Notificările vă țin la curent cu rezervările și activitatea.

Controale necesare:
- o acțiune de locație care declanșează fluxul nativ de permisiuni de locație
- acțiuni separate de permitere și nepermitere a analizelor
- acțiuni separate de activare și „nu acum” pentru notificări
- Butonul Continuare

Secțiunea actuală de locație:
Titlu: Locație
Mesaj: Locația este utilizată pentru rute și navigare atunci când este activă.
Buton: Solicită accesul la locație

Stările actuale ale accesului la locație:
- Accesul la locație este deja permis pentru Drivest.
- Accesul la locație este momentan refuzat. Puteți continua, dar funcțiile de rută vor rămâne limitate până când îl activați.
- Locația este opțională pentru moment, dar funcțiile de rută și parcare au nevoie de ea atunci când le utilizați.

Secțiunea actuală de analize:
Titlu: Analize opționale
Mesaj: Analizele ajută la îmbunătățirea performanței și fiabilității și sunt opționale.
Acțiuni:
- Permite analizele
- Nu permite

Secțiunea actuală de notificări:
Titlu: Notificări opționale
Mesaj: Notificările vă țin la curent cu rezervările și activitatea.
Acțiuni:
- Activează notificările
- Nu acum

4. Maparea backend
Cel puțin, Etapa 1 ar trebui să creeze sau să actualizeze înregistrări în:
- versiuni_documente_juridice (legal_document_versions)
- acceptări_juridice_utilizator (user_legal_acceptances)

Cel puțin, Etapa 2 ar trebui să creeze sau să actualizeze înregistrările de opțiuni actuale și de istoric pentru:
- opțiuneAnalize (analyticsChoice)
- opțiuneNotificări (notificationsChoice)
- opțiuneLocație (locationChoice)

Modificările ulterioare ale setărilor trebuie să scrie înapoi în același model de conformitate backend, astfel încât Drivest să poată dovedi atât alegerea inițială de onboarding, cât și modificările sau retragerile ulterioare, acolo unde este cazul.

5. Reguli stricte
Nicio casetă de selectare nu poate fi pre-selectată.
Aplicația nu trebuie să permită unui utilizator să sară peste etapa de acceptare juridică și să continue în produs fără acord.
Termenii și condițiile și Politica de confidențialitate trebuie să fie accesibile din etapa juridică.
Notificarea de siguranță trebuie să rămână parte a textului de acceptare juridică, cu excepția cazului în care poziția juridică se schimbă și versiunile sunt actualizate corespunzător.
Etapa de permisiuni nu trebuie să combine analizele, notificările și locația într-un singur consimțământ vag.
Fiecare alegere trebuie să rămână înțeleasă și înregistrată separat.
Orice modificare materială a textului juridic, a modelului de permisiuni sau a comportamentului urmărit ar trebui să declanșeze o actualizare a versiunii și o re-acceptare acolo unde este necesar.
