import 'package:flutter/material.dart';

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
    final title = [
      friendlyRecordType(record.recordType),
      if (record.shift != null) friendlyAttendanceShift(record.shift!),
    ].join(' - ');
    final subtitle = [
      formatDateTime(record.recordedAt),
      if (record.attendanceStatus != null)
        friendlyAttendanceStatus(record.attendanceStatus!),
      if (record.distanceMeters != null) '${record.distanceMeters} m',
      record.source,
    ].join(' - ');

    final color = isCheckIn ? brandColor : accentColor;

    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          AppIconBadge(
            icon: isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
            color: color,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Pill(label: formatDate(record.workDate), color: color),
        ],
      ),
    );
  }
}

class AttendanceActionOrb extends StatefulWidget {
  const AttendanceActionOrb({
    super.key,
    required this.label,
    required this.helperText,
    required this.icon,
    required this.color,
    required this.submitting,
    required this.onPressed,
    this.size = 168,
  });

  final String label;
  final String helperText;
  final IconData icon;
  final Color color;
  final bool submitting;
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
    final dark = Color.lerp(widget.color, brandNavy, 0.48) ?? widget.color;
    final light = Color.lerp(widget.color, Colors.white, 0.32) ?? widget.color;

    return Semantics(
      button: true,
      label: widget.label,
      child: AnimatedBuilder(
        animation: _pulseController,
        builder: (context, child) {
          final pulse = widget.submitting ? 0.0 : _pulseController.value;
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
                        color: widget.color,
                      ),
                    ),
                  ),
                ),
                Transform.scale(
                  scale: 0.9 + (pulse * 0.11),
                  child: Opacity(
                    opacity: (1 - pulse) * 0.16,
                    child: Container(
                      width: widget.size + 22,
                      height: widget.size + 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: widget.color.withValues(alpha: 0.7),
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                ),
                child!,
              ],
            ),
          );
        },
        child: SizedBox.square(
          dimension: widget.size,
          child: Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: widget.submitting ? null : widget.onPressed,
              child: Ink(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    center: const Alignment(-0.35, -0.38),
                    radius: 0.98,
                    colors: [light, widget.color, dark],
                    stops: const [0, 0.56, 1],
                  ),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.74),
                    width: 2.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: widget.color.withValues(alpha: 0.30),
                      blurRadius: 30,
                      offset: const Offset(0, 16),
                    ),
                  ],
                ),
                child: Center(
                  child: widget.submitting
                      ? const SizedBox.square(
                          dimension: 34,
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
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    height: 1.1,
                                  ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              widget.helperText,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.84),
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

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
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: appBackgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: brandColor.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _AttendanceMomentTile(
              icon: Icons.login_rounded,
              label: 'Vào',
              record: checkInRecord,
              color: brandColor,
            ),
          ),
          Container(
            width: 1,
            height: 46,
            color: brandColor.withValues(alpha: 0.10),
          ),
          Expanded(
            child: _AttendanceMomentTile(
              icon: Icons.logout_rounded,
              label: 'Ra',
              record: checkOutRecord,
              color: accentColor,
            ),
          ),
        ],
      ),
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
    final time = record == null
        ? 'Chưa có'
        : formatDateTime(record!.recordedAt);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: record == null ? 0.08 : 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              color: record == null ? mutedTextColor : color,
              size: 19,
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  time,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: record == null ? mutedTextColor : inkColor,
                    fontWeight: FontWeight.w900,
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

String friendlyAttendanceShift(String value) {
  switch (value.toUpperCase()) {
    case 'MORNING':
      return 'Ca sáng';
    case 'AFTERNOON':
      return 'Ca chiều';
    default:
      return value;
  }
}

String friendlyAttendanceStatus(String value) {
  switch (value.toUpperCase()) {
    case 'ON_TIME':
      return 'Đúng giờ';
    case 'LATE':
      return 'Đi muộn';
    case 'EARLY_OUT':
      return 'Về sớm';
    case 'MANUAL_ADJUSTMENT':
      return 'Điều chỉnh';
    default:
      return value;
  }
}
