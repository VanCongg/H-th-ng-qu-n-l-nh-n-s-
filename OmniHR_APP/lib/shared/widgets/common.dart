import 'package:flutter/material.dart';

import '../../core/utils.dart';
import '../../models/omni_models.dart';

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: brandColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        Icons.workspaces_filled,
        color: Colors.white,
        size: size * 0.55,
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: brandColor.withValues(alpha: 0.12),
              foregroundColor: brandColor,
              child: Text(
                name.isEmpty ? 'O' : name.substring(0, 1).toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w800),
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
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle.isEmpty ? textOf(user?.email, 'Employee') : subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF64748B),
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

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                value: currentStatus,
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

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor:
              (isCheckIn ? brandColor : accentColor).withValues(alpha: 0.12),
          foregroundColor: isCheckIn ? brandColor : accentColor,
          child: Icon(isCheckIn ? Icons.login : Icons.logout),
        ),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: Text(formatDate(record.workDate)),
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
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    request.leaveType.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                Pill(
                  label: friendlyStatus(request.status),
                  color: statusColor(request.status),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${formatDate(request.startDate)} - ${formatDate(request.endDate)}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              request.reason,
              style: const TextStyle(color: Color(0xFF64748B)),
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
      ),
    );
  }
}

class EmployeeSkillCard extends StatelessWidget {
  const EmployeeSkillCard({super.key, required this.skill});

  final EmployeeSkill skill;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: brandColor.withValues(alpha: 0.12),
          foregroundColor: brandColor,
          child: const Icon(Icons.psychology_alt),
        ),
        title: Text(skill.skill.name),
        subtitle: Text(
          [
            if (skill.proficiency != null) skill.proficiency,
            if (skill.yearsExperience != null)
              '${skill.yearsExperience!.toStringAsFixed(1)} years',
            if (skill.lastUsedAt != null)
              'Last used ${formatDate(skill.lastUsedAt)}',
          ].join(' - '),
        ),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(icon, color: color),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Color(0xFF64748B)),
                ),
              ],
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
  const SectionTitle({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(icon, size: 36, color: const Color(0xFF94A3B8)),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 42, color: dangerColor),
            const SizedBox(height: 12),
            Text(
              error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF475569)),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
