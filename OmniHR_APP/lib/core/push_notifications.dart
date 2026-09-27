import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'i18n.dart';
import 'session.dart';

/// Notifications in the phone's notification shade, through Firebase Cloud
/// Messaging.
///
/// The backend sends a push for every notification it stores, already worded
/// in the language this device registered with. When the app is in the
/// background or closed, the phone shows it by itself; while the app is open
/// FCM hands it to [_showForeground] instead, which puts it in the shade too.
///
/// The Firebase project comes from android/app/google-services.json (and
/// ios/Runner/GoogleService-Info.plist). Without that file, and always on the
/// web, push stays off and the app works as before, with notifications only
/// in its own list.
class PushNotifications {
  PushNotifications._();

  static final instance = PushNotifications._();

  /// Must match `channelId` in OmniHR_BE `push.service.ts` and the default
  /// channel in AndroidManifest.xml.
  static const _channel = AndroidNotificationChannel(
    'omnihr_default',
    'OmniHR',
    description: 'Công việc, nghỉ phép và chấm công',
    importance: Importance.high,
  );

  final _local = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  bool _unavailable = false;
  bool _launchChecked = false;
  String? _token;
  AppSession? _session;

  /// Runs when a push arrives while the app is open, e.g. to refresh a badge.
  VoidCallback? onMessage;

  /// Runs when the user taps a notification to open the app.
  VoidCallback? onOpen;

  static bool get supported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  /// Asks for permission once and registers this phone for the signed-in user.
  /// Safe to call again; it re-sends the token (and the current language).
  Future<void> register(AppSession session) async {
    if (!supported || _unavailable) return;
    _session = session;
    try {
      if (!_ready) {
        try {
          await Firebase.initializeApp();
        } catch (_) {
          // No google-services.json in this build: push is simply off.
          _unavailable = true;
          return;
        }
        await _setUp();
      }
      final messaging = FirebaseMessaging.instance;
      final permission = await messaging.requestPermission();
      if (permission.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await messaging.getToken();
      if (token != null) await _sendToken(token);
      if (!_launchChecked) {
        _launchChecked = true;
        // Opened from the shade while the app was closed.
        if (await messaging.getInitialMessage() != null) onOpen?.call();
      }
    } catch (error) {
      // Push is a convenience: the notification list still works without it.
      debugPrint('Push registration failed: $error');
    }
  }

  /// Stops push to this phone for the current user; call before signing out,
  /// while the session can still reach the API.
  Future<void> unregister(AppSession session) async {
    final token = _token;
    _token = null;
    _session = null;
    if (token == null) return;
    try {
      await session.api.delete(
        '/notifications/devices',
        body: {'token': token},
      );
    } catch (_) {
      // The next sign-in on this phone moves the token to that user anyway.
    }
  }

  Future<void> _sendToken(String token) async {
    final session = _session;
    if (session == null || !session.isLoggedIn) return;
    await session.api.post(
      '/notifications/devices',
      body: {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS
            ? 'ios'
            : 'android',
        'language': session.language == AppLanguage.en ? 'en' : 'vi',
      },
    );
    _token = token;
  }

  Future<void> _setUp() async {
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        // FirebaseMessaging.requestPermission asks on iOS.
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (_) => onOpen?.call(),
    );
    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_channel);
    // iOS can show a push over the open app by itself.
    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
    FirebaseMessaging.onMessage.listen(_showForeground);
    FirebaseMessaging.onMessageOpenedApp.listen((_) => onOpen?.call());
    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      unawaited(_sendToken(token).catchError((_) {}));
    });
    _ready = true;
  }

  /// Android shows nothing for a push that arrives while the app is open, so
  /// it goes in the shade here, looking the same as one that arrived closed.
  void _showForeground(RemoteMessage message) {
    onMessage?.call();
    final notification = message.notification;
    if (notification == null ||
        defaultTargetPlatform != TargetPlatform.android) {
      return;
    }
    _local.show(
      // Android notification ids are 32-bit.
      id:
          (message.messageId ?? '${DateTime.now().microsecondsSinceEpoch}')
              .hashCode &
          0x7fffffff,
      title: notification.title,
      body: notification.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }
}
