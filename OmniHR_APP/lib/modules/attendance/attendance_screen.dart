import 'package:flutter/material.dart';

import '../../core/attendance_location.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  late Future<List<AttendanceRecord>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<AttendanceRecord>> _load() {
    return widget.session.api.getList(
      '/attendance/self',
      AttendanceRecord.fromJson,
      query: {'limit': 50},
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _record(String action) async {
    setState(() => _submitting = true);
    try {
      final locationPayload = await currentAttendanceLocationPayload();
      await widget.session.api.post(
        '/attendance/$action',
        body: locationPayload,
      );
      if (mounted) {
        showAppSnack(
          context,
          action == 'check-in' ? 'Checked in' : 'Checked out',
        );
      }
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AttendanceRecord>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final records = snapshot.data ?? [];
        final todayRecords = records.where((record) {
          final date = dateOf(record.workDate);
          return date != null && sameDate(date, DateTime.now());
        }).length;
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 104),
            children: [
              ActionPanel(
                icon: Icons.location_on_outlined,
                title: 'Today attendance',
                subtitle: '$todayRecords record(s) captured today',
                color: brandColor,
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _submitting
                            ? null
                            : () => _record('check-in'),
                        icon: const Icon(Icons.login_rounded),
                        label: const Text('Check in'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _submitting
                            ? null
                            : () => _record('check-out'),
                        icon: const Icon(Icons.logout_rounded),
                        label: const Text('Check out'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const SectionTitle(
                title: 'Attendance history',
                subtitle: 'Recent check-in and check-out events',
              ),
              if (records.isEmpty)
                const EmptyState(
                  icon: Icons.access_time_outlined,
                  title: 'No attendance records',
                  body: 'Check in to start today attendance log.',
                )
              else
                ...records.map((record) => AttendanceCard(record: record)),
            ],
          ),
        );
      },
    );
  }
}
