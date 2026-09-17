import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';

import 'i18n.dart';

class AttendanceLocationException implements Exception {
  const AttendanceLocationException(this.message);

  final String message;

  @override
  String toString() => message;
}

Future<Map<String, Object?>> currentAttendanceLocationPayload() async {
  try {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw AttendanceLocationException(
        tx('Không lấy được vị trí hiện tại. Vui lòng bật GPS và thử lại.'),
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw AttendanceLocationException(
        tx(
          'Ứng dụng chưa được cấp quyền vị trí. Vui lòng cấp quyền và thử lại.',
        ),
      );
    }

    if (permission == LocationPermission.deniedForever) {
      throw AttendanceLocationException(
        tx(
          'Quyền vị trí đang bị chặn. Vui lòng mở cài đặt thiết bị để cấp quyền.',
        ),
      );
    }

    final position = await _currentOrLastKnownPosition();
    if (position == null) {
      throw AttendanceLocationException(
        tx('Không lấy được vị trí hiện tại. Vui lòng bật GPS và thử lại.'),
      );
    }

    return _payloadFromPosition(position);
  } on AttendanceLocationException {
    rethrow;
  } catch (_) {
    throw AttendanceLocationException(
      tx(
        'Không lấy được vị trí hiện tại. Vui lòng bật GPS, cấp quyền vị trí '
        'và thử lại.',
      ),
    );
  }
}

/// Asks for location access up front (first-run onboarding). Never throws:
/// check-in re-requests and explains the problem if access is still missing.
Future<bool> requestLocationPermission() async {
  try {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  } catch (_) {
    return false;
  }
}

Future<Position?> _currentOrLastKnownPosition() async {
  try {
    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 8),
      ),
    );
  } on TimeoutException {
    return Geolocator.getLastKnownPosition();
  } catch (_) {
    final lastKnown = await Geolocator.getLastKnownPosition();
    return lastKnown;
  }
}

Map<String, Object?> _payloadFromPosition(Position position) {
  return {'latitude': position.latitude, 'longitude': position.longitude};
}

/// Mirrors the backend's Haversine formula in AttendanceService.distanceMeters
/// so the client-side pre-check agrees with server-side validation.
double distanceMetersBetween(
  double latitudeA,
  double longitudeA,
  double latitudeB,
  double longitudeB,
) {
  const earthRadiusMeters = 6371000;
  final deltaLatitude = _toRadians(latitudeB - latitudeA);
  final deltaLongitude = _toRadians(longitudeB - longitudeA);
  final a =
      math.sin(deltaLatitude / 2) * math.sin(deltaLatitude / 2) +
      math.cos(_toRadians(latitudeA)) *
          math.cos(_toRadians(latitudeB)) *
          math.sin(deltaLongitude / 2) *
          math.sin(deltaLongitude / 2);
  return earthRadiusMeters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

double _toRadians(double value) => value * math.pi / 180;
