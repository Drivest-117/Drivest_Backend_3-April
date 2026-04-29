Juridische onboarding-schermen in de app
Huidig onboarding-model in twee fasen
Versie: 1.1
Laatst bijgewerkt: 5 april 2026
Opgesteld voor: Drivest Limited

Doel van het document
Dit interne document definieert de huidige juridische en toestemmingsflow voor onboarding die is goedgekeurd voor Drivest. Het weerspiegelt de implementatie die nu in de app aanwezig is en vervangt oudere bewoordingen die het opgeslagen toestemmingsmodel niet volledig beschreven.

1. Doelstelling
Dit document definieert de huidige in-app flow voor juridische acceptatie en toestemmingen tijdens de onboarding. Het goedgekeurde model maakt gebruik van twee fasen in plaats van een langere juridische reis over meerdere schermen. Het doel is om wrijving voor de gebruiker te verminderen en tegelijkertijd een geldige juridische erkenning en afzonderlijk geregistreerde keuzes vast te leggen die door de backend kunnen worden gehandhaafd en aangetoond.

2. Fase 1: Gecombineerde juridische acceptatie
Fase 1 is de verplichte toegangspoort tot de app.

Huidige titel:
Voordat u begint

Huidige tekst:
Drivest is een platform voor rijondersteuning. Het biedt uitsluitend begeleiding en vervangt niet uw eigen oordeel, uw instructeur of de wet.

U moet altijd de verkeersborden, verkeersregels en praktijkomstandigheden volgen. Als iets in de app in strijd is met de weg, volg dan de weg.

Door verder te gaan, bevestigt u dat u 16 jaar of ouder bent, dat u de veiligheidswaarschuwing begrijpt en accepteert, en dat u akkoord gaat met de Algemene Voorwaarden en het Privacybeleid.

Vereiste controles:
- Voorwaarden bekijken
- Privacy bekijken
- Eén verplicht selectievakje
- De knop 'Doorgaan' is uitgeschakeld totdat het selectievakje is geselecteerd

Huidige tekst selectievakje:
Ik bevestig dat ik 16 jaar of ouder ben, ik begrijp de veiligheidswaarschuwing en ik ga akkoord met de Algemene Voorwaarden en het Privacybeleid.

Deze fase creëert het gezaghebbende juridische acceptatierecord.
De backend moet het volgende opslaan:
- termsVersion
- privacyVersion
- safetyVersion
- ageConfirmed
- safetyAccepted
- tijdstempel van acceptatie
- sourceScreen
- app-versie
- platform
- installatie-id indien beschikbaar

3. Fase 2: Toestemmingen en optionele toestemming
Fase 2 is het operationele toestemmingsscherm.

Huidige titel:
Toestemmingen

Huidige tekst:
Drivest heeft bepaalde toestemmingen nodig om goed te kunnen werken. Locatie wordt gebruikt voor routes en navigatie wanneer deze actief zijn. Analytics helpt de prestaties en betrouwbaarheid te verbeteren en is optioneel. Meldingen houden u op de hoogte van boekingen en activiteiten.

Vereiste controles:
- Een locatie-actie die de systeemeigen locatietoestemmingsflow activeert
- Afzonderlijke acties voor 'Analytics toestaan' en 'Niet toestaan'
- Afzonderlijke acties voor 'Meldingen inschakelen' en 'Niet nu'
- Knop 'Doorgaan'

Huidige sectie locatie:
Titel: Locatie
Bericht: Locatie wordt gebruikt voor routes en navigatie wanneer deze actief zijn.
Knop: Verzoek om toegang tot locatie

Huidige status van locatietoegang:
- Locatietoegang is al toegestaan voor Drivest.
- Locatietoegang wordt momenteel geweigerd. U kunt doorgaan, maar routefuncties blijven beperkt totdat u dit inschakelt.
- Locatie is voor nu optioneel, maar route- en parkeerfuncties hebben dit nodig wanneer u ze gebruikt.

Huidige sectie analytics:
Titel: Optionele Analytics
Bericht: Analytics helpt de prestaties en betrouwbaarheid te verbeteren en is optioneel.
Acties:
- Analytics toestaan
- Niet toestaan

Huidige sectie meldingen:
Titel: Optionele meldingen
Bericht: Meldingen houden u op de hoogte van boekingen en activiteiten.
Acties:
- Meldingen inschakelen
- Niet nu

4. Backend-mapping
Fase 1 moet minimaal records aanmaken of bijwerken in:
- legal_document_versions
- user_legal_acceptances

Fase 2 moet minimaal records voor de huidige keuze en geschiedenis aanmaken of bijwerken voor:
- analyticsChoice
- notificationsChoice
- locationChoice

Latere wijzigingen in de instellingen moeten worden teruggeschreven naar hetzelfde compliance-model in de backend, zodat Drivest zowel de oorspronkelijke keuze bij onboarding als latere wijzigingen of intrekkingen kan bewijzen waar dit van toepassing is.

5. Harde regels
Geen enkel selectievakje mag vooraf zijn geselecteerd.
De app mag een gebruiker niet toestaan de fase van juridische acceptatie te omzeilen en door te gaan naar het product zonder akkoord te gaan.
De Algemene Voorwaarden en het Privacybeleid moeten toegankelijk zijn vanuit de juridische fase.
De veiligheidswaarschuwing moet deel blijven uitmaken van de tekst voor juridische acceptatie, tenzij de juridische positie wijzigt en de versies dienovereenkomstig worden bijgewerkt.
De toestemmingsfase mag analytics, meldingen en locatie niet bundelen in één vage toestemming.
Elke keuze moet afzonderlijk begrijpelijk en afzonderlijk registreerbaar blijven.
Elke wezenlijke wijziging aan de juridische tekst, het toestemmingsmodel of het gevolgde gedrag moet leiden tot een versie-update en, indien nodig, hernieuwde acceptatie.
