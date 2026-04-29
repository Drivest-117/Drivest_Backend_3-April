Schermate legali di onboarding in-app
Modello di onboarding a due fasi attuale
Versione: 1.1
Ultimo aggiornamento: 5 aprile 2026
Preparato per: Drivest Limited

Scopo del documento
Questo documento interno definisce l'attuale flusso legale e dei permessi di onboarding approvato per Drivest. Riflette l'implementazione attualmente presente nell'app e sostituisce le versioni precedenti che non descrivevano appieno il modello di consenso memorizzato.

1. Obiettivo
Questo documento definisce l'attuale flusso in-app per l'accettazione legale e i permessi durante l'onboarding. Il modello approvato utilizza due fasi anziché un percorso legale più lungo su più schermate. Lo scopo è ridurre l'attrito per l'utente, acquisendo comunque un riconoscimento legale valido e scelte registrate separatamente che possono essere applicate ed evidenziate dal backend.

2. Fase 1: Accettazione legale combinata
La Fase 1 è il varco obbligatorio per l'accesso all'app.

Titolo attuale:
Prima di iniziare

Testo del corpo attuale:
Drivest è una piattaforma di supporto alla guida. Fornisce esclusivamente indicazioni e non sostituisce il tuo giudizio, il tuo istruttore o la legge.

Devi sempre seguire i segnali stradali, le leggi sul traffico e le condizioni reali. Se qualcosa nell'app è in contrasto con la strada, segui la strada.

By continuing, you confirm that you are 16 years of age or older, that you understand and accept the safety notice, and that you agree to the Terms and Conditions and the Privacy Policy.

Controlli richiesti:
- Visualizza Termini
- Visualizza Privacy
- Una casella di controllo obbligatoria
- Pulsante Continua disabilitato finché la casella di controllo non viene selezionata

Testo attuale della casella di controllo:
Confermo di avere 16 anni o più, comprendo l'avviso di sicurezza e accetto i Termini e condizioni e l'Informativa sulla privacy.

Questa fase crea il registro autorevole dell'accettazione legale.
Il backend deve memorizzare:
- termsVersion
- privacyVersion
- safetyVersion
- ageConfirmed
- safetyAccepted
- timestamp dell'accettazione
- sourceScreen
- versione dell'app
- piattaforma
- identificativo dell'installazione, se disponibile

3. Fase 2: Permessi e consenso facoltativo
La Fase 2 è la schermata dei permessi operativi.

Titolo attuale:
Permessi

Testo del corpo attuale:
Drivest ha bisogno di alcuni permessi per funzionare correttamente. La posizione viene utilizzata per i percorsi e la navigazione quando sono attivi. L'analisi (Analytics) aiuta a migliorare le prestazioni e l'affidabilità ed è facoltativa. Le notifiche ti tengono aggiornato sulle prenotazioni e sulle attività.

Controlli richiesti:
- Un'azione per la posizione che attiva il flusso di autorizzazione nativo della posizione
- Azioni separate per consentire o non consentire l'analisi (analytics)
- Azioni separate per abilitare o non ora le notifiche
- Pulsante Continua

Sezione posizione attuale:
Titolo: Posizione
Messaggio: La posizione viene utilizzata per i percorsi e la navigazione quando sono attivi.
Pulsante: Richiedi accesso alla posizione

Stati attuali della posizione:
- L'accesso alla posizione è già consentito per Drivest.
- L'accesso alla posizione è attualmente negato. Puoi continuare, ma le funzioni relative ai percorsi rimarranno limitate finché non lo abiliterai.
- La posizione è facoltativa per ora, ma le funzioni di percorso e parcheggio ne hanno bisogno quando le utilizzi.

Sezione analisi attuale:
Titolo: Analisi facoltative
Messaggio: L'analisi aiuta a migliorare le prestazioni e l'affidabilità ed è facoltativa.
Azioni:
- Consenti analisi
- Non consentire

Sezione notifiche attuale:
Titolo: Notifiche facoltative
Messaggio: Le notifiche ti tengono aggiornato sulle prenotazioni e sulle attività.
Azioni:
- Abilita notifiche
- Non ora

4. Mappatura del backend
Come minimo, la Fase 1 dovrebbe creare o aggiornare i registri in:
- legal_document_versions
- user_legal_acceptances

Come minimo, la Fase 2 dovrebbe creare o aggiornare i registri delle scelte attuali e della cronologia per:
- analyticsChoice
- notificationsChoice
- locationChoice

Le successive modifiche alle impostazioni devono essere trascritte nello stesso modello di conformità del backend, in modo che Drivest possa provare sia la scelta originale durante l'onboarding sia le successive modifiche o revoche, laddove applicabili.

5. Regole ferree
Nessuna casella di controllo può essere preselezionata.
L'app non deve consentire all'utente di saltare la fase di accettazione legale e proseguire nel prodotto senza l'accordo.
I Termini e condizioni e l'Informativa sulla privacy devono essere accessibili dalla fase legale.
L'avviso di sicurezza deve rimanere parte del testo di accettazione legale, a meno che la posizione legale non cambi e le versioni non vengano aggiornate di conseguenza.
La fase dei permessi non deve raggruppare analisi, notifiche e posizione in un unico consenso generico.
Ogni scelta deve rimanere comprensibile e registrabile separatamente.
Qualsiasi modifica sostanziale al testo legale, al modello di autorizzazione o al comportamento tracciato dovrebbe innescare un aggiornamento della versione e una nuova accettazione, ove richiesto.
