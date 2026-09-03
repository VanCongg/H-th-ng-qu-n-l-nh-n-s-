import 'package:flutter/material.dart';

import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';

class TaskCard extends StatelessWidget {
  const TaskCard({super.key, required this.task, this.onDetails});

  final TaskItem task;
  final VoidCallback? onDetails;

  @override
  Widget build(BuildContext context) {
    final overdue = task.isOverdue;

    return AppPanel(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onDetails,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            AppIconBadge(
              icon: Icons.task_alt_rounded,
              color: priorityColor(task.priority),
              size: 42,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (task.dueDate != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      overdue
                          ? 'Quá hạn ${formatDate(task.dueDate)}'
                          : 'Hạn ${formatDate(task.dueDate)}',
                      style: TextStyle(
                        color: overdue ? dangerColor : mutedTextColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Pill(
              label: friendlyStatus(task.status),
              color: statusColor(task.status),
            ),
          ],
        ),
      ),
    );
  }
}
