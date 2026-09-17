import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';
import 'pressable_scale.dart';

class TaskCard extends StatelessWidget {
  const TaskCard({super.key, required this.task, this.onDetails});

  final TaskItem task;
  final VoidCallback? onDetails;

  static final _radius = BorderRadius.circular(8);

  @override
  Widget build(BuildContext context) {
    final overdue = task.isOverdue;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PressableScale(
        onTap: onDetails,
        borderRadius: _radius,
        child: AppPanel(
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
                        tx(overdue ? 'Quá hạn {date}' : 'Hạn {date}', {
                          'date': formatDate(task.dueDate),
                        }),
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
              StatusIcon.status(task.status),
            ],
          ),
        ),
      ),
    );
  }
}
