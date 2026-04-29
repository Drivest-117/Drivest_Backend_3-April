In-App-Onboarding Rechtliche Bildschirme
Aktuelles zweistufiges Onboarding-Modell
Version
Version 1.1
Zuletzt aktualisiert
5. April 2026
Erstellt für
Drivest Limited

Zweck des Dokuments
Dieses interne Dokument definiert den aktuellen, für Drivest genehmigten Ablauf für rechtliche Hinweise und Berechtigungen beim Onboarding. Es spiegelt die derzeit in der App vorhandene Implementierung wider und ersetzt ältere Formulierungen, die das Modell der gespeicherten Einwilligung nicht vollständig beschrieben haben.

1. Zielsetzung
Dieses Dokument definiert den aktuellen In-App-Onboarding-Ablauf für die rechtliche Akzeptanz und Berechtigungen. Das genehmigte Modell verwendet zwei Stufen anstelle einer längeren rechtlichen Reise über mehrere Bildschirme. Ziel ist es, die Reibung für den Benutzer zu verringern und gleichzeitig eine gültige rechtliche Bestätigung sowie separat aufgezeichnete Entscheidungen zu erfassen, die vom Backend durchgesetzt und nachgewiesen werden können.

2. Stufe 1: Kombinierte rechtliche Akzeptanz
Stufe 1 ist das obligatorische Eingangstor zur App.

Aktueller Titel:
Bevor Sie beginnen

Aktueller Textkörper:
Drivest ist eine Plattform zur Unterstützung beim Fahren. Sie bietet lediglich Orientierungshilfe und ersetzt weder Ihr Urteilsvermögen noch Ihren Fahrlehrer oder das Gesetz.

Sie müssen stets die Straßenschilder, Verkehrsregeln und realen Bedingungen befolgen. Wenn etwas in der App im Widerspruch zur Straße steht, folgen Sie der Straße.

Indem Sie fortfahren, bestätigen Sie, dass Sie 16 Jahre oder älter sind, dass Sie den Sicherheitshinweis verstehen und akzeptieren und dass Sie den Allgemeinen Geschäftsbedingungen und der Datenschutzrichtlinie zustimmen.

Erforderliche Steuerelemente:
- Bedingungen anzeigen
- Datenschutz anzeigen
- ein obligatorisches Kontrollkästchen
- Schaltfläche "Weiter" deaktiviert, bis das Kontrollkästchen ausgewählt ist

Aktueller Text des Kontrollkästchens:
Ich bestätige, dass ich 16 Jahre oder älter bin, ich verstehe den Sicherheitshinweis und stimme den Allgemeinen Geschäftsbedingungen und der Datenschutzrichtlinie zu.

Diese Stufe erstellt den maßgeblichen Datensatz für die rechtliche Akzeptanz.
Das Backend sollte speichern:
- termsVersion (Version der Bedingungen)
- privacyVersion (Version des Datenschutzes)
- safetyVersion (Version der Sicherheit)
- ageConfirmed (Alter bestätigt)
- safetyAccepted (Sicherheit akzeptiert)
- Zeitstempel der Akzeptanz
- sourceScreen (Quellbildschirm)
- App-Version
- Plattform
- Installationskennung, sofern verfügbar

3. Stufe 2: Berechtigungen und optionale Einwilligung
Stufe 2 ist der Bildschirm für betriebliche Berechtigungen.

Aktueller Titel:
Berechtigungen

Aktueller Textkörper:
Drivest benötigt bestimmte Berechtigungen, um ordnungsgemäß zu funktionieren. Der Standort wird für Routen und Navigation verwendet, wenn diese aktiv sind. Analysen helfen, die Leistung und Zuverlässigkeit zu verbessern, und sind optional. Benachrichtigungen halten Sie über Buchungen und Aktivitäten auf dem Laufenden.

Erforderliche Steuerelemente:
- eine Standortaktion, die den nativen Standortberechtigungsablauf des Systems auslöst
- separate Aktionen für Analysen zulassen und nicht zulassen
- separate Aktionen für Benachrichtigungen aktivieren und jetzt nicht
- Schaltfläche "Weiter"

Aktueller Standort-Abschnitt:
Titel: Standort
Nachricht: Der Standort wird für Routen und Navigation verwendet, wenn diese aktiv sind.
Schaltfläche: Standortzugriff anfordern

Aktuelle Zustände des Standortstatus:
- Der Standortzugriff ist für Drivest bereits erlaubt.
- Der Standortzugriff wird derzeit abgelehnt. Sie können fortfahren, aber die Routenfunktionen bleiben eingeschränkt, bis Sie ihn aktivieren.
- Der Standort ist vorerst optional, aber Routen- und Parkfunktionen benötigen ihn, wenn Sie sie verwenden.

Aktueller Analyse-Abschnitt:
Titel: Optionale Analysen
Nachricht: Analysen helfen, die Leistung und Zuverlässigkeit zu verbessern, und sind optional.
Aktionen:
- Analysen zulassen
- Nicht zulassen

Aktueller Benachrichtigungs-Abschnitt:
Titel: Optionale Benachrichtigungen
Nachricht: Benachrichtigungen halten Sie über Buchungen und Aktivitäten auf dem Laufenden.
Aktionen:
- Benachrichtigungen aktivieren
- Jetzt nicht

4. Backend-Mapping
Stufe 1 sollte mindestens Datensätze erstellen oder aktualisieren in:
- legal_document_versions
- user_legal_acceptances

Stufe 2 sollte mindestens aktuelle Auswahl- und Historien-Datensätze erstellen oder aktualisieren für:
- analyticsChoice
- notificationsChoice
- locationChoice

Spätere Einstellungsänderungen müssen in dasselbe Backend-Compliance-Modell zurückgeschrieben werden, damit Drivest sowohl die ursprüngliche Onboarding-Auswahl als auch spätere Änderungen oder Widerrufe nachweisen kann.

5. Harte Regeln
Kein Kontrollkästchen darf vorselektiert sein.
Die App darf einem Benutzer nicht erlauben, die Stufe der rechtlichen Akzeptanz zu umgehen und das Produkt ohne Zustimmung fortzusetzen.
Die Allgemeinen Geschäftsbedingungen und die Datenschutzrichtlinie müssen von der rechtlichen Stufe aus zugänglich sein.
Der Sicherheitshinweis muss Teil des Textes für die rechtliche Akzeptanz bleiben, es sei denn, die rechtliche Position ändert sich und die Versionen werden entsprechend aktualisiert.
Die Berechtigungsstufe darf Analysen, Benachrichtigungen und den Standort nicht zu einer einzigen vagen Einwilligung bündeln.
Jede Auswahl muss separat verständlich und separat aufzeichenbar bleiben.
Jede wesentliche Änderung am rechtlichen Text, am Berechtigungsmodell oder am verfolgten Verhalten sollte eine Versionsaktualisierung und eine erneute Akzeptanz auslösen, sofern erforderlich.
