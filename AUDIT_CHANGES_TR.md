# VERTEX Music — Mock Veri ve Sahiplik Denetimi

## Kapsam

Kod tabanının tamamı; kullanıcı, artist, şarkı, release, playlist, beğeni, takip, son dinlenenler, sohbet geçmişi, AI üretimi, medya depolama, veritabanı temizleme, Redis senkronizasyonu ve istemci tarafındaki sahiplik kontrolleri açısından tarandı.

Bu sürümde kalıcı veritabanı boş gelir ve uygulama hiçbir demo kullanıcı, artist, şarkı, playlist, beğeni, takip, dinleme geçmişi veya sohbet geçmişi üretmez.

## HTTP hata davranışı

- Gerçekte bulunmayan veya başlangıç temizleyicisi tarafından geçersiz/mock kabul edilerek kaldırılan kullanıcı/artist, şarkı ve playlist kayıtları mevcut 404 akışına düşer.
- Geçersiz biçimli payload ve desteklenmeyen alanlar 400 döndürür.
- Oturum gerektiren işleme oturumsuz erişim 401 döndürür.
- Başka bir hesabın kaynağını değiştirme veya silme denemesi 403 döndürür.
- Veri listelerinde geçersiz kayıtlar sahte bir fallback ile gösterilmez; listeden tamamen çıkarılır.

## Mock ve sentetik içerik temizliği

- Başlangıç veritabanındaki demo kullanıcı, şarkı ve playlist kayıtları kaldırıldı.
- İstemcinin otomatik demo hesap veya demo katalog oluşturma mantığı kaldırıldı.
- Bulunamayan artist için isimden sahte profil üretme/fallback artist mantığı kaldırıldı.
- Sabit mock beğeni, takip, son dinlenen ve playlist parça kimlikleri kaldırıldı.
- Yeni playlist oluştururken sahte parça kimlikleri eklenmesi kaldırıldı.
- AI müzik sağlayıcısı hata verdiğinde prosedürel/sahte ses üretip şarkı gibi kaydetme kaldırıldı.
- AI metninden şarkı adı tahmin edip katalogdaki ilgisiz parçayı eşleşmiş gibi bağlayan sezgisel mock eşleştirme kaldırıldı.
- Sohbet mesajlarındaki track kartları yalnızca veritabanında gerçekten bulunan track ID’lerinden tekrar oluşturuluyor.
- Sabit Unsplash kapakları ve kalıcı sahte medya URL’leri kaldırıldı.
- Sabit 180 saniyelik şarkı süresi varsayımı kaldırıldı; süre gerçek ses metadata’sından alınmak zorunda.
- Gerçekte uygulanmayan lossless, 24-bit/96 kHz, spatial audio, offline download ve sahte premium özellik/ayar kayıtları kaldırıldı.
- Gerçekte aylık ölçüm yapılmadığı halde gösterilen “monthly listeners”, “this month” ve “global top” iddiaları kaldırıldı veya gerçek metriğe göre yeniden adlandırıldı.

## Kullanıcı ve oturum sahipliği

- İstemci artık profil nesnesini `localStorage` içinden güvenilir sahiplik kanıtı olarak kabul etmiyor.
- Tarayıcıda yalnızca oturum token’ı saklanıyor; profil ve sahiplik sunucudan doğrulanıyor.
- Logout mevcut token’ı sunucuda ve Redis oturum kaydında iptal ediyor.
- Profil düzenleme yalnızca aktif oturumun kendi kullanıcı ID’si için yapılabiliyor.
- Admin, artist verification, stream toplamı, takipçi sayısı ve dinleme istatistikleri istemciden değiştirilemiyor.
- Kullanıcı adı ve e-posta benzersizliği kayıt sırasında ve DB sanitizasyonunda doğrulanıyor.
- Parola hash’leniyor; eski düz metin parola başarılı girişten sonra hash’e yükseltiliyor.
- Chat history, likes, recent history, follow state ve listening stats yalnızca aktif hesabın kendi state alanına yazılabiliyor.
- Kullanıcıya özel endpoint’lerde 401/403 ayrımı tutarlı hale getirildi.

## Artist kimliği ve artist profilleri

- Artist kimliği yalnızca değişmez kullanıcı/artist ID’si ile çözülüyor.
- Görünen artist adı üzerinden sahiplik, profil eşleştirme veya yönlendirme yapılmıyor.
- Aynı görünen ada sahip iki hesabın birbirine karışması engellendi.
- Normal kullanıcı hesapları sırf kayıtlı oldukları için artist olarak gösterilmiyor.
- Artist sayfası ve takip endpoint’i yalnızca `isArtist` olan veya gerçekten yayın sahibi hesapları kabul ediyor.
- Boş arama isteğinde normal kullanıcıların artist sonucu olarak sızması düzeltildi.
- Artist pick yalnızca artistin kendi gerçek şarkılarından seçilebiliyor; bulunamayan track 404 döndürüyor.
- Artist adı değiştiğinde sahibine ait şarkıların artist etiketi sunucuda kanonik olarak güncelleniyor.
- Artist stream etiketi veritabanındaki güvenilmez metinden değil, sahibin gerçek track `plays` toplamından türetiliyor.
- Kırık artist görsellerinde yalnızca görsel placeholder zinciri kullanılıyor; yeni/sahte artist kaydı oluşturulmuyor.

## Şarkı sahipliği ve release mantığı

- Track owner `userId` alanı zorunlu hale getirildi.
- Şarkı oluşturma, düzenleme ve silme yalnızca oturum sahibine açık.
- İstemciden gönderilen `artist`, owner veya başka kullanıcı ID’si güvenilmiyor; sunucu aktif hesaptan türetiyor.
- Sahipsiz, sahibi bulunmayan, audio URL’si olmayan veya geçersiz süreli eski track kayıtları DB temizleyicide eleniyor.
- Track ID tekrarları eleniyor.
- Şarkı URL’si ve gerçek pozitif süre zorunlu.
- Desteklenen release tipleri istemci ve sunucuda `SINGLE`, `EP`, `ALBUM` olarak eşitlendi.
- Arayüzde sunucunun kabul etmediği `Compilation` ve `Live Album` seçenekleri kaldırıldı.
- Release tipi ile release başlığı birbirinden ayrıldı; özel EP adı artık yanlışlıkla ALBUM’a dönüşmüyor.
- Release yılı, track numarası, başlıklar, genre, copyright ve lyrics satırları doğrulanıyor ve sınırlandırılıyor.
- Albüm toplu yüklemesi yarıda hata verirse o işlemde daha önce oluşturulan track’ler geri alınıyor; yarım release bırakılmıyor.
- Silinen şarkılar playlist, likes ve recent history referanslarından temizleniyor.
- Track silme ve toplu silme sırasında playlist `trackCount` değeri anında gerçek track listesiyle eşitleniyor.
- “Wipe tracks” endpoint’i artık sistemdeki tüm şarkıları değil yalnızca aktif kullanıcının kendi yüklemelerini siliyor.
- Kullanıcının silinecek yüklemesi yoksa 404 dönüyor.
- Tek şarkı endpoint’i eksik/elenmiş kayıt için gerçek 404 döndürüyor.
- Play sayacı 30 saniye içinde aynı dinleyici-track tekrarlarını tek play olarak sayıyor; eksik track 404.
- Son dinlenenler ve top genre yalnızca sunucunun doğruladığı gerçek play olaylarından güncelleniyor.

## Playlist sahipliği

- Playlist `userId` alanı zorunlu hale getirildi.
- Playlist oluşturma, düzenleme, track ekleme/çıkarma ve silme yalnızca gerçek sahibine açık.
- İstemcinin sahte playlist ID üretip sunucu cevabını yok sayması kaldırıldı; sunucunun oluşturduğu ID ve entity kullanılıyor.
- Başka kullanıcı adına playlist oluşturma engellendi.
- Playlist içine eklenen her track ID’sinin gerçekten var olması zorunlu; eksik ID 404 döndürüyor.
- Playlist track ID’leri tekilleştiriliyor ve `trackCount` gerçek listeden türetiliyor.
- Sahibi olmayan, ID’si tekrarlanan veya geçersiz playlist kayıtları başlangıç temizleyicisinde kaldırılıyor.
- İstemci güncelleme işlemleri owner kontrolü ve başarısız istek rollback’i ile çalışıyor.

## Beğeni, takip ve son dinlenenler

- Likes, follows ve recent history `localStorage` yerine kullanıcıya özel sunucu state’inde tutuluyor.
- Beğeni listesine yalnızca veritabanında bulunan track ID’leri yazılabiliyor; geçersiz ID 404.
- Takip listesine yalnızca gerçek artist ID’leri yazılabiliyor.
- Kullanıcının kendisini takip etmesi engellendi.
- Takipçi ve takip edilen sayıları kalıcı güvenilmez sayaçlardan değil gerçek ilişkilerden tekrar hesaplanıyor.
- Ana sayfadaki karşılama kartları gerçek son dinlenenlerden besleniyor; Liked Songs tek kaynak değil.
- Profildeki kişisel top alanları aylık ölçüm iddiası yerine gerçek recent history olarak gösteriliyor.

## AI sohbet ve müzik üretimi

- AI provider gerçek audio döndürmezse 404 ve “track oluşturulmadı” cevabı veriliyor.
- Geçerli ses süresi çıkarılamazsa 404 dönüyor; sessiz/sahte track kaydı oluşturulmuyor.
- AI provider metin döndürmezse sahte cevap üretmek yerine hata dönüyor.
- AI ile müzik üretme ve kaydetme yalnızca aktif hesabın kendi kullanıcı ID’si için yapılabiliyor.
- Başka hesap bağlamında AI çağrısı 403, oturumsuz çağrı 401.
- Prompt, chat mesajı, history, source ve eşleşen track sayıları sınırlandırıldı.
- Chat history yalnızca gerçek DB track’leriyle sanitize ediliyor.
- İstemcide gösterilen “thinking” metinleri, gerçekleştiği bilinmeyen web araması gibi sahte iç süreç iddiaları taşımıyor.

## Veritabanı bütünlüğü ve Redis

- DB her okumada/yazmada kanonik `sanitizeDBData` işleminden geçiyor.
- Tekrarlanan user ID, username, email, track ID ve playlist ID kayıtları eleniyor.
- Orphan kullanıcı state ve chat history kayıtları kaldırılıyor.
- Track/playlist ilişkileri ve artist pick referansları gerçek entity listesine göre temizleniyor.
- Kullanıcı sayaçları gerçek ownership ve relationship verilerinden tekrar türetiliyor.
- Veritabanı yazımları seri bir kuyruk üzerinden gerçekleştiriliyor; bir yazım bitmeden sonraki okuma eski Redis verisini kullanmıyor.
- Yerel DB yazımı rastgele temp dosyaya yapılıp atomik rename ile tamamlanıyor.
- Upstash ana DB, ID listeleri ve individual entity key’leri aynı kanonik veriden yazılıyor.
- Silinen veya sanitizasyonla reddedilen eski `app:user:*`, `app:song:*`, `app:track:*`, `app:playlist:*` Redis key’leri fiziksel olarak temizleniyor.
- Public Upstash ID ve sistem status endpoint’leri admin oturumu gerektiriyor.

## Medya depolama

- R2 kapalıyken yerel diske kaydedilen dosya ile API’nin döndürdüğü URL aynı gerçek dosya anahtarını kullanıyor.
- Önceki iki ayrı rastgele dosya adı üretme hatası kaldırıldı.
- R2 proxy yolunda path traversal/dizin kaçışı engellendi.
- Audio ve görsel data URL’lerinde MIME türü doğrulanıyor.
- Profil, banner, playlist cover ve track cover URL’leri yalnızca HTTP(S) veya uygulamanın yönettiği upload yollarını kabul ediyor.
- Track silme/toplu silme sırasında artık başka entity tarafından kullanılmayan yönetilen audio/cover dosyaları yerel diskten ve R2’den kaldırılıyor.
- Toplu track silme kullanıcının avatar/banner/playlist cover klasörünü körlemesine silmiyor.

## Arayüz ve yanlış yönlendiren metinler

- “Global Top Songs” yerine gerçek `plays` sıralamasını ifade eden “Most Played on VERTEX” kullanılıyor.
- “Top Charts Global” yerine “Popular on VERTEX” kullanılıyor.
- “Top artists/tracks this month” yerine “Recently played artists/tracks” kullanılıyor.
- `monthlyListeners` alanı kaldırıldı; gerçek anlamını taşıyan `totalStreamsLabel` kullanılıyor.
- Gerçek işlem yapmayan “Show all” düğmeleri kaldırıldı.
- Browse genre eşleştirmesindeki ilk kelimeye göre yanlış filtreleme düzeltildi.
- Podcast filtresinin Ambient parçaları yanlış dahil etmesi düzeltildi.
- Kullanılmayan `ProfileAndPremiumModal` ve `TopSystemBar` dosyaları kaldırıldı.
- Eski AI Studio/demo README ve metadata iddiaları gerçek uygulama davranışına göre güncellendi.

## Bilerek korunan placeholder’lar

`profilePlaceholders.ts` içindeki yerel SVG avatar/cover görselleri yalnızca kırık veya henüz yüklenmemiş görsel alanlarını boş bırakmamak için kullanılır. Bunlar kullanıcı, artist, şarkı veya playlist entity’si oluşturmaz; ID, ownership, plays veya katalog verisi üretmez. Bu nedenle mock domain data olarak değerlendirilmedi.

Browse kategori isimleri ve AI örnek prompt düğmeleri de kalıcı katalog kaydı değildir; yalnızca kullanıcı arayüzü seçenekleridir.

## Doğrulama

- 39 adet TypeScript/TSX dosyası TypeScript transpile/sözdizimi kontrolünden geçti: 0 sözdizimi hatası.
- JSON dosyaları (`data/db.json`, `package.json`, `package-lock.json`, `metadata.json`) parse kontrolünden geçti.
- Mock/demo/fake, eski monthly/global etiketler, unsupported release türleri, isim tabanlı artist ownership ve sahte entity ID kalıpları için tekrar tarama yapıldı.
- Kaynak koddan bağımsız tam `npm build`, çalışma ortamındaki paket registry’sinin bir bağımlılık arşivine 404 vermesi nedeniyle tamamlanamadı. Bağımlılıkların kurulu olmadığı ortamda `tsc --noEmit` yalnızca eksik modül/Node type bildirimleri verdi; proje içi ek TypeScript diagnostik bulunmadı.
