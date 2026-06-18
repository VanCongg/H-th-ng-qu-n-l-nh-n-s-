import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class ProfileBundle {
  ProfileBundle({required this.employee, required this.skills});

  final Employee? employee;
  final List<EmployeeSkill> skills;
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<ProfileBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ProfileBundle> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }

    final skills = employee == null
        ? <EmployeeSkill>[]
        : await widget.session.api.getList(
            '/employees/${employee.id}/skills',
            EmployeeSkill.fromJson,
          );

    return ProfileBundle(employee: employee, skills: skills);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _openChangePassword() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (context) => ChangePasswordDialog(session: widget.session),
    );
    if (changed == true && mounted) {
      showAppSnack(context, 'Password changed');
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProfileBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final bundle = snapshot.data!;
        final employee = bundle.employee;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              EmployeeHeader(employee: employee, user: widget.session.user),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      ProfileRow(
                        icon: Icons.mail_outline,
                        label: 'Company email',
                        value: employee?.companyEmail ?? widget.session.user?.email,
                      ),
                      ProfileRow(
                        icon: Icons.phone_outlined,
                        label: 'Phone',
                        value: employee?.phone,
                      ),
                      ProfileRow(
                        icon: Icons.business_outlined,
                        label: 'Department',
                        value: employee?.department?.name,
                      ),
                      ProfileRow(
                        icon: Icons.badge_outlined,
                        label: 'Position',
                        value: employee?.position?.name,
                      ),
                      ProfileRow(
                        icon: Icons.event_outlined,
                        label: 'Hire date',
                        value: formatDate(employee?.hireDate),
                      ),
                      ProfileRow(
                        icon: Icons.dns_outlined,
                        label: 'API server',
                        value: widget.session.baseUrl,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _openChangePassword,
                icon: const Icon(Icons.password),
                label: const Text('Change password'),
              ),
              const SizedBox(height: 18),
              const SectionTitle(title: 'Skills'),
              if (bundle.skills.isEmpty)
                const EmptyState(
                  icon: Icons.psychology_alt_outlined,
                  title: 'No skills yet',
                  body: 'Employee skills managed by HR will appear here.',
                )
              else
                ...bundle.skills.map((skill) => EmployeeSkillCard(skill: skill)),
            ],
          ),
        );
      },
    );
  }
}

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key, required this.session});

  final AppSession session;

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_newController.text.length < 6) {
      showAppSnack(
        context,
        'New password must have at least 6 characters',
        error: true,
      );
      return;
    }
    if (_newController.text != _confirmController.text) {
      showAppSnack(context, 'Password confirmation does not match', error: true);
      return;
    }

    setState(() => _submitting = true);
    try {
      await widget.session.api.post(
        '/auth/change-password',
        body: {
          'currentPassword': _currentController.text,
          'newPassword': _newController.text,
        },
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change password'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _currentController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New password'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm password'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: Text(_submitting ? 'Saving...' : 'Save'),
        ),
      ],
    );
  }
}
