import 'dart:async';

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
  bool _justRecorded = false;
  Set<int> _workWeekdays = LocationPolicy.defaultWorkWeekdays;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month);
    _selectedDay = DateTime(now.year, now.month, now.day);
    _future = _load();
    _loadWorkWeek();
  }

  /// The company work week decides which days without a check-in count as
  /// missed; Mon–Fri stays as the fallback if the policy cannot be loaded.
  Future<void> _loadWorkWeek() async {
    try {
      final data = await widget.session.api.get('/attendance/location-policy');
      final policy = LocationPolicy.fromJson(mapOf(data));
      if (mounted) setState(() => _workWeekdays = policy.workWeekdays);
    } catch (_) {
      // Keep the default work week.
    }
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
    final future = _load();
    // Block body: an arrow would return the assigned Future to setState.
    setState(() {
      _future = future;
    });
    await future;
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

    // The server rejects this anyway, so there is nothing to offer beyond the
    // reason: say why it is invalid rather than dangling a button that fails.
    await showAppAlert(
      context,
      icon: Icons.location_off_outlined,
      title: tx('Chấm công không hợp lệ'),
      message: tx(
        'Bạn đang cách văn phòng {distance}m, vượt quá bán kính cho phép '
        '{radius}m. Hãy tới khu vực công ty rồi chấm công lại.',
        {
          'distance': formatMeters(distance),
          'radius': formatMeters(policy.attendanceRadiusMeters),
        },
      ),
    );
    return false;
  }

  /// Shows a tick on the action orb for a moment after a successful punch.
  void _flashRecorded() {
    setState(() => _justRecorded = true);
    Future<void>.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() => _justRecorded = false);
    });
  }

  Future<void> _record(String action, List<AttendanceRecord> records) async {
    if (_submitting) return;
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
    if (isCheckIn && latestRecord?.recordType == 'CHECK_IN') {
      showAppSnack(
        context,
        tx(
          'Chấm công trùng: bạn đã chấm công vào lúc {time} và chưa chấm công '
          'ra.',
          {'time': formatTime(latestRecord!.recordedAt)},
        ),
        error: true,
      );
      return;
    }
    if (!isCheckIn && latestRecord?.recordType == 'CHECK_OUT') {
      showAppSnack(
        context,
        tx('Chấm công trùng: bạn đã chấm công ra lúc {time}.', {
          'time': formatTime(latestRecord!.recordedAt),
        }),
        error: true,
      );
      return;
    }
    if (!isCheckIn && latestRecord?.recordType != 'CHECK_IN') {
      showAppSnack(
        context,
        tx('Bạn chưa chấm công vào nên không thể chấm công ra.'),
        error: true,
      );
      return;
    }

    final confirmed = await showAppConfirm(
      context,
      icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
      color: isCheckIn ? brandColor : accentColor,
      title: tx(isCheckIn ? 'Chấm công vào' : 'Chấm công ra'),
      message: tx('Ứng dụng sẽ lấy vị trí hiện tại để gửi lên hệ thống.'),
      confirmLabel: tx('Xác nhận'),
    );
    if (!confirmed || !mounted) return;

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
      if (mounted) _flashRecorded();
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      if (error is ApiException &&
          error.errorCode == 'ATTENDANCE_OUTSIDE_RADIUS') {
        // The client-side check passed but the server disagreed, so it has a
        // company point this screen's cached policy did not. Its message is
        // English; say it in the app's language instead.
        await showAppAlert(
          context,
          icon: Icons.location_off_outlined,
          title: tx('Chấm công không hợp lệ'),
          message: tx(
            'Bạn đang ở ngoài khu vực công ty nên không thể chấm công. '
            'Hãy tới nơi làm việc rồi thử lại.',
          ),
        );
      } else {
        showAppSnack(
          context,
          error is ApiException ? error.message : error.toString(),
          error: true,
        );
      }
      // The server rejected a stale action (e.g. a duplicate punch): reload
      // so the screen shows the real next action.
      if (error is ApiException &&
          error.errorCode == 'ATTENDANCE_INVALID_ACTION') {
        unawaited(_refresh());
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AttendanceRecord>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
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
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        IconPill(
                          icon: Icons.fingerprint_rounded,
                          value: '${todayRecords.length}',
                          color: brandColor,
                          tooltip: tx('lượt hôm nay'),
                        ),
                        if (latestRecord?.shift != null)
                          IconPill(
                            icon: attendanceShiftIcon(latestRecord!.shift!),
                            color: accentColor,
                            tooltip: friendlyAttendanceShift(
                              latestRecord.shift!,
                            ),
                          ),
                        if (latestRecord?.attendanceStatus != null)
                          StatusIcon(
                            icon: statusIcon(latestRecord!.attendanceStatus!),
                            color: statusColor(latestRecord.attendanceStatus!),
                            label: friendlyAttendanceStatus(
                              latestRecord.attendanceStatus!,
                            ),
                            size: 28,
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: AttendanceActionOrb(
                        label: tx(nextIsCheckIn ? 'Vào ca' : 'Ra ca'),
                        celebrate: _justRecorded,
                        icon: nextIsCheckIn
                            ? Icons.login_rounded
                            : Icons.logout_rounded,
                        // Fixed deep tones: the dark palette's pale blue and
                        // orange are for text on navy, not for white labels.
                        color: nextIsCheckIn
                            ? const Color(0xFF1C7ED6)
                            : const Color(0xFFE8590C),
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
                      workWeekdays: _workWeekdays,
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
    this.workWeekdays = LocationPolicy.defaultWorkWeekdays,
  });

  final DateTime visibleMonth;
  final List<AttendanceRecord> records;
  final DateTime? selectedDay;
  final VoidCallback onPreviousMonth;
  final VoidCallback onNextMonth;
  final ValueChanged<DateTime> onDaySelected;

  /// [DateTime.weekday] values the company works on.
  final Set<int> workWeekdays;

  @override
  Widget build(BuildContext context) {
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
        MonthSwitcher(
          visibleMonth: visibleMonth,
          onPreviousMonth: onPreviousMonth,
          onNextMonth: onNextMonth,
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
              workDay: workWeekdays.contains(day.weekday),
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
    required this.workDay,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final bool hasAttendance;
  final bool workDay;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final dayOnly = DateTime(day.year, day.month, day.day);
    final future = dayOnly.isAfter(todayOnly);
    // Days outside the company work week are days off, not absences.
    final absent = !hasAttendance && !future && workDay;
    final isToday = dayOnly == todayOnly;
    // Light tints with coloured numbers, like the web badges; solid green and
    // red discs for every day of the month were loud.
    final color = hasAttendance
        ? brandGreen
        : absent
        ? dangerColor
        : mutedTextColor;
    final backgroundOpacity = hasAttendance || absent ? 0.16 : 0.0;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: backgroundOpacity),
          border: Border.all(
            color: selected
                ? brandColor
                : isToday
                ? brandColor.withValues(alpha: 0.45)
                : Colors.transparent,
            width: selected ? 2.2 : 1.2,
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
            color: hasAttendance || absent ? color : mutedTextColor,
            fontWeight: hasAttendance || absent || isToday
                ? FontWeight.w800
                : FontWeight.w600,
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
    final shift = record.shift;
    final status = record.attendanceStatus;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Tooltip(
            message: friendlyRecordType(record.recordType),
            child: AppIconBadge(
              icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
              color: color,
              size: 40,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              formatTime(record.recordedAt),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
          if (shift != null) ...[
            IconPill(
              icon: attendanceShiftIcon(shift),
              color: accentColor,
              tooltip: friendlyAttendanceShift(shift),
            ),
            const SizedBox(width: 6),
          ],
          if (status != null)
            StatusIcon(
              icon: statusIcon(status),
              color: statusColor(status),
              label: friendlyAttendanceStatus(status),
            ),
        ],
      ),
    );
  }
}
