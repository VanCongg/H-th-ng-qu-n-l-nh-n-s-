import 'package:flutter/material.dart';

import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';

class TaskCard extends StatelessWidget {
  const TaskCard({
    super.key,
    required this.task,
    required this.onStatusChanged,
    this.onDetails,
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
  final VoidCallback? onDetails;

  @override
  Widget build(BuildContext context) {
    final overdue = task.isOverdue;
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
              Pill(
                label: friendlyPriority(task.priority),
                color: priorityColor(task.priority),
              ),
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
              if (task.team != null)
                Pill(label: task.team!.name, color: const Color(0xFF0B7285)),
              if (task.estimatedHours != null)
                Pill(
                  label: '${task.estimatedHours!.toStringAsFixed(1)}h',
                  color: const Color(0xFF64748B),
                ),
              if (task.dueDate != null)
                Pill(
                  label: 'Hạn ${formatDate(task.dueDate)}',
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
                labelText: 'Trạng thái',
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
          if (onDetails != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onDetails,
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('Chi tiết'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
