Kader voor toestemmingen en instemming
Drivest mobiele toestemmingen, optionele instemming en logmodel
Versie: 1.1
Laatst bijgewerkt: 5 april 2026
Opgesteld voor: Drivest Limited

Doel van het document
Dit interne document definieert hoe toestemmingen en instemming nu in de app moeten worden gevraagd, zodat de mobiele reis frictiearm blijft, juridisch verdedigbaar is en consistent is met de huidige website, het gedrag van de app en het logmodel van de backend.

1. Doel van dit document
Dit document zet het huidige kader voor toestemming en instemming voor Drivest uiteen. Het is bedoeld om de mobiele ervaring bruikbaar te houden terwijl deze in lijn blijft met de actieve juridische, privacy- en app store-positie.
Het kernprincipe blijft hetzelfde: Drivest mag alleen vragen om toestemmingen die noodzakelijk zijn, moet deze in de juiste context vragen, mag optionele keuzes niet vooraf inschakelen en moet kunnen bewijzen wat de gebruiker wanneer heeft gekozen.

2. Huidig toestemmingsmodel voor onboarding
Drivest gebruikt nu een onboarding-model in twee fasen.

Fase 1 behandelt de verplichte juridische acceptatie. Het omvat:
- Acceptatie van de Algemene Voorwaarden
- Acceptatie van het Privacybeleid
- Leeftijdsbevestiging
- Erkenning van de veiligheidswaarschuwing

Fase 2 behandelt de operationele toestemmingen en optionele instemming. Het presenteert:
- Locatietoegang
- Keuze voor analytics
- Keuze voor meldingen

Locatie is operationeel belangrijk voor route- en parkeergerelateerde functies, maar blijft een toestemming van het besturingssysteem. Analytics is optioneel. Meldingen zijn optioneel.

3. Verplichte fase van juridische acceptatie
De eerste onboarding-fase moet duidelijk maken dat Drivest een platform voor rijondersteuning is dat uitsluitend begeleiding biedt.
Het moet duidelijk maken dat Drivest niet in de plaats komt van het oordeel van de gebruiker, een rijinstructeur of de wet.
De fase moet toegang bieden tot de Algemene Voorwaarden en het Privacybeleid voordat de gebruiker verdergaat.
De gebruiker moet actief een vakje aanvinken voordat hij verdergaat.
De app mag niet verdergaan totdat dat selectievakje is aangevinkt.
Dezelfde fase legt de leeftijdsbevestiging en veiligheidserkenning vast als onderdeel van de acceptatiegebeurtenis.
De backend moet de geaccepteerde versie van de voorwaarden, de privacyversie, de veiligheidsversie, de tijdstempel van acceptatie, het bronscherm, de app-versie, het platform en de installatie-id (indien beschikbaar) opslaan.

4. Locatietoestemming
Locatie moet worden gevraagd via een actie in de context en vervolgens via de toestemmingsdialoog van het besturingssysteem.
De uitleg moet consistent blijven met de huidige privacypositie:
- Locatie wordt gebruikt voor routes en navigatie wanneer deze actief zijn.
- Route- en parkeerfuncties hebben locatie nodig wanneer de gebruiker deze probeert te gebruiken.
- Drivest mag niet suggereren dat er een continue locatiegeschiedenis op de achtergrond op servers wordt opgeslagen.

Als een gebruiker locatietoestemming weigert, kan de app route- en parkeergerelateerde functies beperken, maar mag de app niet-gerelateerde leerfuncties niet blokkeren.
De app moet de effectieve locatiekeuze van de gebruiker opslaan als een van de volgende:
- Toestaan
- Weigeren
- Overslaan

5. Instemming voor analytics
Analytics moet optioneel blijven waar instemming de beoogde juridische basis is.
Analytics-gedrag moet uit blijven staan totdat de gebruiker een bevestigende keuze maakt.
De gebruikersinterface moet analytics omschrijven als een middel om de prestaties en betrouwbaarheid te verbeteren.
De interface mag niet suggereren dat analytics vereist is om de kerndienst te gebruiken.
De backend moet het volgende opslaan:
- analyticsChoice
- tijdstempel
- bronoppervlak
- app-versie
- platform
- installatie-id indien beschikbaar

6. Instemming voor meldingen
Meldingen moeten optioneel blijven.
De prompt moet het operationele doel ervan beschrijven, inclusief updates, boekingen, herinneringen en belangrijke accountactiviteiten waar relevant.
Meldingen mogen niet standaard vooraf zijn ingeschakeld.
De app moet de in-app voorkeurskeuze van de gebruiker afzonderlijk van het toestemmingsresultaat van het besturingssysteem opslaan.
De backend moet het volgende opslaan:
- notificationsChoice
- tijdstempel
- bronoppervlak
- app-versie
- platform
- installatie-id indien beschikbaar

7. Logvereisten
Het systeem moet de juridische acceptatiegebeurtenis afzonderlijk van de keuzes voor toestemming en instemming loggen.
De backend moet minimaal het volgende opslaan:
- versie voorwaarden
- privacyversie
- veiligheidsversie
- tijdstempel acceptatie
- status leeftijdsbevestiging
- keuze analytics
- tijdstempel analytics
- keuze meldingen
- tijdstempel meldingen
- keuze locatie
- tijdstempel locatie
- bronscherm of bronoppervlak
- app-versie
- platform
- installatie-id indien beschikbaar

8. Vereisten voor de huidige implementatie
Het toestemmingskader moet overeenkomen met het werkelijke gedrag van de app.
Als de juridische flow analytics als optioneel beschrijft, moet analytics in de implementatie ook daadwerkelijk optioneel zijn.
Als de app de locatiekeuze opslaat als onderdeel van de onboarding, moet dat datamodel worden weerspiegeld in de interne compliance-documentatie.
Als de app later een nieuwe toestemming, nieuw trackinggedrag of continue locatieverwerking op de achtergrond toevoegt, moeten het toestemmingskader, het privacybeleid, de tekst in de app en de verklaringen in de stores allemaal tegelijk worden bijgewerkt voor de release.

9. Definitief overzicht van toestemmingen
Toestemming of keuze: Definitieve positie

Verplichte gecombineerde juridische erkenning
Acceptatie van voorwaarden, acceptatie van privacy, leeftijdsbevestiging en veiligheidserkenning. Vereist voordat de gebruiker toegang krijgt tot het product.

Locatie
Gevraagd in de context ter ondersteuning van routes, navigatie en locatieafhankelijke functies. Beheerd door het besturingssysteem, maar de app slaat ook een geregistreerde keuzestatus op.

Analytics
Optionele instemming. Moet uit blijven staan totdat de gebruiker een bevestigende keuze maakt.

Meldingen
Optionele instemming. Mag niet vooraf zijn ingeschakeld. Instellingen op het apparaat blijven de uiteindelijke autoriteit voor toestemming, terwijl de app de in-app voorkeurskeuze van de gebruiker opslaat.
