Ramy uprawnień i zgód
Uprawnienia mobilne Drivest, opcjonalna zgoda i model logowania
Wersja
Wersja 1.1
Ostatnia aktualizacja
5 kwietnia 2026 r.
Przygotowano dla
Drivest Limited

Cel dokumentu
Niniejszy dokument wewnętrzny definiuje, w jaki sposób uprawnienia i zgody powinny być teraz żądane w aplikacji, aby ścieżka mobilna pozostała mało uciążliwa, możliwa do obrony prawnej i spójna z obecną stroną internetową, zachowaniem aplikacji i modelem logowania backendu.

1. Cel niniejszego dokumentu
Niniejszy dokument określa obecne ramy uprawnień i zgód dla Drivest. Jego celem jest utrzymanie użyteczności doświadczenia mobilnego przy jednoczesnym zachowaniu zgodności z aktywną pozycją prawną, prywatnością i wymogami sklepów z aplikacjami.
Główna zasada pozostaje taka sama: Drivest powinien prosić tylko o te uprawnienia, które są niezbędne, powinien prosić o nie w odpowiednim kontekście, nie powinien domyślnie włączać opcjonalnych wyborów i powinien być w stanie udowodnić, co i kiedy wybrał użytkownik.

2. Obecny model uprawnień w onboardingu
Drivest stosuje obecnie dwuetapowy model onboardingu.

Etap 1 obsługuje obowiązkową akceptację prawną. Obejmuje on:
- akceptację Regulaminu
- akceptację Polityki Prywatności
- potwierdzenie wieku
- potwierdzenie zapoznania się z informacją o bezpieczeństwie

Etap 2 obsługuje uprawnienia operacyjne i opcjonalną zgodę. Prezentuje on:
- dostęp do lokalizacji
- wybór dotyczący analityki
- wybór dotyczący powiadomień

Lokalizacja jest ważna operacyjnie dla funkcji związanych z trasami i parkowaniem, ale nadal pozostaje uprawnieniem systemu operacyjnego. Analityka jest opcjonalna. Powiadomienia są opcjonalne.

3. Etap obowiązkowej akceptacji prawnej
Pierwszy etap onboardingu musi jasno komunikować, że Drivest jest platformą wspierającą kierowców, która zapewnia wyłącznie wskazówki.
Musi jasno komunikować, że Drivest nie zastępuje osądu użytkownika, instruktora jazdy ani prawa.
Etap ten musi zapewniać dostęp do Regulaminu i Polityki Prywatności przed kontynuowaniem przez użytkownika.
Użytkownik musi aktywnie zaznaczyć pole wyboru przed kontynuowaniem.
Aplikacja nie może pozwolić na kontynuację, dopóki to pole wyboru nie zostanie zaznaczone.
Ten sam etap rejestruje potwierdzenie wieku i potwierdzenie bezpieczeństwa jako część zdarzenia akceptacji.
Backend musi przechowywać zaakceptowaną wersję regulaminu, wersję polityki prywatności, wersję informacji o bezpieczeństwie, znacznik czasu akceptacji, ekran źródłowy, wersję aplikacji, platformę i identyfikator instalacji, jeśli jest dostępny.

4. Uprawnienie do lokalizacji
Lokalizacja powinna być żądana poprzez akcję w odpowiednim kontekście, a następnie poprzez systemowe okno dialogowe uprawnień.
Sformułowanie wyjaśniające powinno pozostać spójne z obecnym stanowiskiem dotyczącym prywatności:
- lokalizacja jest używana do wyznaczania tras i nawigacji, gdy są one aktywne
- funkcje tras i parkowania wymagają lokalizacji, gdy użytkownik próbuje z nich skorzystać
- Drivest nie powinien sugerować, że na serwerach przechowywana jest ciągła historia lokalizacji w tle

Jeśli użytkownik odmówi uprawnień do lokalizacji, aplikacja może ograniczyć funkcje związane z trasami i parkowaniem, ale nie powinna blokować niepowiązanych funkcji edukacyjnych.
Aplikacja powinna przechowywać faktyczny wybór lokalizacji użytkownika jako jeden z poniższych:
- allow (zezwól)
- deny (odmów)
- skip (pomiń)

5. Zgoda na analitykę
Analityka musi pozostać opcjonalna, gdy podstawą prawną jest zgoda.
Działanie analityki powinno pozostać wyłączone, dopóki użytkownik nie dokona twierdzącego wyboru.
Interfejs użytkownika powinien opisywać analitykę jako pomoc w poprawie wydajności i niezawodności.
Interfejs nie może sugerować, że analityka jest wymagana do korzystania z podstawowej usługi.
Backend powinien przechowywać:
- analyticsChoice
- znacznik czasu
- powierzchnię źródłową
- wersję aplikacji
- platformę
- identyfikator instalacji, jeśli jest dostępny

6. Zgoda na powiadomienia
Powiadomienia muszą pozostać opcjonalne.
Komunikat powinien opisywać ich cel operacyjny, w tym aktualizacje, rezerwacje, przypomnienia i ważne działania na koncie, tam gdzie ma to zastosowanie.
Powiadomienia nie mogą być domyślnie włączone.
Aplikacja powinna przechowywać preferencje użytkownika w aplikacji oddzielnie od wyniku uprawnień systemu operacyjnego.
Backend powinien przechowywać:
- notificationsChoice
- znacznik czasu
- powierzchnię źródłową
- wersję aplikacji
- platformę
- identyfikator instalacji, jeśli jest dostępny

7. Wymogi dotyczące logowania
System musi logować zdarzenie akceptacji prawnej oddzielnie od wyborów dotyczących uprawnień i zgód.
Co najmniej backend powinien przechowywać:
- wersję regulaminu
- wersję polityki prywatności
- wersję informacji o bezpieczeństwie
- znacznik czasu akceptacji
- stan potwierdzenia wieku
- wybór dotyczący analityki
- znacznik czasu analityki
- wybór dotyczący powiadomień
- znacznik czasu powiadomień
- wybór dotyczący lokalizacji
- znacznik czasu lokalizacji
- ekran lub powierzchnię źródłową
- wersję aplikacji
- platformę
- identyfikator instalacji, jeśli jest dostępny

8. Bieżący wymóg wdrożenia
Ramy uprawnień muszą odpowiadać rzeczywistemu zachowaniu aplikacji.
Jeśli proces prawny opisuje analitykę jako opcjonalną, analityka musi faktycznie być opcjonalna we wdrożeniu.
Jeśli aplikacja przechowuje wybór lokalizacji jako część onboardingu, ten model danych musi być odzwierciedlony w wewnętrznej dokumentacji zgodności.
Jeśli aplikacja doda później nowe uprawnienie, nowe zachowanie śledzenia lub ciągłe przetwarzanie lokalizacji w tle, ramy uprawnień, polityka prywatności, treści w aplikacji i deklaracje sklepowe muszą zostać zaktualizowane jednocześnie przed wydaniem nowej wersji.

9. Końcowy inwentarz uprawnień
Uprawnienie lub wybór
Ostateczne stanowisko

Obowiązkowe połączone potwierdzenie prawne
Akceptacja Regulaminu, akceptacja Polityki Prywatności, potwierdzenie wieku i potwierdzenie bezpieczeństwa. Wymagane, zanim użytkownik będzie mógł wejść do produktu.

Lokalizacja
Żądana w odpowiednim kontekście w celu wsparcia tras, nawigacji i funkcji zależnych od lokalizacji. Kontrolowana przez system operacyjny, ale aplikacja przechowuje również stan zarejestrowanego wyboru.

Analityka
Opcjonalna zgoda. Musi pozostać wyłączona, dopóki użytkownik nie dokona twierdzącego wyboru.

Powiadomienia
Opcjonalna zgoda. Nie mogą być wstępnie włączone. Ustawienia urządzenia pozostają ostatecznym organem ds. uprawnień, podczas gdy aplikacja przechowuje wybór preferencji użytkownika w aplikacji.
