# Şarkı Yükleme ve Artist Profil Düzenleme Modernizasyonu

## Değiştirilen dosyalar

- `src/components/Modals/AddTrackModal.tsx`
- `src/components/Modals/EditArtistModal.tsx`
- `src/components/Views/ArtistView.tsx`

## Şarkı yükleme ekranı

- EQ ve playlist oluşturma ekranlarıyla aynı `workspace-screen`, `workspace-card`, `section-reveal` ve `control-press` tasarım sistemi uygulandı.
- Ekran, ana panel içinde tam genişlikte çalışan modern bir workspace görünümüne dönüştürüldü.
- Single, EP ve Album seçimi düz açılır menü yerine açıklamalı seçim kartlarıyla değiştirildi.
- Masaüstünde iki kolonlu; telefon ve dar ekranlarda tek kolonlu responsive düzen kuruldu.
- Sol kolona audio yükleme, URL, Lyria AI ve çoklu tracklist işlemleri taşındı.
- Sağ kolona canlı kapak/release önizlemesi, metadata ve publish kontrolleri yerleştirildi.
- Tekli audio yükleme alanı modern drag-and-drop kartına dönüştürüldü.
- Yüklenen sesin dosya adı, boyutu ve gerçek süresi daha okunaklı gösteriliyor.
- Audio URL alanına metadata doğrulama durumu eklendi.
- Lyria AI alanı model seçimi, durum bilgisi ve üretim butonuyla yeniden tasarlandı.
- EP/Album tracklist satırları modernleştirildi; sürükle-bırak sıralama, yukarı/aşağı taşıma ve silme korunuyor.
- Release kapağı, artist adı, track sayısı, toplam süre ve yıl için canlı önizleme eklendi.
- Çoklu yükleme sırasında ilerleme çubuğu eklendi.
- Tüm buton ve kartlara mevcut açılış/basış animasyonları bağlandı.
- Bozuk kapak URL'sinin önizleme kartını bozması engellendi.
- Yinelenmiş `onChange` attribute hatası kaldırıldı.

## Artist profil düzenleme ekranı

- Eski tek uzun form kartı kaldırılarak EQ/playlist ile aynı modern workspace düzenine geçirildi.
- Artist profil sayfasının altında açılmak yerine orta panelde profil görünümünün yerini alacak şekilde bağlandı.
- Sol tarafta banner, avatar, doğrulanmış hesap rozeti, artist adı, tür, toplam stream ve release sayısını gösteren canlı profil önizlemesi eklendi.
- Artist Pick için ayrı canlı önizleme kartı eklendi.
- Sağ tarafta içerik; görsel kimlik, bio/tür, artist pick ve sosyal bağlantılar olarak ayrı kartlara bölündü.
- Avatar ve banner için hem URL hem dosya yükleme seçenekleri modernleştirildi.
- Artist adı hesapla senkronize ve salt-okunur olarak korunuyor.
- Bio karakter sayacı eklendi.
- Sosyal bağlantılar ikonlu, odak animasyonlu alanlara dönüştürüldü.
- Kaydetme başarı durumu ve kontrollü kapanış korunarak yenilendi.
- Kırık avatar URL'si varsayılan avatarla değiştirilir; kırık banner URL'si temel gradient görünümü bozmaz.
- Bileşendeki koşullu React hook sırası riski kaldırıldı.
- Artist update callback tipi gerçek kaydetme payload'ıyla eşitlendi.

## Doğrulama

- Projedeki 39 TypeScript/TSX dosyasının tamamı sözdizimi açısından kontrol edildi: hata bulunmadı.
- Güncellenen üç bileşen ve bağlı yerel tipler için hedefli TypeScript semantic kontrolü geçti.
- Tam `npm build`, çalışma ortamındaki npm proxy'sinde bazı paketlerin 404 dönmesi nedeniyle çalıştırılamadı.
