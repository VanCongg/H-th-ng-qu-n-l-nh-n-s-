import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

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
      final locationPayload = await _currentLocationPayload();
      await widget.session.api.post('/attendance/$action', body: locationPayload);
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

  Future<Map<String, Object?>> _currentLocationPayload() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Location services are disabled.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw Exception('Location permission denied.');
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception('Location permission permanently denied.');
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );

    return {
      'latitude': position.latitude,
      'longitude': position.longitude,
    };
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
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed:
                          _submitting ? null : () => _record('check-in'),
                      icon: const Icon(Icons.login),
                      label: const Text('Check in'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed:
                          _submitting ? null : () => _record('check-out'),
                      icon: const Icon(Icons.logout),
                      label: const Text('Check out'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const SectionTitle(title: 'Attendance history'),
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
