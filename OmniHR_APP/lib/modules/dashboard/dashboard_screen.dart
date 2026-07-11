import 'package:flutter/material.dart';

import '../../core/attendance_location.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class HomeAttendanceData {
  HomeAttendanceData({required this.employee, required this.attendance});

  final Employee? employee;
  final List<AttendanceRecord> attendance;
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<HomeAttendanceData> _future;
  bool _submittingAttendance = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<HomeAttendanceData> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }

    final canReadAttendance =
        widget.session.user?.permissions.contains('ATTENDANCE_READ_SELF') ??
        false;
    final attendance = canReadAttendance
        ? await widget.session.api.getList(
            '/attendance/self',
            AttendanceRecord.fromJson,
            query: {'limit': 10},
          )
        : <AttendanceRecord>[];

    return HomeAttendanceData(employee: employee, attendance: attendance);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  void _showSnack(String message, {bool error = false}) {
    if (!mounted) return;
    showAppSnack(context, message, error: error);
  }

  Future<void> _confirmAndRecord(String action) async {
    final isCheckIn = action == 'check-in';
    final permission = isCheckIn
        ? 'ATTENDANCE_CHECK_IN'
        : 'ATTENDANCE_CHECK_OUT';
    if (!(widget.session.user?.permissions.contains(permission) ?? false)) {
      showAppSnack(context, 'Tài khoản chưa có quyền chấm công.', error: true);
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
          title: Text(isCheckIn ? 'Xác nhận check in' : 'Xác nhận check out'),
          content: Text(
            isCheckIn
                ? 'Ứng dụng sẽ lấy vị trí hiện tại để ghi nhận check in hôm nay.'
                : 'Ứng dụng sẽ lấy vị trí hiện tại để ghi nhận check out hôm nay.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Xác nhận'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) return;

    setState(() => _submittingAttendance = true);
    try {
      final locationPayload = await currentAttendanceLocationPayload();
      await widget.session.api.post(
        '/attendance/$action',
        body: locationPayload,
      );
      if (!mounted) return;
      _showSnack(isCheckIn ? 'Đã check in.' : 'Đã check out.');
      await _refresh();
    } catch (error) {
      _showSnack(error.toString(), error: true);
    } finally {
      if (mounted) setState(() => _submittingAttendance = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<HomeAttendanceData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final data = snapshot.data!;
        final today = DateTime.now();
        final todayRecords =
            data.attendance.where((record) {
              final date = dateOf(record.workDate);
              return date != null && sameDate(date, today);
            }).toList()..sort((a, b) {
              final first = dateOf(a.recordedAt) ?? DateTime(1970);
              final second = dateOf(b.recordedAt) ?? DateTime(1970);
              return second.compareTo(first);
            });
        final latestRecord = todayRecords.isEmpty ? null : todayRecords.first;
        final nextAction = latestRecord?.recordType == 'CHECK_IN'
            ? 'check-out'
            : 'check-in';
        final name =
            data.employee?.fullName ??
            widget.session.user?.username ??
            'OmniHR user';

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 112),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    children: [
                      _GreetingPanel(name: name, today: today),
                      const SizedBox(height: 18),
                      _AttendancePanel(
                        action: nextAction,
                        latestRecord: latestRecord,
                        todayCount: todayRecords.length,
                        submitting: _submittingAttendance,
                        onPressed: () => _confirmAndRecord(nextAction),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _GreetingPanel extends StatelessWidget {
  const _GreetingPanel({required this.name, required this.today});

  final String name;
  final DateTime today;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Row(
        children: [
          const LogoMark(size: 46, showShadow: false),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Xin chào, $name',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  formatDate(today),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w700,
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

class _AttendancePanel extends StatelessWidget {
  const _AttendancePanel({
    required this.action,
    required this.latestRecord,
    required this.todayCount,
    required this.submitting,
    required this.onPressed,
  });

  final String action;
  final AttendanceRecord? latestRecord;
  final int todayCount;
  final bool submitting;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isCheckIn = action == 'check-in';
    final color = isCheckIn ? brandColor : accentColor;
    final label = isCheckIn ? 'Check in' : 'Check out';
    final latestText = latestRecord == null
        ? 'Hôm nay chưa có lượt chấm công.'
        : 'Gần nhất: ${latestRecord!.recordType == 'CHECK_IN' ? 'Check in' : 'Check out'} lúc ${formatDateTime(latestRecord!.recordedAt)}';

    return AppPanel(
      padding: const EdgeInsets.fromLTRB(18, 24, 18, 20),
      child: Column(
        children: [
          Text(
            latestText,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: mutedTextColor,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 24),
          _OrbAttendanceButton(
            label: label,
            icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
            color: color,
            submitting: submitting,
            onPressed: onPressed,
          ),
          const SizedBox(height: 18),
          Pill(label: '$todayCount lượt hôm nay', color: color),
        ],
      ),
    );
  }
}

class _OrbAttendanceButton extends StatefulWidget {
  const _OrbAttendanceButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.submitting,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool submitting;
  final VoidCallback onPressed;

  @override
  State<_OrbAttendanceButton> createState() => _OrbAttendanceButtonState();
}

class _OrbAttendanceButtonState extends State<_OrbAttendanceButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final dark = Color.lerp(widget.color, brandNavy, 0.46) ?? widget.color;
    final light = Color.lerp(widget.color, Colors.white, 0.46) ?? widget.color;

    return GestureDetector(
      onTapDown: widget.submitting
          ? null
          : (_) => setState(() => _pressed = true),
      onTapCancel: widget.submitting
          ? null
          : () => setState(() => _pressed = false),
      onTapUp: widget.submitting
          ? null
          : (_) {
              setState(() => _pressed = false);
              widget.onPressed();
            },
      child: AnimatedScale(
        duration: const Duration(milliseconds: 120),
        scale: _pressed ? 0.97 : 1,
        child: Container(
          width: 184,
          height: 184,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              center: const Alignment(-0.34, -0.42),
              radius: 0.92,
              colors: [
                Colors.white.withValues(alpha: 0.98),
                light,
                widget.color,
                dark,
              ],
              stops: const [0, 0.18, 0.58, 1],
            ),
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: 0.34),
                blurRadius: 34,
                spreadRadius: 2,
                offset: const Offset(0, 18),
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.82),
                blurRadius: 18,
                offset: const Offset(-10, -10),
              ),
            ],
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.62),
              width: 2,
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                left: 36,
                top: 28,
                child: Container(
                  width: 54,
                  height: 27,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: Colors.white.withValues(alpha: 0.44),
                  ),
                ),
              ),
              Center(
                child: widget.submitting
                    ? const SizedBox.square(
                        dimension: 32,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      )
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(widget.icon, color: Colors.white, size: 42),
                          const SizedBox(height: 10),
                          Text(
                            widget.label,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  shadows: const [
                                    Shadow(
                                      color: Color(0x6606182C),
                                      blurRadius: 8,
                                      offset: Offset(0, 2),
                                    ),
                                  ],
                                ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
