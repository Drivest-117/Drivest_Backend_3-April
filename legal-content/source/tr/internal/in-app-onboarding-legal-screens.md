Uygulama İçi Kayıt (Onboarding) Yasal Ekranları
Mevcut iki aşamalı kayıt modeli
Sürüm
Sürüm 1.1
Son güncelleme
5 Nisan 2026
Drivest Limited için hazırlandı

Belge amacı
Bu dahili belge, Drivest için onaylanan mevcut kayıt yasal ve izin akışını tanımlar. Uygulamada şu anda mevcut olan uygulamayı yansıtır ve saklanan onay modelini tam olarak açıklamayan eski ifadelerin yerini alır.

1. Amaç
Bu belge, yasal kabul ve izinler için mevcut uygulama içi kayıt akışını tanımlar. Onaylanan model, daha uzun, çok ekranlı bir yasal yolculuk yerine iki aşama kullanır. Amaç, geçerli yasal onayları ve arka uç (backend) tarafından uygulanabilen ve kanıtlanabilen ayrı ayrı kaydedilmiş seçimleri yakalarken kullanıcı sürtünmesini azaltmaktır.

2. Aşama 1: Birleşik yasal kabul
Aşama 1, uygulamaya zorunlu giriş kapısıdır.

Mevcut başlık:
Başlamadan önce

Mevcut gövde metni:
Drivest bir sürüş destek platformudur. Yalnızca rehberlik sağlar ve muhakemenizin, eğitmeninizin veya yasaların yerini almaz.

Her zaman yol işaretlerine, trafik yasalarına ve gerçek dünya koşullarına uymalısınız. Uygulamadaki herhangi bir şey yolla çelişirse, yolu takip edin.

Devam ederek, 16 yaşında veya daha büyük olduğunuzu, güvenlik uyarısını anladığınızı ve kabul ettiğinizi, Şartlar ve Koşullar ile Gizlilik Politikası'nı kabul ettiğinizi onaylamış olursunuz.

Gerekli kontroller:
- Şartları Görüntüle
- Gizliliği Görüntüle
- bir adet zorunlu onay kutusu
- Onay kutusu seçilene kadar Devam Et düğmesi devre dışıdır

Mevcut onay kutusu metni:
16 yaşında veya daha büyük olduğumu onaylıyorum, güvenlik uyarısını anlıyorum ve Şartlar ve Koşullar ile Gizlilik Politikası'nı kabul ediyorum.

Bu aşama, yetkili yasal kabul kaydını oluşturur.
Arka uç şunları saklamalıdır:
- termsVersion (şartlar sürümü)
- privacyVersion (gizlilik sürümü)
- safetyVersion (güvenlik sürümü)
- ageConfirmed (yaş onaylandı)
- safetyAccepted (güvenlik kabul edildi)
- kabul zaman damgası
- sourceScreen (kaynak ekran)
- uygulama sürümü
- platform
- varsa kurulum tanımlayıcısı

3. Aşama 2: İzinler ve isteğe bağlı onay
Aşama 2, operasyonel izinler ekranıdır.

Mevcut başlık:
İzinler

Mevcut gövde metni:
Drivest'in düzgün çalışması için belirli izinlere ihtiyacı vardır. Konum, aktif olduğunda rotalar ve navigasyon için kullanılır. Analitik, performans ve güvenilirliği artırmaya yardımcı olur ve isteğe bağlıdır. Bildirimler sizi rezervasyonlar ve etkinlikler hakkında güncel tutar.

Gerekli kontroller:
- yerel konum izni akışını tetikleyen bir konum işlemi
- ayrı analitik 'izin ver' ve 'izin verme' işlemleri
- ayrı bildirim 'etkinleştir' ve 'şimdi değil' işlemleri
- Devam Et düğmesi

Mevcut konum bölümü:
Başlık: Konum
Mesaj: Konum, aktif olduğunda rotalar ve navigasyon için kullanılır.
Düğme: Konum erişimi iste

Mevcut konum durumu halleri:
- Drivest için konum erişimine zaten izin verildi.
- Konum erişimi şu anda reddedildi. Devam edebilirsiniz ancak siz etkinleştirene kadar rota özellikleri sınırlı kalacaktır.
- Konum şimdilik isteğe bağlıdır ancak rota ve park özelliklerini kullandığınızda buna ihtiyaç duyulur.

Mevcut analitik bölümü:
Başlık: İsteğe Bağlı Analitik
Mesaj: Analitik, performans ve güvenilirliği artırmaya yardımcı olur ve isteğe bağlıdır.
İşlemler:
- Analitiğe İzin Ver
- İzin Verme

Mevcut bildirimler bölümü:
Başlık: İsteğe Bağlı Bildirimler
Mesaj: Bildirimler sizi rezervasyonlar ve etkinlikler hakkında güncel tutar.
İşlemler:
- Bildirimleri Etkinleştir
- Şimdi Değil

4. Arka uç eşleştirmesi
En azından Aşama 1 şuralarda kayıt oluşturmalı veya güncellemelidir:
- legal_document_versions
- user_legal_acceptances

En azından Aşama 2 şunlar için mevcut seçim ve geçmiş kayıtlarını oluşturmalı veya güncellemelidir:
- analyticsChoice
- notificationsChoice
- locationChoice

Daha sonraki ayar değişiklikleri aynı arka uç uyumluluk modeline geri yazılmalıdır; böylece Drivest hem orijinal kayıt seçimini hem de uygun olduğunda daha sonraki değişiklikleri veya geri çekmeleri kanıtlayabilir.

5. Katı kurallar
Hiçbir onay kutusu önceden seçilmiş olamaz.
Uygulama, bir kullanıcının yasal kabul aşamasını atlamasına ve anlaşma olmadan ürüne devam etmesine izin vermemelidir.
Şartlar ve Koşullar ile Gizlilik Politikası'na yasal aşamadan erişilebilmelidir.
Yasal konum değişmediği ve sürümler buna göre güncellenmediği sürece güvenlik uyarısı yasal kabul metninin bir parçası olarak kalmalıdır.
İzinler aşaması analitik, bildirimler ve konumu tek bir belirsiz onayda birleştirmemelidir.
Her seçim ayrı ayrı anlaşılabilir ve ayrı ayrı kaydedilebilir olmalıdır.
Yasal metinde, izin modelinde veya izlenen davranışta yapılacak herhangi bir maddi değişiklik, sürüm güncellemesini ve gerektiğinde yeniden kabulü tetiklemelidir.
