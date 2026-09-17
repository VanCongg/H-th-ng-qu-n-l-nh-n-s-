import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';

class AttendanceCard extends StatelessWidget {
  const AttendanceCard({super.key, required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final isCheckIn = record.recordType == 'CHECK_IN';
    final color = isCheckIn ? brandColor : accentColor;
    final shift = record.shift;
    final status = record.attendanceStatus;
    final distance = record.distanceMeters;

    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Tooltip(
            message: friendlyRecordType(record.recordType),
            child: AppIconBadge(
              icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
              color: color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatTime(record.recordedAt),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  formatDate(record.workDate),
                  style: TextStyle(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (distance != null) ...[
            IconPill(
              icon: Icons.near_me_rounded,
              value: '$distance m',
              color: brandColor,
              tooltip: tx('Khoảng cách'),
            ),
            const SizedBox(width: 6),
          ],
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

/// The big check-in/out button. Its colour animates between actions and it
/// flashes a tick right after a successful punch, so the result is visible
/// without reading a message.
class AttendanceActionOrb extends StatefulWidget {
  const AttendanceActionOrb({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.submitting,
    required this.onPressed,
    this.celebrate = false,
    this.size = 168,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool submitting;

  /// Shows the success tick instead of the next action.
  final bool celebrate;
  final VoidCallback onPressed;
  final double size;

  @override
  State<AttendanceActionOrb> createState() => _AttendanceActionOrbState();
}

class _AttendanceActionOrbState extends State<AttendanceActionOrb>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final targetColor = widget.celebrate ? brandGreen : widget.color;

    return Semantics(
      button: true,
      label: widget.celebrate ? tx('Đã ghi nhận') : widget.label,
      child: TweenAnimationBuilder<Color?>(
        tween: ColorTween(end: targetColor),
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        builder: (context, animatedColor, _) {
          final color = animatedColor ?? targetColor;
          return AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              final pulse = widget.submitting || widget.celebrate
                  ? 0.0
                  : _pulseController.value;
              return SizedBox.square(
                dimension: widget.size + 30,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Transform.scale(
                      scale: 0.98 + (pulse * 0.18),
                      child: Opacity(
                        opacity: (1 - pulse) * 0.22,
                        child: Container(
                          width: widget.size,
                          height: widget.size,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: color,
                          ),
                        ),
                      ),
                    ),
                    child!,
                  ],
                ),
              );
            },
            child: _buildButton(color),
          );
        },
      ),
    );
  }

  Widget _buildButton(Color color) {
    final dark = Color.lerp(color, brandNavy, 0.48) ?? color;
    final light = Color.lerp(color, Colors.white, 0.32) ?? color;

    // The shadow sits outside the clipped Material so it stays round; the
    // ink layer is clipped to the circle so no square highlight shows.
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.30),
            blurRadius: 30,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: SizedBox.square(
        dimension: widget.size,
        child: Material(
          type: MaterialType.transparency,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: widget.submitting || widget.celebrate
                ? null
                : widget.onPressed,
            child: Ink(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(-0.35, -0.38),
                  radius: 0.98,
                  colors: [light, color, dark],
                  stops: const [0, 0.56, 1],
                ),
              ),
              child: Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 280),
                  transitionBuilder: (child, animation) => ScaleTransition(
                    scale: animation,
                    child: FadeTransition(opacity: animation, child: child),
                  ),
                  child: _buildContent(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (widget.submitting) {
      return const SizedBox.square(
        key: ValueKey('submitting'),
        dimension: 38,
        child: CircularProgressIndicator(
          strokeWidth: 3,
          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
        ),
      );
    }
    if (widget.celebrate) {
      return const Icon(
        Icons.check_rounded,
        key: ValueKey('recorded'),
        color: Colors.white,
        size: 80,
      );
    }
    return Column(
      key: ValueKey(widget.icon),
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(widget.icon, color: Colors.white, size: 52),
        const SizedBox(height: 8),
        Text(
          widget.label,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

/// Today's check-in and check-out slots. A slot fills with its colour and a
/// tick once recorded, so the day's progress reads at a glance.
class AttendanceMomentStrip extends StatelessWidget {
  const AttendanceMomentStrip({
    super.key,
    required this.checkInRecord,
    required this.checkOutRecord,
  });

  final AttendanceRecord? checkInRecord;
  final AttendanceRecord? checkOutRecord;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _AttendanceMomentTile(
            icon: Icons.login_rounded,
            label: tx('Chấm công vào'),
            record: checkInRecord,
            color: brandColor,
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 320),
          width: 36,
          height: 3,
          decoration: BoxDecoration(
            color: checkInRecord != null
                ? brandGreen.withValues(alpha: 0.55)
                : mutedTextColor.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Expanded(
          child: _AttendanceMomentTile(
            icon: Icons.logout_rounded,
            label: tx('Chấm công ra'),
            record: checkOutRecord,
            color: accentColor,
          ),
        ),
      ],
    );
  }
}

class _AttendanceMomentTile extends StatelessWidget {
  const _AttendanceMomentTile({
    required this.icon,
    required this.label,
    required this.record,
    required this.color,
  });

  final IconData icon;
  final String label;
  final AttendanceRecord? record;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final current = record;
    final done = current != null;
    final time = done ? formatTime(current.recordedAt) : null;

    return Tooltip(
      message: label,
      child: Semantics(
        label: time == null ? label : '$label $time',
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 320),
              curve: Curves.easeOutCubic,
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? brandGreen : color.withValues(alpha: 0.10),
              ),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 260),
                transitionBuilder: (child, animation) =>
                    ScaleTransition(scale: animation, child: child),
                child: Icon(
                  done ? Icons.check_rounded : icon,
                  key: ValueKey(done),
                  color: done ? Colors.white : color.withValues(alpha: 0.75),
                  size: 26,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              time ?? '--:--',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: done ? inkColor : mutedTextColor,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String friendlyAttendanceShift(String value) {
  switch (value.toUpperCase()) {
    case 'MORNING':
      return tx('Ca sáng');
    case 'AFTERNOON':
      return tx('Ca chiều');
    default:
      return value;
  }
}

IconData attendanceShiftIcon(String value) {
  switch (value.toUpperCase()) {
    case 'MORNING':
      return Icons.wb_sunny_rounded;
    case 'AFTERNOON':
      return Icons.wb_twilight_rounded;
    default:
      return Icons.schedule_rounded;
  }
}

String friendlyAttendanceStatus(String value) {
  switch (value.toUpperCase()) {
    case 'ON_TIME':
      return tx('Đúng giờ');
    case 'LATE':
      return tx('Đi muộn');
    case 'EARLY_OUT':
      return tx('Về sớm');
    case 'MANUAL_ADJUSTMENT':
      return tx('Điều chỉnh');
    default:
      return value;
  }
}
