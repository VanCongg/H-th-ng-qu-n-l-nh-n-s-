import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class LeaveBundle {
  LeaveBundle({required this.types, required this.requests});

  final List<LeaveType> types;
  final List<LeaveRequest> requests;
}

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  late Future<LeaveBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<LeaveBundle> _load() async {
    final types = await widget.session.api.getList(
      '/leave-types',
      LeaveType.fromJson,
    );
    final requests = await widget.session.api.getList(
      '/leave-requests/self',
      LeaveRequest.fromJson,
      query: {'limit': 50},
    );
    return LeaveBundle(types: types, requests: requests);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _cancel(LeaveRequest request) async {
    try {
      await widget.session.api.post('/leave-requests/${request.id}/cancel');
      if (mounted) showAppSnack(context, 'Leave request cancelled');
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    }
  }

  Future<void> _openCreateSheet(LeaveBundle bundle) async {
    if (bundle.types.isEmpty) {
      showAppSnack(context, 'No active leave types found', error: true);
      return;
    }

    final reasonController = TextEditingController();
    int? leaveTypeId = bundle.types.first.id;
    var startDate = DateTime.now();
    var endDate = DateTime.now();
    var submitting = false;

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> pickStart() async {
              final picked = await showDatePicker(
                context: context,
                initialDate: startDate,
                firstDate: DateTime(2020),
                lastDate: DateTime(2035),
              );
              if (picked != null) {
                setSheetState(() {
                  startDate = picked;
                  if (endDate.isBefore(startDate)) endDate = startDate;
                });
              }
            }

            Future<void> pickEnd() async {
              final picked = await showDatePicker(
                context: context,
                initialDate: endDate,
                firstDate: startDate,
                lastDate: DateTime(2035),
              );
              if (picked != null) {
                setSheetState(() => endDate = picked);
              }
            }

            Future<void> submit() async {
              if (reasonController.text.trim().isEmpty) {
                showAppSnack(context, 'Enter leave reason', error: true);
                return;
              }
              setSheetState(() => submitting = true);
              try {
                await widget.session.api.post(
                  '/leave-requests',
                  body: {
                    'leaveTypeId': leaveTypeId,
                    'startDate': apiDate(startDate),
                    'endDate': apiDate(endDate),
                    'reason': reasonController.text.trim(),
                  },
                );
                if (context.mounted) Navigator.pop(context, true);
              } catch (error) {
                if (context.mounted) {
                  showAppSnack(context, error.toString(), error: true);
                }
              } finally {
                if (context.mounted) {
                  setSheetState(() => submitting = false);
                }
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Create leave request',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<int>(
                    value: leaveTypeId,
                    decoration: const InputDecoration(
                      labelText: 'Leave type',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    items: bundle.types
                        .map(
                          (type) => DropdownMenuItem(
                            value: type.id,
                            child: Text(type.name),
                          ),
                        )
                        .toList(),
                    onChanged: submitting
                        ? null
                        : (value) => setSheetState(() => leaveTypeId = value),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: submitting ? null : pickStart,
                          icon: const Icon(Icons.event),
                          label: Text(formatDate(startDate)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: submitting ? null : pickEnd,
                          icon: const Icon(Icons.event_available),
                          label: Text(formatDate(endDate)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Reason',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: submitting ? null : submit,
                    icon: submitting
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                    label: const Text('Submit request'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    reasonController.dispose();
    if (created == true) {
      if (mounted) showAppSnack(context, 'Leave request created');
      await _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<LeaveBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final bundle = snapshot.data!;
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              FilledButton.icon(
                onPressed: () => _openCreateSheet(bundle),
                icon: const Icon(Icons.add),
                label: const Text('New leave request'),
              ),
              const SizedBox(height: 16),
              const SectionTitle(title: 'My requests'),
              if (bundle.requests.isEmpty)
                const EmptyState(
                  icon: Icons.beach_access_outlined,
                  title: 'No leave requests',
                  body: 'Submitted leave requests will appear here.',
                )
              else
                ...bundle.requests.map(
                  (request) => LeaveRequestCard(
                    request: request,
                    onCancel:
                        request.status == 'PENDING' ? () => _cancel(request) : null,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
