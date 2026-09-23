import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

enum _TaskFilter { all, open, overdue, done }

/// Splits one month's response into the tasks that are actually due in that
/// month and the undated ones that ride along because of `includeUndated`.
/// The month's counters must only describe the former; the latter belong to
/// no month and are listed separately.
({List<TaskItem> dated, List<TaskItem> undated}) splitTasksByDueDate(
  List<TaskItem> tasks,
) {
  final dated = <TaskItem>[];
  final undated = <TaskItem>[];
  for (final task in tasks) {
    if (dateOf(task.dueDate) == null) {
      undated.add(task);
    } else {
      dated.add(task);
    }
  }
  return (dated: dated, undated: undated);
}

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  late Future<List<TaskItem>> _future;
  late DateTime _visibleMonth;
  _TaskFilter _filter = _TaskFilter.all;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month);
    _future = _load();
  }

  /// One month of work at a time, filtered on the due date. A flat `limit: 50`
  /// silently hid the current work of anyone with a long history, because the
  /// server returns the oldest tasks first.
  Future<List<TaskItem>> _load() {
    final firstDay = DateTime(_visibleMonth.year, _visibleMonth.month);
    final lastDay = DateTime(_visibleMonth.year, _visibleMonth.month + 1, 0);
    return widget.session.api.getList(
      '/tasks/me',
      TaskItem.fromJson,
      query: {
        'limit': 100,
        'fromDate': apiDate(firstDay),
        'toDate': apiDate(lastDay),
        // A task with no due date belongs to no month, so without this it
        // would be missing from every single one of them.
        'includeUndated': true,
      },
    );
  }

  void _changeMonth(int delta) {
    setState(() {
      _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + delta);
      _future = _load();
    });
  }

  Future<void> _refresh() async {
    // Block body: an arrow would return the assigned Future to setState.
    setState(() {
      _future = _load();
    });
    try {
      await _future;
    } catch (_) {
      // The FutureBuilder already renders this failure.
    }
  }

  bool get _canUpdateStatus {
    return widget.session.user?.permissions.contains('TASK_UPDATE_STATUS') ??
        false;
  }

  bool _canUpdateTask(TaskItem task) {
    return _canUpdateStatus && task.parentTaskId != null;
  }

  List<TaskItem> _filteredTasks(List<TaskItem> tasks) {
    switch (_filter) {
      case _TaskFilter.open:
        return tasks.where((task) => task.isOpen).toList();
      case _TaskFilter.overdue:
        return tasks.where((task) => task.isOverdue).toList();
      case _TaskFilter.done:
        return tasks.where((task) => task.status == 'DONE').toList();
      case _TaskFilter.all:
        return tasks;
    }
  }

  Future<void> _updateStatus(TaskItem task, String status) async {
    if (!_canUpdateStatus) {
      showAppSnack(
        context,
        tx('Tài khoản chưa có quyền cập nhật trạng thái công việc.'),
        error: true,
      );
      return;
    }

    try {
      await widget.session.api.patch(
        '/tasks/${task.id}/status',
        body: {'status': status},
      );
      if (mounted) {
        showAppSnack(context, tx('Đã cập nhật trạng thái công việc.'));
      }
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      showAppSnack(
        context,
        error is ApiException ? error.message : error.toString(),
        error: true,
      );
    }
  }

  void _openDetails(TaskItem task) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
            child: AppPanel(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppIconBadge(
                          icon: Icons.task_alt_rounded,
                          color: statusColor(task.status),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                task.title,
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  Pill(
                                    label: friendlyStatus(task.status),
                                    color: statusColor(task.status),
                                  ),
                                  Pill(
                                    label: friendlyPriority(task.priority),
                                    color: priorityColor(task.priority),
                                  ),
                                  if (task.isOverdue)
                                    Pill(
                                      label: tx('Quá hạn'),
                                      color: dangerColor,
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    if (task.description != null &&
                        task.description!.trim().isNotEmpty) ...[
                      Text(
                        task.description!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: mutedTextColor,
                          fontWeight: FontWeight.w600,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_canUpdateTask(task)) ...[
                      _TaskStatusEditor(
                        currentStatus: task.status,
                        onChanged: (status) async {
                          Navigator.pop(context);
                          await _updateStatus(task, status);
                        },
                      ),
                      const SizedBox(height: 12),
                    ] else if (_canUpdateStatus &&
                        task.parentTaskId == null) ...[
                      // The server derives a team-level task's status from its
                      // subtasks, so say that instead of just hiding the field.
                      _DerivedStatusNote(),
                      const SizedBox(height: 12),
                    ],
                    ProfileRow(
                      icon: Icons.event_available_outlined,
                      label: tx('Ngày bắt đầu'),
                      value: formatDate(task.startDate),
                    ),
                    ProfileRow(
                      icon: Icons.event_busy_outlined,
                      label: tx('Hạn hoàn thành'),
                      value: formatDate(task.dueDate),
                    ),
                    ProfileRow(
                      icon: Icons.work_outline_rounded,
                      label: tx('Dự án'),
                      value: task.project?.name,
                    ),
                    ProfileRow(
                      icon: Icons.groups_outlined,
                      label: tx('Nhóm'),
                      value: task.team?.name ?? task.department?.name,
                    ),
                    ProfileRow(
                      icon: Icons.timer_outlined,
                      label: tx('Giờ dự kiến'),
                      value: task.estimatedHours == null
                          ? null
                          : '${task.estimatedHours!.toStringAsFixed(1)}h',
                    ),
                    if (task.requiredSkills.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SectionTitle(title: tx('Kỹ năng cần có')),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: task.requiredSkills
                            .map(
                              (item) => Pill(
                                label: item.skill.name,
                                color: brandColor,
                              ),
                            )
                            .toList(),
                      ),
                    ],
                    if (task.parentTask != null) ...[
                      const SizedBox(height: 8),
                      SectionTitle(title: tx('Công việc cha')),
                      AppPanel(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                task.parentTask!.title,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            Pill(
                              label: friendlyStatus(task.parentTask!.status),
                              color: statusColor(task.parentTask!.status),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (task.childTasks.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SectionTitle(
                        title: tx('Công việc con ({count})', {
                          'count': '${task.childTasks.length}',
                        }),
                      ),
                      ...task.childTasks.map(
                        (child) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: PressableScale(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () => _openDetails(child),
                            child: AppPanel(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          child.title,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium
                                              ?.copyWith(
                                                fontWeight: FontWeight.w700,
                                              ),
                                        ),
                                        if (child.assignee != null)
                                          Text(
                                            child.assignee!.fullName,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(
                                                  color: mutedTextColor,
                                                ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Pill(
                                    label: friendlyStatus(child.status),
                                    color: statusColor(child.status),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<TaskItem>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final split = splitTasksByDueDate(snapshot.data ?? const <TaskItem>[]);
        final tasks = split.dated;
        final undatedTasks = _filteredTasks(split.undated);
        final visibleTasks = _filteredTasks(tasks);
        final openCount = tasks.where((task) => task.isOpen).length;
        final overdueCount = tasks.where((task) => task.isOverdue).length;
        final doneCount = tasks.where((task) => task.status == 'DONE').length;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              MonthSwitcher(
                visibleMonth: _visibleMonth,
                onPreviousMonth: () => _changeMonth(-1),
                onNextMonth: () => _changeMonth(1),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Pill(label: '$openCount ${tx('đang mở')}', color: brandColor),
                  Pill(
                    label: '$overdueCount ${tx('quá hạn')}',
                    color: dangerColor,
                  ),
                  Pill(
                    label: '$doneCount ${tx('hoàn thành')}',
                    color: brandGreen,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SegmentedButton<_TaskFilter>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(
                    value: _TaskFilter.all,
                    label: Text(tx('Tất cả')),
                  ),
                  ButtonSegment(
                    value: _TaskFilter.open,
                    label: Text(tx('Đang mở')),
                  ),
                  ButtonSegment(
                    value: _TaskFilter.overdue,
                    label: Text(tx('Quá hạn')),
                  ),
                  ButtonSegment(
                    value: _TaskFilter.done,
                    label: Text(tx('Xong')),
                  ),
                ],
                selected: {_filter},
                onSelectionChanged: (value) {
                  setState(() => _filter = value.first);
                },
              ),
              const SizedBox(height: 20),
              SectionTitle(title: tx('Danh sách công việc')),
              if (tasks.isEmpty)
                EmptyState(
                  icon: Icons.assignment_outlined,
                  title: tx('Không có công việc trong tháng này'),
                  body: tx('Dùng mũi tên phía trên để xem tháng khác.'),
                )
              else if (visibleTasks.isEmpty)
                EmptyState(
                  icon: Icons.filter_alt_off_outlined,
                  title: tx('Không có công việc phù hợp'),
                  body: tx('Đổi bộ lọc để xem các công việc khác.'),
                )
              else
                ...visibleTasks.map(
                  (task) =>
                      TaskCard(task: task, onDetails: () => _openDetails(task)),
                ),
              if (undatedTasks.isNotEmpty) ...[
                const SizedBox(height: 20),
                SectionTitle(
                  title: tx('Không có hạn ({count})', {
                    'count': '${undatedTasks.length}',
                  }),
                  subtitle: tx('Không thuộc tháng nào nên luôn hiển thị ở đây'),
                ),
                ...undatedTasks.map(
                  (task) =>
                      TaskCard(task: task, onDetails: () => _openDetails(task)),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _DerivedStatusNote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: brandColor.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: brandColor),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tx(
                'Đây là công việc cấp nhóm. Trạng thái của nó được tính từ '
                'các công việc con, không đổi trực tiếp được.',
              ),
              style: TextStyle(color: brandColor),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskStatusEditor extends StatelessWidget {
  const _TaskStatusEditor({
    required this.currentStatus,
    required this.onChanged,
  });

  static const _statuses = [
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
    'CANCELLED',
  ];

  final String currentStatus;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: _statuses.contains(currentStatus) ? currentStatus : null,
      decoration: InputDecoration(
        labelText: tx('Đổi trạng thái'),
        prefixIcon: const Icon(Icons.update),
      ),
      items: _statuses
          .map(
            (status) => DropdownMenuItem(
              value: status,
              child: Text(friendlyStatus(status)),
            ),
          )
          .toList(),
      onChanged: (value) {
        if (value != null && value != currentStatus) onChanged(value);
      },
    );
  }
}
