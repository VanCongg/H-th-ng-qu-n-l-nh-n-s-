# OmniHR Mobile App

Flutter mobile app cho nhân viên OmniHR: đăng nhập, xem dashboard, chấm công, nghỉ phép, task cá nhân và hồ sơ kỹ năng.

## Yêu cầu

- Flutter SDK đã cài và có trong `PATH`
- Backend OmniHR chạy ở port `3000`
- Android Studio hoặc Android SDK để chạy emulator/build APK

## Cài dependency

```powershell
cd D:\OmniHR\OmniHR_APP
flutter pub get
```

## Chạy backend

```powershell
cd D:\OmniHR\OmniHR_BE
npm run start:dev
```

## Cấu hình API URL

API URL được gắn lúc build qua `--dart-define=API_BASE_URL=...`, người dùng không nhập và không nhìn thấy trong app.
Nếu không truyền, app dùng mặc định cho môi trường dev:

- Chrome/web/desktop: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`

Máy Android thật cùng Wi-Fi (ví dụ máy tính có IP `192.168.1.10`):

```powershell
flutter run -d <device_id> --dart-define=API_BASE_URL=http://192.168.1.10:3000
```

Build production:

```powershell
flutter build apk --release --dart-define=API_BASE_URL=https://api.your-company.com
```

## Lần đầu mở app

`modules/onboarding` hiển thị splash giới thiệu → hướng dẫn sử dụng → xin quyền vị trí (dùng cho chấm công GPS).
Trạng thái đã xem được lưu ở SharedPreferences (`onboardingCompleted`); xóa dữ liệu app để xem lại.

## Chạy trên Chrome

```powershell
cd D:\OmniHR\OmniHR_APP
flutter run -d chrome
```

## Chạy Android emulator

Liệt kê emulator:

```powershell
flutter emulators
```

Mở emulator:

```powershell
flutter emulators --launch <emulator_id>
```

Liệt kê device đang có:

```powershell
flutter devices
```

Chạy app trên Android:

```powershell
cd D:\OmniHR\OmniHR_APP
flutter run -d <device_id>
```

Nếu chỉ có một emulator đang mở:

```powershell
flutter run
```

## Build APK

Debug APK:

```powershell
cd D:\OmniHR\OmniHR_APP
flutter build apk --debug
```

Release APK:

```powershell
flutter build apk --release
```

APK output thường nằm ở:

```txt
build\app\outputs\flutter-apk\app-debug.apk
build\app\outputs\flutter-apk\app-release.apk
```

## Kiểm tra code

```powershell
cd D:\OmniHR\OmniHR_APP
dart format lib test
flutter analyze
flutter test
```

## Cấu trúc chính

```txt
lib/
  main.dart
  app.dart
  core/
    api_service.dart
    session.dart
    utils.dart
  models/
    omni_models.dart
  modules/
    auth/
      login_screen.dart
    shell/
      home_shell.dart
    dashboard/
      dashboard_screen.dart
    attendance/
      attendance_screen.dart
    leave/
      leave_screen.dart
    tasks/
      tasks_screen.dart
    profile/
      profile_screen.dart
  shared/
    widgets/
      widgets.dart   # barrel export
      task_card.dart, attendance_widgets.dart, ...
```

## Bottom Navigation Modules

```txt
Home       -> modules/dashboard
Time       -> modules/attendance
Leave      -> modules/leave
Tasks      -> modules/tasks
Me         -> modules/profile
```
