import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

const brandColor = Color(0xFF0F766E);
const accentColor = Color(0xFFF59E0B);
const dangerColor = Color(0xFFDC2626);

final dateFormat = DateFormat('dd/MM/yyyy');
final dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm');
final apiDateFormat = DateFormat('yyyy-MM-dd');

String defaultApiBaseUrl() {
  if (kIsWeb) return 'http://localhost:3000';
  if (defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
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

String apiDate(DateTime value) => apiDateFormat.format(value);

bool sameDate(DateTime a, DateTime b) {
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

Color statusColor(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'DONE':
    case 'ACTIVE':
      return const Color(0xFF16A34A);
    case 'PENDING':
    case 'TODO':
    case 'IN_PROGRESS':
    case 'IN_REVIEW':
      return accentColor;
    case 'REJECTED':
    case 'CANCELLED':
    case 'TERMINATED':
      return dangerColor;
    default:
      return const Color(0xFF64748B);
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
  switch (status) {
    case 'TODO':
      return 'To do';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'IN_REVIEW':
      return 'In review';
    case 'DONE':
      return 'Done';
    case 'CANCELLED':
      return 'Cancelled';
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
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
