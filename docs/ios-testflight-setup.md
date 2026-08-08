# iOS app qua TestFlight — hướng dẫn setup

App iOS này **bọc giao diện web** (Capacitor + WKWebView), trỏ thẳng vào
domain production — server (`app/src/server.js`) không đổi gì, không bị
đóng gói vào app. Xem `capacitor.config.js` ở gốc repo để hiểu kiến trúc.

Việc đã làm sẵn trên máy này (Windows, không cần Mac):
- Cài `@capacitor/core`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/browser`.
- Tạo `capacitor.config.js` (domain còn là placeholder, xem bước 1).
- Chạy `npx cap add ios` → sinh thư mục `ios/` (Xcode project).
- Thêm quyền camera/micro vào `ios/App/App/Info.plist`.
- Viết sẵn workflow CI `.github/workflows/ios-testflight.yml` (chạy trên
  macOS runner của GitHub Actions — không cần máy Mac riêng).

Những việc còn lại, theo đúng thứ tự:

## 1. Domain production thật (bắt buộc trước mọi bước khác)

Sửa `capacitor.config.js` ở gốc repo, đổi:
```js
url: "https://REPLACE_WITH_YOUR_DOMAIN.example.com",
```
thành domain HTTPS thật đang chạy server này. **Domain phải có chứng chỉ
TLS hợp lệ** (Let's Encrypt hoặc CA thật qua reverse proxy như
Nginx/Caddy/Cloudflare) — iOS (App Transport Security) chặn thẳng cert
tự ký, không có cách bật lại cho bản thật.

Sau khi sửa, chạy lại:
```
npm run cap:sync
```

## 2. Apple Developer Program ($99/năm)

Đăng ký tại https://developer.apple.com/programs/ — cần vài ngày để
Apple duyệt hồ sơ (nhanh hơn nếu đăng ký dạng cá nhân, lâu hơn nếu đăng
ký dạng tổ chức vì cần D-U-N-S number). Sau khi được duyệt, ghi lại
**Team ID** (Membership → Team ID, dạng 10 ký tự) — cần điền vào
`.github/ios/ExportOptions.plist`.

## 3. Icon app (1024×1024, không alpha)

Chuẩn bị 1 ảnh vuông 1024×1024px, nền không trong suốt (không có kênh
alpha). Việc generate bộ icon đầy đủ cho iOS (`Assets.xcassets`) cần làm
trên Mac bằng `npx @capacitor/assets generate --ios` (chưa chạy được ở
đây vì cần Xcode xử lý asset catalog).

## 4. Đăng ký app trên App Store Connect

Tại https://appstoreconnect.apple.com → My Apps → + → New App:
- Bundle ID: đúng giá trị `appId` trong `capacitor.config.js`
  (`com.dorakaiwa.videocall`, đổi trước nếu muốn — **không đổi được dễ
  dàng sau khi đã tạo app**).
- Trước đó cần đăng ký Bundle ID này ở
  https://developer.apple.com/account/resources/identifiers/list
  (Certificates, Identifiers & Profiles → Identifiers → +).

## 5. Chuẩn bị secrets cho CI (làm 1 lần, cần Mac hoặc máy có Xcode)

Workflow `.github/workflows/ios-testflight.yml` cần các GitHub Secrets
sau (Settings → Secrets and variables → Actions trong repo GitHub):

| Secret | Lấy ở đâu |
|---|---|
| `IOS_DIST_CERTIFICATE_P12_BASE64` | Xcode → Settings → Accounts → Manage Certificates → tạo "Apple Distribution" cert → xuất ra `.p12` từ Keychain Access → `base64 -i cert.p12 \| pbcopy` |
| `IOS_DIST_CERTIFICATE_PASSWORD` | Mật khẩu bạn tự đặt lúc xuất file `.p12` ở trên |
| `IOS_PROVISION_PROFILE_BASE64` | Apple Developer → Profiles → tạo profile loại "App Store" cho đúng Bundle ID → tải `.mobileprovision` → `base64 -i profile.mobileprovision \| pbcopy` |
| `IOS_CI_KEYCHAIN_PASSWORD` | Mật khẩu bất kỳ bạn tự đặt, chỉ dùng tạm trong CI |
| `APPLE_TEAM_ID` | Team ID lấy ở bước 2 |
| `ASC_API_KEY_ID` / `ASC_API_ISSUER_ID` / `ASC_API_KEY_P8_BASE64` | App Store Connect → Users and Access → Integrations → App Store Connect API → tạo key mới, tải file `.p8` (chỉ tải được **1 lần duy nhất**, lưu ngay) → `base64 -i AuthKey_XXXX.p8 \| pbcopy` |

Cũng cần điền `REPLACE_WITH_APPLE_TEAM_ID` trong
`.github/ios/ExportOptions.plist` bằng Team ID thật (hoặc sửa workflow
để inject qua biến môi trường — hiện đang hardcode trong file cho đơn
giản).

## 6. Chạy CI build

Sau khi có đủ secrets ở bước 5: GitHub repo → tab Actions → "iOS - Build
& Upload to TestFlight" → Run workflow. Chờ build xong (~10-15 phút lần
đầu), build sẽ tự xuất hiện trong App Store Connect → TestFlight sau vài
phút xử lý.

## 7. Mời người test

App Store Connect → TestFlight → Internal Testing → tạo nhóm, thêm
người bằng đúng email họ dùng (xem phần đã bàn trong chat về cách quản
lý danh sách tester). Nhớ: build hết hạn sau 90 ngày, cần chạy lại
workflow ở bước 6 định kỳ.

## Việc chỉ làm được trên Mac (không làm được trên máy Windows này)

- Mở `ios/App/App.xcworkspace` bằng Xcode để xem/sửa native project
  trực tiếp, debug trên thiết bị thật qua cáp.
- `npx @capacitor/assets generate --ios` để sinh bộ icon.
- Test thực tế app trên simulator/thiết bị trước khi đẩy lên TestFlight
  (khuyến khích làm bước này trước bước 6, dù CI vẫn build/upload được
  mà không cần Mac).
