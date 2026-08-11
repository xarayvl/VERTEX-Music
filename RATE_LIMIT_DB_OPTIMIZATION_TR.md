# API ve veritabanı optimizasyonları

## Bulunan başlıca sorunlar

- Upstash açıksa her API isteği Redis'ten bütün veritabanını yeniden okuyordu.
- Tek bir kullanıcı istatistiği değiştiğinde bile ana DB, yedek DB, bütün indeksler ve bütün entity anahtarları tekrar yazılıyordu.
- Her DB yazımında dört ayrı wildcard `KEYS` taraması yapılıyordu.
- Katalog 20 saniyede bir yenileniyor; `focus` ve `visibilitychange` aynı anda ek istekler başlatabiliyordu.
- Arama alanındaki her yazım değişikliği `/api/search` isteği gönderiyordu; oysa tam katalog istemcide zaten vardı.
- Chat geçmişi ilk hydrate sırasında ve her küçük state değişiminde yeniden yazılıyordu.
- Dinleme süresi 15 saniyede bir kalıcı DB yazımı oluşturuyordu.
- Genel API, auth ve Gemini yollarında uygulama seviyesinde istemci rate limit yoktu.

## Yapılan değişiklikler

- Salt-okunur DB çağrılarına 5 saniyelik proses cache'i eklendi. Mutation yolları çoklu-instance veri kaybını önlemek için yazmadan önce hâlâ güncel Redis snapshot'ını zorunlu okur.
- Redis senkronizasyonu diff tabanlı hale getirildi: yalnız değişen entity ve indeksler yazılır.
- Full DB yedeği her küçük sayaç değişiminde yazılmak yerine yapısal değişiklikte veya en fazla 15 dakikalık aralıkla güncellenir.
- Wildcard `KEYS` taramaları kaldırıldı; silinen anahtarlar önceki canonical snapshot ile hesaplanır.
- Aynı DB içeriğini tekrar yazan no-op işlemler disk/Redis yazımı yapmadan sonuçlanır.
- Chat ve dinleme istatistiği endpoint'lerine aynı veri için no-op yanıtı eklendi.
- Arka plan katalog yenilemesi 60 saniyeye çıkarıldı; eşzamanlı/cooldown içindeki focus istekleri birleştirildi.
- Arka plan `/api/data?scope=shared` yanıtından kullanıcı ve chat payload'ı çıkarıldı.
- Arama tamamen istemcideki güncel katalog snapshot'ında çalışır; tuş başına API isteği kaldırıldı.
- Chat geçmişi değişiklikleri 1,2 saniye debounce edilir ve ilk hydrate tekrar yazılmaz.
- Dinleme süresi kalıcı yazımı 15 saniyeden 60 saniyeye toplulaştırıldı.
- Rate limit katmanları eklendi:
  - Genel API: 5 dakikada 600 istek
  - Mutation: dakikada 120 istek
  - Login/register: 15 dakikada 20 istek
  - Gemini chat: dakikada 12 istek
- R2 medya streaming endpoint'i rate limit dışında tutuldu; ses oynatma etkilenmez.
- Gemini chat endpoint'i için aktif oturum zorunlu hale getirildi; API anahtarı anonim çağrılarla tüketilemez.

## Kontroller

- `npm run lint` başarılı (`tsc --noEmit`).
- `npm run build` başarılı (Vite + server esbuild).
- `git diff --check` başarılı.
- Runtime smoke test: anonim chat `401`, 12/dakika chat sınırını aşan 13. istek `429` ve `Retry-After` döndürdü.
