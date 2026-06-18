import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  late Future<List<TaskItem>> _future;
  String _filter = 'OPEN';
  int? _updatingTaskId;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<TaskItem>> _load() {
    return widget.session.api.getList(
      '/tasks/me',
      TaskItem.fromJson,
      query: {'limit': 100},
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _updateStatus(TaskItem task, String status) async {
    setState(() => _updatingTaskId = task.id);
    try {
      await widget.session.api.patch(
        '/tasks/${task.id}/status',
        body: {'status': status},
      );
      if (mounted) showAppSnack(context, 'Task status updated');
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    } finally {
      if (mounted) setState(() => _updatingTaskId = null);
    }
  }

  List<TaskItem> _applyFilter(List<TaskItem> tasks) {
    switch (_filter) {
      case 'DONE':
        return tasks.where((task) => task.status == 'DONE').toList();
      case 'LATE':
        return tasks.where((task) {
          final dueDate = dateOf(task.dueDate);
          return task.isOpen &&
              dueDate != null &&
              dueDate.isBefore(DateTime.now());
        }).toList();
      case 'ALL':
        return tasks;
      default:
        return tasks.where((task) => task.isOpen).toList();
    }
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

        final tasks = snapshot.data ?? [];
        final visibleTasks = _applyFilter(tasks);

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SegmentedButton<String>(
                  selected: {_filter},
                  onSelectionChanged: (value) {
                    setState(() => _filter = value.first);
                  },
                  segments: const [
                    ButtonSegment(
                      value: 'OPEN',
                      label: Text('Open'),
                      icon: Icon(Icons.radio_button_unchecked),
                    ),
                    ButtonSegment(
                      value: 'LATE',
                      label: Text('Late'),
                      icon: Icon(Icons.warning_amber),
                    ),
                    ButtonSegment(
                      value: 'DONE',
                      label: Text('Done'),
                      icon: Icon(Icons.check_circle_outline),
                    ),
                    ButtonSegment(
                      value: 'ALL',
                      label: Text('All'),
                      icon: Icon(Icons.list),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (visibleTasks.isEmpty)
                const EmptyState(
                  icon: Icons.task_alt_outlined,
                  title: 'No tasks',
                  body: 'Tasks assigned to you will appear here.',
                )
              else
                ...visibleTasks.map(
                  (task) => TaskCard(
                    task: task,
                    updating: _updatingTaskId == task.id,
                    onStatusChanged: (status) => _updateStatus(task, status),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
