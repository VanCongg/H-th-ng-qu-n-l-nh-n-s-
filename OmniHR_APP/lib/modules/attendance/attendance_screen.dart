import 'package:flutter/material.dart';

import '../../core/attendance_location.dart';
import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  late Future<List<AttendanceRecord>> _future;
  late DateTime _visibleMonth;
  DateTime? _selectedDay;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month);
    _selectedDay = DateTime(now.year, now.month, now.day);
    _future = _load();
  }

  Future<List<AttendanceRecord>> _load() {
    final firstDay = DateTime(_visibleMonth.year, _visibleMonth.month);
    final lastDay = DateTime(_visibleMonth.year, _visibleMonth.month + 1, 0);
    return widget.session.api.getList(
      '/attendance/self',
      AttendanceRecord.fromJson,
      query: {
        'limit': 100,
        'fromDate': apiDate(firstDay),
        'toDate': apiDate(lastDay),
      },
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  bool _hasPermission(String permission) {
    return widget.session.user?.permissions.contains(permission) ?? false;
  }

  List<AttendanceRecord> _todayRecords(List<AttendanceRecord> records) {
    final today = DateTime.now();
    final list = records.where((record) {
      final date = dateOf(record.workDate);
      return date != null && sameDate(date, today);
    }).toList();
    list.sort((a, b) {
      final first = dateOf(a.recordedAt) ?? DateTime(1970);
      final second = dateOf(b.recordedAt) ?? DateTime(1970);
      return second.compareTo(first);
    });
    return list;
  }

  AttendanceRecord? _latestRecordOfType(
    List<AttendanceRecord> records,
    String type,
  ) {
    for (final record in records) {
      if (record.recordType == type) return record;
    }
    return null;
  }

  List<AttendanceRecord> _recordsForDay(
    List<AttendanceRecord> records,
    DateTime day,
  ) {
    final list = records.where((record) {
      final date = dateOf(record.workDate);
      return date != null && sameDate(date, day);
    }).toList();
    list.sort((a, b) {
      final first = dateOf(a.recordedAt) ?? DateTime(1970);
      final second = dateOf(b.recordedAt) ?? DateTime(1970);
      return first.compareTo(second);
    });
    return list;
  }

  void _changeMonth(int delta) {
    final next = DateTime(_visibleMonth.year, _visibleMonth.month + delta);
    setState(() {
      _visibleMonth = next;
      _selectedDay = DateTime(next.year, next.month, 1);
      _future = _load();
    });
  }

  /// Returns true if it's fine to proceed with the check-in/out POST:
  /// either the user is within the configured radius, the policy couldn't
  /// be determined (server still validates authoritatively), or the user
  /// explicitly chose to continue anyway.
  Future<bool> _confirmWithinRadius(
    Map<String, Object?> locationPayload,
  ) async {
    final latitude = locationPayload['latitude'] as double?;
    final longitude = locationPayload['longitude'] as double?;
    if (latitude == null || longitude == null) return true;

    LocationPolicy policy;
    try {
      final data = await widget.session.api.get('/attendance/location-policy');
      policy = LocationPolicy.fromJson(mapOf(data));
    } catch (_) {
      return true;
    }

    if (!policy.requireAttendanceLocation ||
        policy.companyLatitude == null ||
        policy.companyLongitude == null) {
      return true;
    }

    final distance = distanceMetersBetween(
      latitude,
      longitude,
      policy.companyLatitude!,
      policy.companyLongitude!,
    );
    if (distance <= policy.attendanceRadiusMeters) return true;
    if (!mounted) return false;

    final proceed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          icon: AppIconBadge(
            icon: Icons.location_off_outlined,
            color: dangerColor,
            size: 54,
          ),
          title: Text(tx('Ngoài khu vực công ty')),
          content: Text(
            tx(
              'Bạn đang cách văn phòng {distance}m, vượt quá bán kính cho '
              'phép {radius}m. Vẫn tiếp tục?',
              {
                'distance': '${distance.round()}',
                'radius': '${policy.attendanceRadiusMeters.round()}',
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tx('Hủy')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: dangerColor),
              child: Text(tx('Vẫn tiếp tục')),
            ),
          ],
        );
      },
    );
    return proceed == true;
  }

  Future<void> _record(String action, List<AttendanceRecord> records) async {
    final isCheckIn = action == 'check-in';
    final permission = isCheckIn
        ? 'ATTENDANCE_CHECK_IN'
        : 'ATTENDANCE_CHECK_OUT';
    if (!_hasPermission(permission)) {
      showAppSnack(
        context,
        tx('Tài khoản chưa có quyền chấm công.'),
        error: true,
      );
      return;
    }

    final todayRecords = _todayRecords(records);
    final latestRecord = todayRecords.isEmpty ? null : todayRecords.first;
    if (!isCheckIn && latestRecord?.recordType != 'CHECK_IN') {
      showAppSnack(
        context,
        tx('Bạn chưa chấm công vào nên không thể chấm công ra.'),
        error: true,
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          icon: AppIconBadge(
            icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
            color: isCheckIn ? brandColor : accentColor,
            size: 54,
          ),
          title: Text(tx(isCheckIn ? 'Chấm công vào' : 'Chấm công ra')),
          content: Text(
            tx('Ứng dụng sẽ lấy vị trí hiện tại để gửi lên hệ thống.'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tx('Hủy')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(tx('Xác nhận')),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      final locationPayload = await currentAttendanceLocationPayload();
      if (!await _confirmWithinRadius(locationPayload)) {
        if (mounted) setState(() => _submitting = false);
        return;
      }

      await widget.session.api.post(
        '/attendance/$action',
        body: locationPayload,
      );
      if (mounted) {
        showAppSnack(
          context,
          tx(isCheckIn ? 'Đã chấm công vào.' : 'Đã chấm công ra.'),
        );
      }
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      showAppSnack(
        context,
        error is ApiException ? error.message : error.toString(),
        error: true,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AttendanceRecord>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final records = snapshot.data ?? [];
        final todayRecords = _todayRecords(records);
        final latestRecord = todayRecords.isEmpty ? null : todayRecords.first;
        final latestText = latestRecord == null
            ? tx('Hôm nay chưa có lượt chấm công.')
            : tx('{type} lúc {time}', {
                'type': friendlyRecordType(latestRecord.recordType),
                'time': formatDateTime(latestRecord.recordedAt),
              });
        final nextAction = latestRecord?.recordType == 'CHECK_IN'
            ? 'check-out'
            : 'check-in';
        final nextIsCheckIn = nextAction == 'check-in';
        final checkInRecord = _latestRecordOfType(todayRecords, 'CHECK_IN');
        final checkOutRecord = _latestRecordOfType(todayRecords, 'CHECK_OUT');
        final selectedRecords = _recordsForDay(
          records,
          _selectedDay ?? DateTime.now(),
        );

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              ActionPanel(
                icon: Icons.location_on_outlined,
                title: tx('Chấm công hôm nay'),
                subtitle: latestText,
                color: nextAction == 'check-in' ? brandColor : accentColor,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Pill(
                          label: '${todayRecords.length} ${tx('lượt hôm nay')}',
                          color: brandColor,
                        ),
                        if (latestRecord?.shift != null)
                          Pill(
                            label: friendlyAttendanceShift(
                              latestRecord!.shift!,
                            ),
                            color: accentColor,
                          ),
                        if (latestRecord?.attendanceStatus != null)
                          Pill(
                            label: friendlyAttendanceStatus(
                              latestRecord!.attendanceStatus!,
                            ),
                            color: statusColor(latestRecord.attendanceStatus!),
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: AttendanceActionOrb(
                        label: tx(
                          nextIsCheckIn ? 'Chấm công vào' : 'Chấm công ra',
                        ),
                        helperText: tx(
                          _submitting
                              ? 'Đang lấy GPS'
                              : nextIsCheckIn
                              ? 'Bắt đầu ca'
                              : 'Kết thúc ca',
                        ),
                        icon: nextIsCheckIn
                            ? Icons.login_rounded
                            : Icons.logout_rounded,
                        color: nextIsCheckIn ? brandColor : accentColor,
                        submitting: _submitting,
                        onPressed: () => _record(nextAction, records),
                      ),
                    ),
                    const SizedBox(height: 14),
                    AttendanceMomentStrip(
                      checkInRecord: checkInRecord,
                      checkOutRecord: checkOutRecord,
                    ),
                    if (_submitting) ...[
                      const SizedBox(height: 12),
                      const LinearProgressIndicator(minHeight: 3),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              AppPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MonthAttendanceCalendar(
                      visibleMonth: _visibleMonth,
                      records: records,
                      selectedDay: _selectedDay,
                      onPreviousMonth: () => _changeMonth(-1),
                      onNextMonth: () => _changeMonth(1),
                      onDaySelected: (day) =>
                          setState(() => _selectedDay = day),
                    ),
                    Divider(
                      height: 28,
                      color: brandColor.withValues(alpha: 0.08),
                    ),
                    DayAttendanceDetails(
                      day: _selectedDay ?? DateTime.now(),
                      records: selectedRecords,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class MonthAttendanceCalendar extends StatelessWidget {
  const MonthAttendanceCalendar({
    super.key,
    required this.visibleMonth,
    required this.records,
    required this.selectedDay,
    required this.onPreviousMonth,
    required this.onNextMonth,
    required this.onDaySelected,
  });

  final DateTime visibleMonth;
  final List<AttendanceRecord> records;
  final DateTime? selectedDay;
  final VoidCallback onPreviousMonth;
  final VoidCallback onNextMonth;
  final ValueChanged<DateTime> onDaySelected;

  @override
  Widget build(BuildContext context) {
    final monthTitle = tx('Tháng {month}/{year}', {
      'month': visibleMonth.month.toString().padLeft(2, '0'),
      'year': '${visibleMonth.year}',
    });
    final firstDay = DateTime(visibleMonth.year, visibleMonth.month);
    final daysInMonth = DateTime(
      visibleMonth.year,
      visibleMonth.month + 1,
      0,
    ).day;
    final leading = firstDay.weekday - 1;
    final totalCells = (((leading + daysInMonth) + 6) ~/ 7) * 7;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              tooltip: tx('Tháng trước'),
              onPressed: onPreviousMonth,
              icon: const Icon(Icons.chevron_left_rounded),
            ),
            Expanded(
              child: Text(
                monthTitle,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
            ),
            IconButton(
              tooltip: tx('Tháng sau'),
              onPressed: onNextMonth,
              icon: const Icon(Icons.chevron_right_rounded),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _WeekdayLabel(tx('T2')),
            _WeekdayLabel(tx('T3')),
            _WeekdayLabel(tx('T4')),
            _WeekdayLabel(tx('T5')),
            _WeekdayLabel(tx('T6')),
            _WeekdayLabel(tx('T7')),
            _WeekdayLabel(tx('CN')),
          ],
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 10,
            crossAxisSpacing: 6,
          ),
          itemCount: totalCells,
          itemBuilder: (context, index) {
            final dayNumber = index - leading + 1;
            if (dayNumber < 1 || dayNumber > daysInMonth) {
              return const SizedBox.shrink();
            }
            final day = DateTime(
              visibleMonth.year,
              visibleMonth.month,
              dayNumber,
            );
            return _AttendanceDayCell(
              day: day,
              hasAttendance: _hasAttendance(day),
              selected: selectedDay != null && sameDate(selectedDay!, day),
              onTap: () => onDaySelected(day),
            );
          },
        ),
      ],
    );
  }

  bool _hasAttendance(DateTime day) {
    return records.any((record) {
      final date = dateOf(record.workDate);
      return date != null && sameDate(date, day);
    });
  }
}

class _WeekdayLabel extends StatelessWidget {
  const _WeekdayLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: mutedTextColor,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _AttendanceDayCell extends StatelessWidget {
  const _AttendanceDayCell({
    required this.day,
    required this.hasAttendance,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final bool hasAttendance;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final dayOnly = DateTime(day.year, day.month, day.day);
    final future = dayOnly.isAfter(todayOnly);
    final color = hasAttendance
        ? brandGreen
        : future
        ? mutedTextColor
        : dangerColor;
    final backgroundOpacity = future && !hasAttendance ? 0.10 : 0.86;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: backgroundOpacity),
          border: Border.all(
            color: selected ? brandColor : surfaceColor,
            width: selected ? 2.4 : 1.2,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.24),
                    blurRadius: 12,
                    offset: const Offset(0, 5),
                  ),
                ]
              : null,
        ),
        child: Text(
          '${day.day}',
          style: TextStyle(
            color: future && !hasAttendance ? mutedTextColor : Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}

class DayAttendanceDetails extends StatelessWidget {
  const DayAttendanceDetails({
    super.key,
    required this.day,
    required this.records,
  });

  final DateTime day;
  final List<AttendanceRecord> records;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: formatDate(day),
          subtitle: records.isEmpty
              ? tx('Chưa có lượt chấm công trong ngày này')
              : tx('{count} lượt chấm công', {'count': '${records.length}'}),
        ),
        if (records.isEmpty)
          Text(
            tx('Ngày này chưa ghi nhận chấm công.'),
            style: TextStyle(
              color: mutedTextColor,
              fontWeight: FontWeight.w600,
            ),
          )
        else
          ...records.map((record) => _DayAttendanceRow(record: record)),
      ],
    );
  }
}

class _DayAttendanceRow extends StatelessWidget {
  const _DayAttendanceRow({required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final isCheckIn = record.recordType == 'CHECK_IN';
    final color = isCheckIn ? brandColor : accentColor;
    final shift = record.shift == null
        ? null
        : friendlyAttendanceShift(record.shift!);
    final status = record.attendanceStatus == null
        ? null
        : friendlyAttendanceStatus(record.attendanceStatus!);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          AppIconBadge(
            icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
            color: color,
            size: 40,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  friendlyRecordType(record.recordType),
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    formatDateTime(record.recordedAt),
                    ?shift,
                    ?status,
                  ].join(' - '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
