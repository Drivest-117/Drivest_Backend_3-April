Ekrany prawne onboardingu w aplikacji
Obecny dwuetapowy model onboardingu
Wersja
Wersja 1.1
Ostatnia aktualizacja
5 kwietnia 2026 r.
Przygotowano dla
Drivest Limited

Cel dokumentu
Niniejszy dokument wewnętrzny definiuje aktualny proces onboardingu w zakresie kwestii prawnych i uprawnień zatwierdzony dla Drivest. Odzwierciedla on wdrożenie obecne w aplikacji i zastępuje starsze sformułowania, które nie w pełni opisywały model przechowywanej zgody.

1. Cel
Niniejszy dokument definiuje obecny proces onboardingu w aplikacji w zakresie akceptacji prawnej i uprawnień. Zatwierdzony model wykorzystuje dwa etapy zamiast dłuższej, wieloekranowej ścieżki prawnej. Celem jest zmniejszenie tarcia użytkownika przy jednoczesnym uzyskaniu ważnego potwierdzenia prawnego i oddzielnie rejestrowanych wyborów, które mogą być egzekwowane i dokumentowane przez backend.

2. Etap 1: Połączona akceptacja prawna
Etap 1 jest obowiązkową bramą wejściową do aplikacji.

Obecny tytuł:
Zanim zaczniesz

Obecna treść:
Drivest to platforma wspierająca kierowców. Zapewnia ona wyłącznie wskazówki i nie zastępuje Twojego osądu, Twojego instruktora ani prawa.

Musisz zawsze stosować się do znaków drogowych, przepisów ruchu drogowego i warunków rzeczywistych. Jeśli cokolwiek w aplikacji jest sprzeczne z sytuacją na drodze, kieruj się sytuacją na drodze.

Kontynuując, potwierdzasz, że masz ukończone 16 lat, że rozumiesz i akceptujesz informację o bezpieczeństwie oraz że wyrażasz zgodę na Regulamin i Politykę Prywatności.

Wymagane elementy sterujące:
- Wyświetl Regulamin
- Wyświetl Politykę Prywatności
- jedno obowiązkowe pole wyboru (checkbox)
- przycisk Kontynuuj wyłączony do momentu zaznaczenia pola wyboru

Obecny tekst pola wyboru:
Potwierdzam, że mam ukończone 16 lat, rozumiem informację o bezpieczeństwie oraz zgadzam się na Regulamin i Politykę Prywatności.

Ten etap tworzy autorytatywny rekord akceptacji prawnej.
Backend powinien przechowywać:
- termsVersion (wersja regulaminu)
- privacyVersion (wersja polityki prywatności)
- safetyVersion (wersja informacji o bezpieczeństwie)
- ageConfirmed (potwierdzenie wieku)
- safetyAccepted (akceptacja bezpieczeństwa)
- acceptance timestamp (znacznik czasu akceptacji)
- sourceScreen (ekran źródłowy)
- app version (wersja aplikacji)
- platform (platforma)
- install identifier (identyfikator instalacji, jeśli jest dostępny)

3. Etap 2: Uprawnienia i opcjonalna zgoda
Etap 2 to ekran uprawnień operacyjnych.

Obecny tytuł:
Uprawnienia

Obecna treść:
Drivest potrzebuje określonych uprawnień do poprawnego działania. Lokalizacja jest używana do wyznaczania tras i nawigacji, gdy są one aktywne. Analityka pomaga poprawić wydajność oraz niezawodność i jest opcjonalna. Powiadomienia informują Cię o rezerwacjach i aktywności.

Wymagane elementy sterujące:
- akcja lokalizacji, która uruchamia systemowy proces udzielania uprawnień lokalizacyjnych
- oddzielne akcje „zezwól” i „nie zezwalaj” dla analityki
- oddzielne akcje „włącz” i „nie teraz” dla powiadomień
- przycisk Kontynuuj

Obecna sekcja lokalizacji:
Tytuł: Lokalizacja
Komunikat: Lokalizacja jest używana do wyznaczania tras i nawigacji, gdy są one aktywne.
Przycisk: Poproś o dostęp do lokalizacji

Obecne stany statusu lokalizacji:
- Dostęp do lokalizacji jest już dozwolony dla Drivest.
- Dostęp do lokalizacji jest obecnie zabroniony. Możesz kontynuować, ale funkcje tras pozostaną ograniczone, dopóki go nie włączysz.
- Lokalizacja jest obecnie opcjonalna, ale funkcje tras i parkowania wymagają jej, gdy z nich korzystasz.

Obecna sekcja analityki:
Tytuł: Opcjonalna analityka
Komunikat: Analityka pomaga poprawić wydajność oraz niezawodność i jest opcjonalna.
Akcje:
- Zezwól na analitykę
- Nie zezwalaj

Obecna sekcja powiadomień:
Tytuł: Opcjonalne powiadomienia
Komunikat: Powiadomienia informują Cię o rezerwacjach i aktywności.
Akcje:
- Włącz powiadomienia
- Nie teraz

4. Mapowanie backendu
Co najmniej Etap 1 powinien tworzyć lub aktualizować rekordy w:
- legal_document_versions
- user_legal_acceptances

Co najmniej Etap 2 powinien tworzyć lub aktualizować rekordy bieżącego wyboru i historii dla:
- analyticsChoice
- notificationsChoice
- locationChoice

Późniejsze zmiany ustawień muszą być zapisywane z powrotem w tym samym modelu zgodności backendu, aby Drivest mógł udowodnić zarówno pierwotny wybór podczas onboardingu, jak i późniejsze zmiany lub wycofania zgód, jeśli dotyczy.

5. Twarde zasady
Żadne pole wyboru nie może być wstępnie zaznaczone.
Aplikacja nie może pozwalać użytkownikowi na obejście etapu akceptacji prawnej i kontynuowanie korzystania z produktu bez zgody.
Regulamin i Polityka Prywatności muszą być dostępne z poziomu etapu prawnego.
Informacja o bezpieczeństwie musi pozostać częścią treści akceptacji prawnej, chyba że stanowisko prawne ulegnie zmianie, a wersje zostaną odpowiednio zaktualizowane.
Etap uprawnień nie może łączyć analityki, powiadomień i lokalizacji w jedną niejasną zgodę.
Każdy wybór musi pozostać oddzielnie zrozumiały i oddzielnie rejestrowalny.
Każda istotna zmiana treści prawnej, modelu uprawnień lub śledzonego zachowania powinna skutkować aktualizacją wersji i ponowną akceptacją, jeśli jest to wymagane.
