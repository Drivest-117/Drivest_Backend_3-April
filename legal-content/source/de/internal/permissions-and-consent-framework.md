Rahmenwerk für Berechtigungen und Einwilligung
Drivest Mobile-Berechtigungen, optionale Einwilligung und Protokollierungsmodell
Version
Version 1.1
Zuletzt aktualisiert
5. April 2026
Erstellt für
Drivest Limited

Zweck des Dokuments
Dieses interne Dokument definiert, wie Berechtigungen und Einwilligungen nun in der App angefordert werden sollten, damit die mobile Reise reibungsarm, rechtlich vertretbar und konsistent mit der aktuellen Website, dem App-Verhalten und dem Backend-Protokollierungsmodell bleibt.

1. Zweck dieses Dokuments
Dieses Dokument legt das aktuelle Rahmenwerk für Berechtigungen und Einwilligungen für Drivest fest. Es soll die mobile Erfahrung nutzbar halten und gleichzeitig mit der aktiven rechtlichen, Datenschutz- und App-Store-Position in Einklang bringen.
Das Kernprinzip bleibt dasselbe. Drivest sollte nur nach Berechtigungen fragen, die notwendig sind, sollte im Kontext fragen, sollte optionale Auswahlmöglichkeiten nicht voraktivieren und sollte nachweisen können, was der Benutzer wann gewählt hat.

2. Aktuelles Onboarding-Berechtigungsmodell
Drivest verwendet nun ein zweistufiges Onboarding-Modell.

Stufe 1 behandelt die obligatorische rechtliche Akzeptanz. Sie umfasst:
- Akzeptanz der Allgemeinen Geschäftsbedingungen
- Akzeptanz der Datenschutzrichtlinie
- Bestätigung des Alters
- Kenntnisnahme des Sicherheitshinweises

Stufe 2 behandelt betriebliche Berechtigungen und optionale Einwilligungen. Sie präsentiert:
- Standortzugriff
- Auswahl der Analysen
- Auswahl der Benachrichtigungen

Der Standort ist betrieblich wichtig für routen- und parkplatzbezogene Funktionen, bleibt aber dennoch eine Betriebssystem-Berechtigung. Analysen sind optional. Benachrichtigungen sind optional.

3. Stufe der obligatorischen rechtlichen Akzeptanz
Die erste Onboarding-Stufe muss deutlich machen, dass Drivest eine Plattform zur Unterstützung beim Fahren ist, die lediglich Orientierungshilfe bietet.
Sie muss deutlich machen, dass Drivest weder das Urteilsvermögen des Benutzers noch einen Fahrlehrer oder das Gesetz ersetzt.
Die Stufe muss Zugriff auf die Allgemeinen Geschäftsbedingungen und die Datenschutzrichtlinie bieten, bevor der Benutzer fortfährt.
Der Benutzer muss aktiv ein Kontrollkästchen aktivieren, bevor er fortfährt.
Die App darf nicht fortgesetzt werden, bis dieses Kontrollkästchen ausgewählt ist.
Dieselbe Stufe erfasst die Altersbestätigung und die Sicherheitsbestätigung als Teil des Akzeptanzereignisses.
Das Backend muss die akzeptierte Version der Bedingungen, der Datenschutzrichtlinie, der Sicherheitshinweise, den Zeitstempel der Akzeptanz, den Quellbildschirm, die App-Version, die Plattform und die Installationskennung speichern, sofern verfügbar.

4. Standortberechtigung
Der Standort sollte über eine In-Context-Aktion und dann über den Berechtigungsdialog des Betriebssystems angefordert werden.
Die erklärende Formulierung sollte konsistent mit der aktuellen Datenschutzposition bleiben:
- Der Standort wird für Routen und Navigation verwendet, wenn diese aktiv sind
- Routen- und Parkfunktionen benötigen den Standort, wenn der Benutzer versucht, sie zu verwenden
- Drivest sollte nicht implizieren, dass ein kontinuierlicher Standortverlauf im Hintergrund auf Servern gespeichert wird

Wenn ein Benutzer die Standortberechtigung ablehnt, kann die App routen- und parkplatzbezogene Funktionen einschränken, sollte jedoch nicht verwandte Lernfunktionen nicht blockieren.
Die App sollte die effektive Standortwahl des Benutzers als einen der folgenden Werte speichern:
- zulassen (allow)
- ablehnen (deny)
- überspringen (skip)

5. Einwilligung zu Analysen
Analysen müssen optional bleiben, wenn die Einwilligung die beabsichtigte Rechtsgrundlage ist.
Das Analyseverhalten sollte deaktiviert bleiben, bis der Benutzer eine zustimmende Wahl trifft.
Die Benutzeroberfläche sollte Analysen so beschreiben, dass sie helfen, die Leistung und Zuverlässigkeit zu verbessern.
Die Schnittstelle darf nicht suggerieren, dass Analysen erforderlich sind, um den Kerndienst zu nutzen.
Das Backend sollte speichern:
- analyticsChoice
- Zeitstempel
- Quelloberfläche
- App-Version
- Plattform
- Installationskennung, sofern verfügbar

6. Einwilligung zu Benachrichtigungen
Benachrichtigungen müssen optional bleiben.
Die Aufforderung sollte ihren betrieblichen Zweck beschreiben, einschließlich Aktualisierungen, Buchungen, Erinnerungen und wichtigen Kontoaktivitäten, sofern relevant.
Benachrichtigungen dürfen standardmäßig nicht voraktiviert sein.
Die App sollte die in der App gewählte Präferenz des Benutzers separat vom Ergebnis der Betriebssystem-Berechtigung speichern.
Das Backend sollte speichern:
- notificationsChoice
- Zeitstempel
- Quelloberfläche
- App-Version
- Plattform
- Installationskennung, sofern verfügbar

7. Anforderungen an die Protokollierung
Das System muss das Ereignis der rechtlichen Akzeptanz separat von den Berechtigungs- und Einwilligungsentscheidungen protokollieren.
Das Backend sollte mindestens speichern:
- Version der Bedingungen
- Version des Datenschutzes
- Version der Sicherheit
- Zeitstempel der Akzeptanz
- Status der Altersbestätigung
- Analysewahl
- Zeitstempel der Analyse
- Benachrichtigungswahl
- Zeitstempel der Benachrichtigung
- Standortwahl
- Zeitstempel des Standorts
- Quellbildschirm oder Quelloberfläche
- App-Version
- Plattform
- Installationskennung, sofern verfügbar

8. Aktuelle Anforderungen an die Implementierung
Das Berechtigungsrahmenwerk muss mit dem tatsächlichen App-Verhalten übereinstimmen.
Wenn der rechtliche Ablauf Analysen als optional beschreibt, müssen Analysen in der Implementierung tatsächlich optional sein.
Wenn die App die Standortwahl als Teil des Onboardings speichert, muss dieses Datenmodell in der internen Compliance-Dokumentation widerspiegelt werden.
Wenn die App später eine neue Berechtigung, ein neues Tracking-Verhalten oder eine kontinuierliche Standortverarbeitung im Hintergrund hinzufügt, müssen das Berechtigungsrahmenwerk, die Datenschutzrichtlinie, der In-App-Text und die Erklärungen im Store alle zusammen vor der Veröffentlichung aktualisiert werden.

9. Endgültiges Inventar der Berechtigungen
Berechtigung oder Auswahl
Endgültige Position

Obligatorische kombinierte rechtliche Bestätigung
Akzeptanz der Bedingungen, Akzeptanz des Datenschutzes, Altersbestätigung und Sicherheitsbestätigung. Erforderlich, bevor der Benutzer das Produkt betreten kann.

Standort
Im Kontext angefordert, um Routen, Navigation und standortabhängige Funktionen zu unterstützen. Vom Betriebssystem gesteuert, aber die App speichert auch einen aufgezeichneten Auswahlstatus.

Analysen
Optionale Einwilligung. Muss deaktiviert bleiben, bis der Benutzer eine zustimmende Wahl trifft.

Benachrichtigungen
Optionale Einwilligung. Darf nicht voraktiviert sein. Die Geräteeinstellungen bleiben die endgültige Berechtigungsinstanz, während die App die in der App gewählte Präferenz des Benutzers speichert.
