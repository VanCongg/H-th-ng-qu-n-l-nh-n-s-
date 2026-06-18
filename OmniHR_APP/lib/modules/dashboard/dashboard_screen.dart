import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class DashboardData {
  DashboardData({
    required this.employee,
    required this.tasks,
    required this.attendance,
    required this.leaves,
  });

  final Employee? employee;
  final List<TaskItem> tasks;
  final List<AttendanceRecord> attendance;
  final List<LeaveRequest> leaves;
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<DashboardData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<DashboardData> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }

    final tasks = await widget.session.api.getList(
      '/tasks/me',
      TaskItem.fromJson,
      query: {'limit': 50},
    );
    final attendance = await widget.session.api.getList(
      '/attendance/self',
      AttendanceRecord.fromJson,
      query: {'limit': 10},
    );
    final leaves = await widget.session.api.getList(
      '/leave-requests/self',
      LeaveRequest.fromJson,
      query: {'limit': 20},
    );

    return DashboardData(
      employee: employee,
      tasks: tasks,
      attendance: attendance,
      leaves: leaves,
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DashboardData>(
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
        final todayRecords = data.attendance.where((record) {
          final date = dateOf(record.workDate);
          return date != null && sameDate(date, today);
        }).length;
        final openTasks = data.tasks.where((task) => task.isOpen).toList();
        final pendingLeaves =
            data.leaves.where((leave) => leave.status == 'PENDING').length;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              EmployeeHeader(employee: data.employee, user: widget.session.user),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  final twoColumns = constraints.maxWidth > 520;
                  return GridView.count(
                    crossAxisCount: twoColumns ? 4 : 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: twoColumns ? 1.25 : 1.45,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      StatCard(
                        label: 'Open tasks',
                        value: openTasks.length.toString(),
                        icon: Icons.task_alt,
                        color: brandColor,
                      ),
                      StatCard(
                        label: 'Today records',
                        value: todayRecords.toString(),
                        icon: Icons.access_time,
                        color: const Color(0xFF2563EB),
                      ),
                      StatCard(
                        label: 'Pending leaves',
                        value: pendingLeaves.toString(),
                        icon: Icons.beach_access,
                        color: accentColor,
                      ),
                      StatCard(
                        label: 'Skills',
                        value: data.employee == null ? '-' : 'View',
                        icon: Icons.psychology_alt,
                        color: const Color(0xFF7C3AED),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 18),
              const SectionTitle(title: 'Next tasks'),
              if (openTasks.isEmpty)
                const EmptyState(
                  icon: Icons.task_alt_outlined,
                  title: 'No open tasks',
                  body: 'Assigned tasks will appear here.',
                )
              else
                ...openTasks.take(3).map(
                      (task) => TaskCard(
                        task: task,
                        compact: true,
                        onStatusChanged: null,
                      ),
                    ),
              const SizedBox(height: 12),
              const SectionTitle(title: 'Recent leave requests'),
              if (data.leaves.isEmpty)
                const EmptyState(
                  icon: Icons.beach_access_outlined,
                  title: 'No leave requests',
                  body: 'Create a request from the Leave tab.',
                )
              else
                ...data.leaves.take(3).map(
                      (leave) => LeaveRequestCard(
                        request: leave,
                        onCancel: null,
                      ),
                    ),
            ],
          ),
        );
      },
    );
  }
}
