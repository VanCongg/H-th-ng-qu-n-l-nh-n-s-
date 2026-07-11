import 'package:flutter/material.dart';

import '../../core/utils.dart';
import '../../models/omni_models.dart';

class BrandBackdrop extends StatelessWidget {
  const BrandBackdrop({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: appBackgroundColor,
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            brandColor.withValues(alpha: 0.08),
            brandGreen.withValues(alpha: 0.035),
            appBackgroundColor,
          ],
          stops: const [0, 0.34, 0.78],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: Container(
              height: 4,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [brandColor, brandGreen, accentColor],
                ),
              ),
            ),
          ),
          Positioned(
            left: -80,
            top: 96,
            child: Container(
              width: 210,
              height: 210,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: brandColor.withValues(alpha: 0.045),
              ),
            ),
          ),
          Positioned(
            right: -110,
            bottom: -60,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: brandGreen.withValues(alpha: 0.045),
              ),
            ),
          ),
          SafeArea(
            child: Padding(padding: padding, child: child),
          ),
        ],
      ),
    );
  }
}

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 48, this.showShadow = true});

  final double size;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'OmniHR',
      image: true,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(painter: _LogoMarkPainter(showShadow: showShadow)),
        ),
      ),
    );
  }
}

class _LogoMarkPainter extends CustomPainter {
  const _LogoMarkPainter({required this.showShadow});

  final bool showShadow;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 72;
    canvas
      ..save()
      ..translate((size.width - 72 * scale) / 2, (size.height - 72 * scale) / 2)
      ..scale(scale);

    final badgePath = Path()
      ..moveTo(36, 4.5)
      ..lineTo(58.5, 17.7)
      ..lineTo(58.5, 54.3)
      ..lineTo(36, 67.5)
      ..lineTo(13.5, 54.3)
      ..lineTo(13.5, 17.7)
      ..close();

    if (showShadow) {
      canvas.drawShadow(
        badgePath,
        const Color(0xFF127195).withValues(alpha: 0.32),
        10,
        false,
      );
    }

    final badgePaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [brandGreen, brandColor, brandNavy],
        stops: [0, 0.42, 1],
      ).createShader(const Rect.fromLTWH(4, 4, 64, 64));
    canvas.drawPath(badgePath, badgePaint);

    final edgePath = Path()
      ..moveTo(36, 7.8)
      ..lineTo(55.6, 19.3)
      ..lineTo(55.6, 52.7)
      ..lineTo(36, 64.2)
      ..lineTo(16.4, 52.7)
      ..lineTo(16.4, 19.3)
      ..close();
    final edgePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFFFF3BF), Color(0xFF74C0FC), Color(0xFF63E6BE)],
        stops: [0, 0.46, 1],
      ).createShader(const Rect.fromLTWH(12, 8, 48, 58));
    canvas.drawPath(edgePath, edgePaint);

    final shinePath = Path()
      ..moveTo(19.2, 20.8)
      ..lineTo(36, 10.9)
      ..lineTo(52.8, 20.8)
      ..lineTo(52.8, 30.5)
      ..cubicTo(41.6, 26.8, 30.4, 26.8, 19.2, 30.5)
      ..close();
    final shinePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withValues(alpha: 0.62),
          Colors.white.withValues(alpha: 0),
        ],
      ).createShader(const Rect.fromLTWH(18, 10, 36, 46));
    canvas.drawPath(shinePath, shinePaint);

    final whiteStroke = Paint()
      ..color = Colors.white.withValues(alpha: 0.92)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.4;
    canvas.drawCircle(const Offset(35.9, 36), 17.7, whiteStroke);

    final hPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas
      ..drawLine(const Offset(27.8, 26.6), const Offset(27.8, 45.4), hPaint)
      ..drawLine(const Offset(44.2, 26.6), const Offset(44.2, 45.4), hPaint)
      ..drawLine(const Offset(27.8, 36), const Offset(44.2, 36), hPaint);

    final arrowPaint = Paint()
      ..color = const Color(0xFFFFE066)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final arrowPath = Path()
      ..moveTo(48.9, 17.8)
      ..lineTo(55.1, 21.4)
      ..lineTo(51.5, 27.6);
    canvas.drawPath(arrowPath, arrowPaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LogoMarkPainter oldDelegate) {
    return oldDelegate.showShadow != showShadow;
  }
}

class AppIconBadge extends StatelessWidget {
  const AppIconBadge({
    super.key,
    required this.icon,
    required this.color,
    this.size = 44,
  });

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.10)),
      ),
      child: Icon(icon, color: color, size: size * 0.48),
    );
  }
}

class AppPanel extends StatelessWidget {
  const AppPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: brandColor.withValues(alpha: 0.11)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF101828).withValues(alpha: 0.045),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class PageHeroCard extends StatelessWidget {
  const PageHeroCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.color = brandColor,
    this.child,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            color,
            Color.lerp(color, brandGreen, 0.28) ?? color,
            brandNavy,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.22),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -32,
            top: -42,
            child: Container(
              width: 132,
              height: 132,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.10),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIconBadge(icon: icon, color: Colors.white, size: 48),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  height: 1.05,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.86),
                  fontWeight: FontWeight.w700,
                  height: 1.35,
                ),
              ),
              if (child != null) ...[const SizedBox(height: 18), child!],
            ],
          ),
        ],
      ),
    );
  }
}

class ActionPanel extends StatelessWidget {
  const ActionPanel({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIconBadge(icon: icon, color: color),
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
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
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
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class EmployeeHeader extends StatelessWidget {
  const EmployeeHeader({super.key, required this.employee, required this.user});

  final Employee? employee;
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? 'OmniHR user';
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return AppPanel(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      brandColor.withValues(alpha: 0.08),
                      Colors.white,
                      brandGreen.withValues(alpha: 0.06),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [brandColor, brandGreen],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: brandColor.withValues(alpha: 0.22),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Text(
                      name.isEmpty ? 'O' : name.substring(0, 1).toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle.isEmpty
                              ? textOf(user?.email, 'Employee')
                              : subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: mutedTextColor,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        if (user != null && user!.roles.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: user!.roles
                                .map(
                                  (role) => Pill(
                                    label: role,
                                    color: _roleColor(role),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Color _roleColor(String role) {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return brandPurple;
    case 'MANAGER':
      return const Color(0xFF0B7285);
    case 'EMPLOYEE':
      return const Color(0xFF2B8A3E);
    default:
      return brandColor;
  }
}

class TaskCard extends StatelessWidget {
  const TaskCard({
    super.key,
    required this.task,
    required this.onStatusChanged,
    this.compact = false,
    this.updating = false,
  });

  static const statuses = [
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
    'CANCELLED',
  ];

  final TaskItem task;
  final bool compact;
  final bool updating;
  final ValueChanged<String>? onStatusChanged;

  @override
  Widget build(BuildContext context) {
    final dueDate = dateOf(task.dueDate);
    final overdue =
        task.isOpen && dueDate != null && dueDate.isBefore(DateTime.now());
    final currentStatus = statuses.contains(task.status) ? task.status : null;

    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIconBadge(
                icon: Icons.task_alt_rounded,
                color: statusColor(task.status),
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  task.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Pill(label: task.priority, color: priorityColor(task.priority)),
            ],
          ),
          if (task.description != null && task.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              task.description!,
              maxLines: compact ? 2 : 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFF64748B)),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: friendlyStatus(task.status),
                color: statusColor(task.status),
              ),
              if (task.project != null)
                Pill(label: task.project!.name, color: const Color(0xFF2563EB)),
              if (task.estimatedHours != null)
                Pill(
                  label: '${task.estimatedHours!.toStringAsFixed(1)}h',
                  color: const Color(0xFF64748B),
                ),
              if (task.dueDate != null)
                Pill(
                  label: 'Due ${formatDate(task.dueDate)}',
                  color: overdue ? dangerColor : const Color(0xFF64748B),
                ),
            ],
          ),
          if (!compact && task.requiredSkills.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: task.requiredSkills
                  .map(
                    (item) => Chip(
                      label: Text(item.skill.name),
                      visualDensity: VisualDensity.compact,
                    ),
                  )
                  .toList(),
            ),
          ],
          if (!compact && onStatusChanged != null) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: currentStatus,
              decoration: InputDecoration(
                labelText: 'Status',
                prefixIcon: updating
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : const Icon(Icons.update),
              ),
              items: statuses
                  .map(
                    (status) => DropdownMenuItem(
                      value: status,
                      child: Text(friendlyStatus(status)),
                    ),
                  )
                  .toList(),
              onChanged: updating
                  ? null
                  : (value) {
                      if (value != null && value != task.status) {
                        onStatusChanged!(value);
                      }
                    },
            ),
          ],
        ],
      ),
    );
  }
}

class AttendanceCard extends StatelessWidget {
  const AttendanceCard({super.key, required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final isCheckIn = record.recordType == 'CHECK_IN';
    final title = [
      isCheckIn ? 'Check in' : 'Check out',
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

String friendlyAttendanceShift(String value) {
  switch (value) {
    case 'MORNING':
      return 'Morning';
    case 'AFTERNOON':
      return 'Afternoon';
    default:
      return value;
  }
}

String friendlyAttendanceStatus(String value) {
  switch (value) {
    case 'ON_TIME':
      return 'On time';
    case 'LATE':
      return 'Late';
    case 'EARLY_OUT':
      return 'Early out';
    case 'MANUAL_ADJUSTMENT':
      return 'Manual adjustment';
    default:
      return value;
  }
}

class LeaveRequestCard extends StatelessWidget {
  const LeaveRequestCard({
    super.key,
    required this.request,
    required this.onCancel,
  });

  final LeaveRequest request;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(request.status);

    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIconBadge(
                icon: Icons.beach_access_rounded,
                color: color,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  request.leaveType.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Pill(label: friendlyStatus(request.status), color: color),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label:
                    '${formatDate(request.startDate)} - ${formatDate(request.endDate)}',
                color: brandColor,
              ),
              Pill(
                label: '${request.totalDays.toStringAsFixed(1)} days',
                color: accentColor,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            request.reason,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: mutedTextColor,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (request.rejectionReason != null &&
              request.rejectionReason!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Rejected: ${request.rejectionReason}',
              style: const TextStyle(color: dangerColor),
            ),
          ],
          if (onCancel != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onCancel,
                icon: const Icon(Icons.cancel_outlined),
                label: const Text('Cancel request'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class EmployeeSkillCard extends StatelessWidget {
  const EmployeeSkillCard({super.key, required this.skill});

  final EmployeeSkill skill;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          const AppIconBadge(
            icon: Icons.psychology_alt_rounded,
            color: brandPurple,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  skill.skill.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (skill.proficiency != null)
                      Pill(label: skill.proficiency!, color: brandPurple),
                    if (skill.yearsExperience != null)
                      Pill(
                        label:
                            '${skill.yearsExperience!.toStringAsFixed(1)} years',
                        color: brandColor,
                      ),
                    if (skill.lastUsedAt != null)
                      Pill(
                        label: 'Last ${formatDate(skill.lastUsedAt)}',
                        color: mutedTextColor,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Colors.white, color.withValues(alpha: 0.055)],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              child: Container(
                height: 4,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [brandColor, brandGreen, accentColor, brandPurple],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  AppIconBadge(icon: icon, color: color, size: 38),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: mutedTextColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class ProfileRow extends StatelessWidget {
  const ProfileRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF64748B)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value == null || value!.isEmpty ? '-' : value!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
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
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: mutedTextColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        children: [
          AppIconBadge(icon: icon, color: mutedTextColor, size: 52),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: mutedTextColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: AppPanel(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 18),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            SizedBox(width: 12),
            Text(
              'Loading workspace',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, required this.onRetry});

  final String error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: AppPanel(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AppIconBadge(
                icon: Icons.error_outline_rounded,
                color: dangerColor,
                size: 54,
              ),
              const SizedBox(height: 12),
              Text(
                error,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF475569),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
