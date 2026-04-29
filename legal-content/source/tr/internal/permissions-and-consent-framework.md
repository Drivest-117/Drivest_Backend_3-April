İzinler ve Onay Çerçevesi
Drivest mobil izinleri, isteğe bağlı onay ve günlük kaydı (logging) modeli
Sürüm
Sürüm 1.1
Son güncelleme
5 Nisan 2026
Drivest Limited için hazırlandı

Belge amacı
Bu dahili belge, mobil deneyimin düşük sürtünmeli, yasal olarak savunulabilir ve mevcut web sitesi, uygulama davranışı ve arka uç günlük kaydı modeliyle tutarlı kalması için uygulamada izinlerin ve onayın nasıl istenmesi gerektiğini tanımlar.

1. Bu belgenin amacı
Bu belge, Drivest için mevcut izin ve onay çerçevesini belirler. Mobil deneyimi kullanılabilir tutarken aynı zamanda aktif yasal, gizlilik ve uygulama mağazası pozisyonuyla uyumlu kalmayı amaçlar.
Temel ilke aynı kalmaktadır. Drivest yalnızca gerekli olan izinleri istemeli, bunları bağlam içinde (in context) istemeli, isteğe bağlı seçenekleri önceden etkinleştirmemeli ve kullanıcının neyi ne zaman seçtiğini kanıtlayabilmelidir.

2. Mevcut kayıt (onboarding) izin modeli
Drivest artık iki aşamalı bir kayıt modeli kullanıyor.

Aşama 1 zorunlu yasal kabulü yönetir. Şunları kapsar:
- Şartlar ve Koşullar kabulü
- Gizlilik Politikası kabulü
- Yaş onayı
- Güvenlik uyarısı kabulü

Aşama 2 operasyonel izinleri ve isteğe bağlı onayı yönetir. Şunları sunar:
- Konum erişimi
- Analitik seçimi
- Bildirim seçimi

Konum, rota ve park ile ilgili özellikler için operasyonel olarak önemlidir ancak yine de bir işletim sistemi izni olarak kalır. Analitik isteğe bağlıdır. Bildirimler isteğe bağlıdır.

3. Zorunlu yasal kabul aşaması
İlk kayıt aşaması, Drivest'in yalnızca rehberlik sağlayan bir sürüş destek platformu olduğunu açıkça belirtmelidir.
Drivest'in kullanıcının muhakemesinin, bir sürüş eğitmeninin veya yasaların yerini almadığını açıkça belirtmelidir.
Aşama, kullanıcı devam etmeden önce Şartlar ve Koşullar ile Gizlilik Politikası'na erişim sağlamalıdır.
Kullanıcı devam etmeden önce aktif olarak bir kutuyu işaretlemelidir.
Uygulama, bu onay kutusu seçilene kadar devam etmemelidir.
Aynı aşama, kabul etkinliğinin bir parçası olarak yaş onayını ve güvenlik kabulünü de yakalar.
Arka uç; kabul edilen şartlar sürümünü, gizlilik sürümünü, güvenlik sürümünü, kabul zaman damgasını, kaynak ekranı, uygulama sürümünü, platformu ve varsa kurulum tanımlayıcısını saklamalıdır.

4. Konum izni
Konum, bağlam içi bir işlem aracılığıyla ve ardından işletim sistemi izin iletişim kutusu aracılığıyla istenmelidir.
Açıklayıcı ifadeler mevcut gizlilik pozisyonuyla tutarlı kalmalıdır:
- Konum, aktif olduğunda rotalar ve navigasyon için kullanılır
- Rota ve park özellikleri, kullanıcı bunları kullanmaya çalıştığında konuma ihtiyaç duyar
- Drivest, sürekli arka plan konum geçmişinin sunucularda saklandığını ima etmemelidir

Bir kullanıcı konum iznini reddederse, uygulama rota ve parkla ilgili özellikleri kısıtlayabilir ancak ilgili olmayan öğrenme özelliklerini engellememelidir.
Uygulama, kullanıcının geçerli konum seçimini şunlardan biri olarak saklamalıdır:
- İzin ver (allow)
- Reddet (deny)
- Atla (skip)

5. Analitik onayı
Onayın amaçlanan yasal dayanak olduğu durumlarda analitik isteğe bağlı kalmalıdır.
Analitik davranışı, kullanıcı olumlu bir seçim yapana kadar kapalı kalmalıdır.
Kullanıcı arayüzü, analitiği performans ve güvenilirliği artırmaya yardımcı olarak tanımlamalıdır.
Arayüz, temel hizmeti kullanmak için analitiğin gerekli olduğunu telkin etmemelidir.
Arka uç şunları saklamalıdır:
- analyticsChoice (analitik seçimi)
- Zaman damgası
- Kaynak yüzey (source surface)
- Uygulama sürümü
- Platform
- Varsa kurulum tanımlayıcısı

6. Bildirim onayı
Bildirimler isteğe bağlı kalmalıdır.
İstem; güncellemeler, rezervasyonlar, hatırlatıcılar ve ilgili durumlarda önemli hesap etkinlikleri dahil olmak üzere operasyonel amaçlarını tanımlamalıdır.
Bildirimler varsayılan olarak önceden etkinleştirilmemelidir.
Uygulama, kullanıcının uygulama içi tercih seçimini işletim sistemi izin sonucundan ayrı olarak saklamalıdır.
Arka uç şunları saklamalıdır:
- notificationsChoice (bildirim seçimi)
- Zaman damgası
- Kaynak yüzey
- Uygulama sürümü
- Platform
- Varsa kurulum tanımlayıcısı

7. Günlük kaydı gereksinimleri
Sistem, yasal kabul etkinliğini izin ve onay seçimlerinden ayrı olarak kaydetmelidir.
En azından arka uç şunları saklamalıdır:
- Şartlar sürümü
- Gizlilik sürümü
- Güvenlik sürümü
- Kabul zaman damgası
- Yaş onay durumu
- Analitik seçimi
- Analitik zaman damgası
- Bildirim seçimi
- Bildirim zaman damgası
- Konum seçimi
- Konum zaman damgası
- Kaynak ekran veya kaynak yüzey
- Uygulama sürümü
- Platform
- Varsa kurulum tanımlayıcısı

8. Mevcut uygulama gereksinimi
İzin çerçevesi, gerçek uygulama davranışıyla eşleşmelidir.
Yasal akış analitiği isteğe bağlı olarak tanımlıyorsa, analitik uygulamada gerçekten isteğe bağlı olmalıdır.
Uygulama, kaydın bir parçası olarak konum seçimini saklıyorsa, bu veri modeli dahili uyumluluk belgelerine yansıtılmalıdır.
Uygulama daha sonra yeni bir izin, yeni bir izleme davranışı veya sürekli arka plan konum işleme eklerse; izin çerçevesi, gizlilik politikası, uygulama içi metinler ve mağaza beyanlarının tümü sürümden önce birlikte güncellenmelidir.

9. Nihai izin envanteri
İzin veya seçim
Nihai pozisyon

Zorunlu birleşik yasal kabul
Şartlar kabulü, Gizlilik kabulü, yaş onayı ve güvenlik kabulü. Kullanıcı ürüne girmeden önce gereklidir.

Konum
Rotaları, navigasyonu ve konuma bağlı özellikleri desteklemek için bağlam içinde istenir. İşletim sistemi tarafından kontrol edilir ancak uygulama aynı zamanda kaydedilmiş bir seçim durumunu da saklar.

Analitik
İsteğe bağlı onay. Kullanıcı olumlu bir seçim yapana kadar kapalı kalmalıdır.

Bildirimler
İsteğe bağlı onay. Önceden etkinleştirilmemelidir. Cihaz ayarları nihai izin yetkisi olarak kalırken, uygulama kullanıcının uygulama içi tercih seçimini saklar.
