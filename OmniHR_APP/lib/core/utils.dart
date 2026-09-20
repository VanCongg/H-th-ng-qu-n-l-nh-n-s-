import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'app_config.dart';
import 'i18n.dart';

/// Fixed brand-mark color, used only for illustrations (logo, mascot) that
/// should not change between light and dark theme.
const brandNavy = Color(0xFF243B6B);

class _Palette {
  const _Palette({
    required this.brand,
    required this.brandGreen,
    required this.accent,
    required this.danger,
    required this.background,
    required this.surface,
    required this.ink,
    required this.muted,
    required this.border,
  });

  final Color brand;
  final Color brandGreen;
  final Color accent;
  final Color danger;
  final Color background;
  final Color surface;
  final Color ink;
  final Color muted;
  final Color border;
}

// Both palettes mirror the web admin (OmniHR_WEB theme + global.css) so the
// two apps read as one product: same blue, same neutrals, same navy dark mode.
const _lightPalette = _Palette(
  brand: Color(0xFF228BE6),
  brandGreen: Color(0xFF12B886),
  accent: Color(0xFFF59F00),
  danger: Color(0xFFE03131),
  background: Color(0xFFF5F7FB),
  surface: Colors.white,
  ink: Color(0xFF182230),
  muted: Color(0xFF667085),
  border: Color(0xFFE5E7EB),
);

const _darkPalette = _Palette(
  brand: Color(0xFF74C0FC),
  brandGreen: Color(0xFF38D9A9),
  accent: Color(0xFFFFC078),
  danger: Color(0xFFFF8787),
  background: Color(0xFF101828),
  surface: Color(0xFF172033),
  ink: Color(0xFFE4E9F2),
  muted: Color(0xFF98A6BD),
  border: Color(0xFF253950),
);

/// Two color sets only: [applyAppBrightness] swaps every one of these
/// between the light and dark palette. Widgets read them directly (not via
/// `const`) so they repaint when the app's theme mode changes.
Color brandColor = _lightPalette.brand;
Color brandGreen = _lightPalette.brandGreen;
Color accentColor = _lightPalette.accent;
Color dangerColor = _lightPalette.danger;
Color appBackgroundColor = _lightPalette.background;
Color surfaceColor = _lightPalette.surface;
Color inkColor = _lightPalette.ink;
Color mutedTextColor = _lightPalette.muted;
Color borderColor = _lightPalette.border;

void applyAppBrightness(Brightness brightness) {
  final palette = brightness == Brightness.dark ? _darkPalette : _lightPalette;
  brandColor = palette.brand;
  brandGreen = palette.brandGreen;
  accentColor = palette.accent;
  dangerColor = palette.danger;
  appBackgroundColor = palette.background;
  surfaceColor = palette.surface;
  inkColor = palette.ink;
  mutedTextColor = palette.muted;
  borderColor = palette.border;
}

final dateFormat = DateFormat('dd/MM/yyyy');
final dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm');
final apiDateFormat = DateFormat('yyyy-MM-dd');
final timeFormat = DateFormat('HH:mm');

String defaultApiBaseUrl() {
  return AppConfig.defaultApiBaseUrl();
}

String cleanBaseUrl(String value) {
  return value.trim().replaceAll(RegExp(r'/+$'), '');
}

String textOf(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  final text = value.toString();
  return text.isEmpty ? fallback : text;
}

int intOf(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double? doubleOf(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

Map<String, dynamic> mapOf(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return <String, dynamic>{};
}

List<String> stringListOf(dynamic value) {
  if (value is List) return value.map((item) => item.toString()).toList();
  return <String>[];
}

DateTime? dateOf(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString())?.toLocal();
}

String formatDate(dynamic value) {
  final date = dateOf(value);
  return date == null ? '-' : dateFormat.format(date);
}

String formatDateTime(dynamic value) {
  final date = dateOf(value);
  return date == null ? '-' : dateTimeFormat.format(date);
}

String formatTime(dynamic value) {
  final date = dateOf(value);
  return date == null ? '--:--' : timeFormat.format(date);
}

String apiDate(DateTime value) => apiDateFormat.format(value);

bool sameDate(DateTime a, DateTime b) {
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

/// Mirrors the backend's default `workWeek` (MONDAY..FRIDAY) used by
/// `calculateLeaveDays`. Employees cannot read system settings, so the form
/// assumes the default work week for its client-side hints; the server stays
/// authoritative.
bool isWorkingDay(DateTime value) {
  return value.weekday >= DateTime.monday && value.weekday <= DateTime.friday;
}

/// First working day on or after [value].
DateTime nextWorkingDay(DateTime value) {
  var day = DateTime(value.year, value.month, value.day);
  while (!isWorkingDay(day)) {
    day = day.add(const Duration(days: 1));
  }
  return day;
}

/// Number of working days in the inclusive range, matching the backend's
/// `calculateLeaveDays`.
int workingDaysBetween(DateTime start, DateTime end) {
  var current = DateTime(start.year, start.month, start.day);
  final last = DateTime(end.year, end.month, end.day);
  var total = 0;
  while (!current.isAfter(last)) {
    if (isWorkingDay(current)) total += 1;
    current = current.add(const Duration(days: 1));
  }
  return total;
}

Color statusColor(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'DONE':
    case 'ACTIVE':
    case 'ON_TIME':
      return const Color(0xFF16A34A);
    case 'PENDING':
    case 'TODO':
    case 'IN_PROGRESS':
    case 'IN_REVIEW':
    case 'LATE':
    case 'EARLY_OUT':
      return accentColor;
    case 'REJECTED':
    case 'CANCELLED':
    case 'TERMINATED':
      return dangerColor;
    case 'MANUAL_ADJUSTMENT':
      return brandColor;
    default:
      return const Color(0xFF64748B);
  }
}

/// Colour and icon for a `NotificationType` coming from the backend, kept
/// beside [statusColor] so every list in the app tints the same event the
/// same way.
Color notificationColor(String type) {
  switch (type.toUpperCase()) {
    case 'LEAVE_APPROVED':
      return const Color(0xFF16A34A);
    case 'LEAVE_REJECTED':
      return dangerColor;
    case 'TASK_ASSIGNED':
    case 'TASK_STATUS_CHANGED':
      return brandColor;
    case 'ATTENDANCE_ADJUSTED':
      return accentColor;
    default:
      return const Color(0xFF64748B);
  }
}

IconData notificationIcon(String type) {
  switch (type.toUpperCase()) {
    case 'LEAVE_APPROVED':
      return Icons.event_available_rounded;
    case 'LEAVE_REJECTED':
      return Icons.event_busy_rounded;
    case 'TASK_ASSIGNED':
      return Icons.assignment_ind_rounded;
    case 'TASK_STATUS_CHANGED':
      return Icons.autorenew_rounded;
    case 'ATTENDANCE_ADJUSTED':
      return Icons.access_time_rounded;
    default:
      return Icons.notifications_rounded;
  }
}

/// Icon counterpart of [statusColor] and [friendlyStatus], so a status can be
/// shown as a coloured icon while the words stay in tooltips and semantics.
IconData statusIcon(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'DONE':
    case 'ON_TIME':
      return Icons.check_circle_rounded;
    case 'PENDING':
      return Icons.hourglass_top_rounded;
    case 'TODO':
      return Icons.radio_button_unchecked_rounded;
    case 'IN_PROGRESS':
      return Icons.autorenew_rounded;
    case 'IN_REVIEW':
      return Icons.rate_review_rounded;
    case 'LATE':
      return Icons.schedule_rounded;
    case 'EARLY_OUT':
      return Icons.directions_walk_rounded;
    case 'REJECTED':
      return Icons.cancel_rounded;
    case 'CANCELLED':
      return Icons.block_rounded;
    case 'MANUAL_ADJUSTMENT':
      return Icons.edit_calendar_rounded;
    case 'ACTIVE':
      return Icons.verified_user_rounded;
    case 'TERMINATED':
      return Icons.person_off_rounded;
    default:
      return Icons.help_outline_rounded;
  }
}

Color priorityColor(String priority) {
  switch (priority.toUpperCase()) {
    case 'URGENT':
      return dangerColor;
    case 'HIGH':
      return const Color(0xFFEA580C);
    case 'LOW':
      return const Color(0xFF2563EB);
    default:
      return brandColor;
  }
}

String friendlyStatus(String status) {
  switch (status.toUpperCase()) {
    case 'TODO':
      return tx('Chưa làm');
    case 'IN_PROGRESS':
      return tx('Đang làm');
    case 'IN_REVIEW':
      return tx('Chờ review');
    case 'DONE':
      return tx('Hoàn thành');
    case 'CANCELLED':
      return tx('Đã hủy');
    case 'PENDING':
      return tx('Chờ duyệt');
    case 'APPROVED':
      return tx('Đã duyệt');
    case 'REJECTED':
      return tx('Từ chối');
    case 'ACTIVE':
      return tx('Đang làm việc');
    case 'TERMINATED':
      return tx('Đã nghỉ việc');
    default:
      return status;
  }
}

String friendlyPriority(String priority) {
  switch (priority.toUpperCase()) {
    case 'LOW':
      return tx('Thấp');
    case 'MEDIUM':
      return tx('Trung bình');
    case 'HIGH':
      return tx('Cao');
    case 'URGENT':
      return tx('Khẩn cấp');
    default:
      return priority;
  }
}

String friendlyRecordType(String value) {
  switch (value.toUpperCase()) {
    case 'CHECK_IN':
      return tx('Chấm công vào');
    case 'CHECK_OUT':
      return tx('Chấm công ra');
    default:
      return value;
  }
}

void showAppSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: error ? dangerColor : brandColor,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
