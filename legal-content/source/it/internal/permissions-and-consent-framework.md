Quadro di riferimento per i permessi e il consenso
Modello di permessi mobili Drivest, consenso facoltativo e registrazione dei dati
Versione: 1.1
Ultimo aggiornamento: 5 aprile 2026
Preparato per: Drivest Limited

Scopo del documento
Questo documento interno definisce le modalità con cui i permessi e il consenso devono essere richiesti nell'app, affinché il percorso mobile rimanga fluido, legalmente difendibile e coerente con l'attuale sito web, il comportamento dell'app e il modello di registrazione del backend.

1. Scopo del presente documento
Il presente documento stabilisce l'attuale quadro di riferimento per i permessi e il consenso per Drivest. Intende mantenere l'esperienza mobile utilizzabile pur rimanendo allineata con l'attuale posizione legale, sulla privacy e sugli app store.
Il principio fondamentale rimane lo stesso: Drivest deve richiedere solo i permessi necessari, deve richiederli contestualmente, non deve pre-abilitare scelte facoltative e deve essere in grado di provare cosa l'utente ha scelto e quando.

2. Attuale modello di permessi per l'onboarding
Drivest utilizza ora un modello di onboarding in due fasi.

La Fase 1 gestisce l'accettazione legale obbligatoria. Riguarda:
- Accettazione dei Termini e condizioni
- Accettazione dell'Informativa sulla privacy
- Conferma dell'età
- Riconoscimento dell'avviso di sicurezza

La Fase 2 gestisce i permessi operativi e il consenso facoltativo. Presenta:
- Accesso alla posizione
- Scelta relativa all'analisi (analytics)
- Scelta relativa alle notifiche

La posizione è operativamente importante per le funzioni relative ai percorsi e al parcheggio, ma rimane comunque un permesso del sistema operativo. L'analisi è facoltativa. Le notifiche sono facoltative.

3. Fase di accettazione legale obbligatoria
La prima fase di onboarding deve chiarire che Drivest è una piattaforma di supporto alla guida che fornisce esclusivamente indicazioni.
Deve chiarire che Drivest non sostituisce il giudizio dell'utente, un istruttore di guida o la legge.
La fase deve fornire l'accesso ai Termini e condizioni e all'Informativa sulla privacy prima che l'utente continui.
L'utente deve selezionare attivamente una casella prima di continuare.
L'app non deve proseguire finché tale casella non viene selezionata.
La stessa fase acquisisce la conferma dell'età e il riconoscimento della sicurezza come parte dell'evento di accettazione.
Il backend deve memorizzare la versione dei termini accettati, la versione della privacy, la versione della sicurezza, il timestamp dell'accettazione, la schermata di origine, la versione dell'app, la piattaforma e l'identificativo dell'installazione, ove disponibile.

4. Permesso di posizione
La posizione deve essere richiesta tramite un'azione contestuale e successivamente attraverso la finestra di dialogo dei permessi del sistema operativo.
Il testo esplicativo deve rimanere coerente con l'attuale posizione sulla privacy:
- La posizione viene utilizzata per i percorsi e la navigazione quando sono attivi.
- Le funzioni di percorso e parcheggio necessitano della posizione quando l'utente tenta di utilizzarle.
- Drivest non deve implicare che la cronologia continua della posizione in background venga memorizzata sui server.

Se un utente nega il permesso di posizione, l'app può limitare le funzioni relative ai percorsi e al parcheggio, ma non deve bloccare le funzioni di apprendimento non correlate.
L'app deve memorizzare la scelta effettiva della posizione dell'utente come uno dei seguenti stati:
- Consenti
- Nega
- Salta

5. Consenso all'analisi (analytics)
L'analisi deve rimanere facoltativa laddove il consenso sia la base giuridica prevista.
Il comportamento dell'analisi deve rimanere disattivato finché l'utente non effettua una scelta affermativa.
L'interfaccia utente deve descrivere l'analisi come uno strumento per aiutare a migliorare le prestazioni e l'affidabilità.
L'interfaccia non deve suggerire che l'analisi sia necessaria per utilizzare il servizio principale.
Il backend deve memorizzare:
- analyticsChoice
- timestamp
- superficie di origine
- versione dell'app
- piattaforma
- identificativo dell'installazione, ove disponibile

6. Consenso alle notifiche
Le notifiche devono rimanere facoltative.
Il messaggio deve descrivere il loro scopo operativo, inclusi aggiornamenti, prenotazioni, promemoria e attività importanti dell'account, ove pertinente.
Le notifiche non devono essere pre-abilitate per impostazione predefinita.
L'app deve memorizzare la scelta della preferenza in-app dell'utente separatamente dal risultato del permesso del sistema operativo.
Il backend deve memorizzare:
- notificationsChoice
- timestamp
- superficie di origine
- versione dell'app
- piattaforma
- identificativo dell'installazione, ove disponibile

7. Requisiti di registrazione dei dati (logging)
Il sistema deve registrare l'evento di accettazione legale separatamente dalle scelte sui permessi e sul consenso.
Come minimo, il backend deve memorizzare:
- versione dei termini
- versione della privacy
- versione della sicurezza
- timestamp dell'accettazione
- stato della conferma dell'età
- scelta relativa all'analisi
- timestamp dell'analisi
- scelta relativa alle notifiche
- timestamp delle notifiche
- scelta relativa alla posizione
- timestamp della posizione
- schermata di origine o superficie di origine
- versione dell'app
- piattaforma
- identificativo dell'installazione, ove disponibile

8. Requisiti dell'attuale implementazione
Il quadro dei permessi deve corrispondere al comportamento effettivo dell'app.
Se il flusso legale descrive l'analisi come facoltativa, l'analisi deve essere effettivamente facoltativa nell'implementazione.
Se l'app memorizza la scelta della posizione come parte dell'onboarding, tale modello di dati deve riflettersi nella documentazione di conformità interna.
Se in futuro l'app aggiungerà un nuovo permesso, un nuovo comportamento di tracciamento o l'elaborazione continua della posizione in background, il quadro dei permessi, l'informativa sulla privacy, i testi in-app e le dichiarazioni degli store dovranno essere aggiornati tutti insieme prima del rilascio.

9. Inventario finale dei permessi
Permesso o scelta: Stato finale

Riconoscimento legale combinato obbligatorio
Accettazione dei Termini, accettazione della Privacy, conferma dell'età e riconoscimento della sicurezza. Richiesto prima che l'utente possa accedere al prodotto.

Posizione
Richiesta contestualmente per supportare percorsi, navigazione e funzioni dipendenti dalla posizione. Controllata dal sistema operativo, ma l'app memorizza anche uno stato della scelta registrata.

Analisi (Analytics)
Consenso facoltativo. Deve rimanere disattivata finché l'utente non effettua una scelta affermativa.

Notifiche
Consenso facoltativo. Non devono essere pre-abilitate. Le impostazioni del dispositivo rimangono l'autorità finale per i permessi, mentre l'app memorizza la scelta delle preferenze in-app dell'utente.
