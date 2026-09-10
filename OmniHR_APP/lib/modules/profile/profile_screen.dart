import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';
import '../notifications/notifications_screen.dart';
import '../performance_review/performance_review_screen.dart';

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

    List<EmployeeSkill> skills = const [];
    if (employee != null) {
      try {
        skills = await widget.session.api.getList(
          '/employees/${employee.id}/skills',
          EmployeeSkill.fromJson,
        );
      } catch (_) {
        skills = const [];
      }
    }

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
      showAppSnack(context, tx('Đã đổi mật khẩu.'));
    }
  }

  Future<void> _openAddSkillSheet(
    Employee employee,
    List<EmployeeSkill> existingSkills,
  ) async {
    List<Skill> catalog;
    try {
      catalog = await widget.session.api.getList('/skills', Skill.fromJson);
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          error is ApiException ? error.message : error.toString(),
          error: true,
        );
      }
      return;
    }
    if (!mounted) return;

    final existingSkillIds = existingSkills
        .map((skill) => skill.skill.id)
        .toSet();
    final available = catalog
        .where((skill) => !existingSkillIds.contains(skill.id))
        .toList();

    if (available.isEmpty) {
      if (mounted) {
        showAppSnack(context, tx('Bạn đã thêm tất cả kỹ năng khả dụng.'));
      }
      return;
    }

    int? skillId = available.first.id;
    String proficiency = 'INTERMEDIATE';
    final yearsController = TextEditingController();
    final noteController = TextEditingController();
    var submitting = false;

    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> submit() async {
              if (skillId == null) {
                showAppSnack(
                  context,
                  tx('Vui lòng chọn kỹ năng.'),
                  error: true,
                );
                return;
              }
              setSheetState(() => submitting = true);
              try {
                await widget.session.api.post(
                  '/employees/${employee.id}/skills',
                  body: {
                    'skillId': skillId,
                    'proficiency': proficiency,
                    if (yearsController.text.trim().isNotEmpty)
                      'yearsExperience': double.tryParse(
                        yearsController.text.trim(),
                      ),
                    if (noteController.text.trim().isNotEmpty)
                      'note': noteController.text.trim(),
                  },
                );
                if (context.mounted) Navigator.pop(context, true);
              } catch (error) {
                if (context.mounted) {
                  showAppSnack(
                    context,
                    error is ApiException ? error.message : error.toString(),
                    error: true,
                  );
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
                    tx('Thêm kỹ năng'),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<int>(
                    initialValue: skillId,
                    decoration: InputDecoration(
                      labelText: tx('Kỹ năng'),
                      prefixIcon: const Icon(Icons.psychology_alt_outlined),
                    ),
                    items: available
                        .map(
                          (skill) => DropdownMenuItem(
                            value: skill.id,
                            child: Text(skill.name),
                          ),
                        )
                        .toList(),
                    onChanged: submitting
                        ? null
                        : (value) => setSheetState(() => skillId = value),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: proficiency,
                    decoration: InputDecoration(
                      labelText: tx('Mức độ'),
                      prefixIcon: const Icon(Icons.bar_chart_rounded),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: 'BEGINNER',
                        child: Text(tx('Mới bắt đầu')),
                      ),
                      DropdownMenuItem(
                        value: 'INTERMEDIATE',
                        child: Text(tx('Trung bình')),
                      ),
                      DropdownMenuItem(
                        value: 'ADVANCED',
                        child: Text(tx('Khá')),
                      ),
                      DropdownMenuItem(
                        value: 'EXPERT',
                        child: Text(tx('Chuyên gia')),
                      ),
                    ],
                    onChanged: submitting
                        ? null
                        : (value) => setSheetState(
                            () => proficiency = value ?? proficiency,
                          ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: yearsController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: InputDecoration(
                      labelText: tx('Số năm kinh nghiệm (tùy chọn)'),
                      prefixIcon: const Icon(Icons.timelapse_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    minLines: 2,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: tx('Ghi chú (tùy chọn)'),
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
                        : const Icon(Icons.check_rounded),
                    label: Text(tx(submitting ? 'Đang lưu...' : 'Lưu kỹ năng')),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    yearsController.dispose();
    noteController.dispose();
    if (added == true) {
      if (mounted) showAppSnack(context, tx('Đã thêm kỹ năng.'));
      await _refresh();
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          icon: AppIconBadge(
            icon: Icons.logout_rounded,
            color: dangerColor,
            size: 54,
          ),
          title: Text(tx('Đăng xuất')),
          content: Text(tx('Bạn muốn đăng xuất khỏi OmniHR?')),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tx('Hủy')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: dangerColor),
              child: Text(tx('Đăng xuất')),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      await widget.session.logout();
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
        final skills = bundle.skills;
        final user = widget.session.user;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              _ProfileHeader(employee: employee, user: user),
              const SizedBox(height: 20),
              AppPanel(
                child: Column(
                  children: [
                    ProfileRow(
                      icon: Icons.mail_outline_rounded,
                      label: tx('Email công ty'),
                      value: employee?.companyEmail ?? user?.email,
                    ),
                    ProfileRow(
                      icon: Icons.verified_user_outlined,
                      label: tx('Trạng thái'),
                      value: employee == null
                          ? null
                          : friendlyStatus(employee.status),
                    ),
                    ProfileRow(
                      icon: Icons.event_outlined,
                      label: tx('Ngày vào làm'),
                      value: formatDate(employee?.hireDate),
                    ),
                    ProfileRow(
                      icon: Icons.phone_outlined,
                      label: tx('Số điện thoại'),
                      value: employee?.phone,
                    ),
                    Divider(
                      height: 24,
                      color: brandColor.withValues(alpha: 0.08),
                    ),
                    SectionTitle(title: tx('Tài khoản')),
                    ProfileRow(
                      icon: Icons.person_outline_rounded,
                      label: tx('Tên đăng nhập'),
                      value: user?.username,
                    ),
                    ProfileRow(
                      icon: Icons.dns_outlined,
                      label: tx('Máy chủ API'),
                      value: widget.session.baseUrl,
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => SubScreen(
                            title: tx('Thông báo'),
                            child: NotificationsScreen(session: widget.session),
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.notifications_outlined),
                      label: Text(tx('Thông báo')),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => SubScreen(
                            title: tx('Đánh giá hiệu suất'),
                            child: PerformanceReviewScreen(
                              session: widget.session,
                            ),
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.star_outline_rounded),
                      label: Text(tx('Đánh giá hiệu suất')),
                    ),
                    const SizedBox(height: 10),
                    FilledButton.icon(
                      onPressed: _openChangePassword,
                      icon: const Icon(Icons.password_rounded),
                      label: Text(tx('Đổi mật khẩu')),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout_rounded),
                      label: Text(tx('Đăng xuất')),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: dangerColor,
                        side: BorderSide(
                          color: dangerColor.withValues(alpha: 0.32),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _DisplaySettingsPanel(session: widget.session),
              const SizedBox(height: 18),
              AppPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SectionTitle(
                      title: tx('Kỹ năng'),
                      subtitle: tx('Kỹ năng bạn tự khai báo'),
                    ),
                    if (skills.isEmpty)
                      EmptyState(
                        icon: Icons.psychology_alt_outlined,
                        title: tx('Chưa có kỹ năng'),
                        body: tx(
                          'Thêm kỹ năng để quản lý gợi ý task chính xác hơn.',
                        ),
                      )
                    else
                      ...skills.map((skill) => EmployeeSkillCard(skill: skill)),
                    const SizedBox(height: 4),
                    FilledButton.icon(
                      onPressed: employee == null
                          ? null
                          : () => _openAddSkillSheet(employee, skills),
                      icon: const Icon(Icons.add_rounded),
                      label: Text(tx('Thêm kỹ năng')),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DisplaySettingsPanel extends StatelessWidget {
  const _DisplaySettingsPanel({required this.session});

  final AppSession session;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(title: tx('Cài đặt hiển thị')),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: session.themeMode == ThemeMode.dark,
            onChanged: (value) =>
                session.setThemeMode(value ? ThemeMode.dark : ThemeMode.light),
            title: Text(tx('Giao diện tối')),
            secondary: Icon(
              session.themeMode == ThemeMode.dark
                  ? Icons.dark_mode_rounded
                  : Icons.light_mode_rounded,
              color: brandColor,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.translate_rounded, color: brandColor),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  tx('Ngôn ngữ'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              SegmentedButton<AppLanguage>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(
                    value: AppLanguage.vi,
                    label: Text(tx('Tiếng Việt')),
                  ),
                  ButtonSegment(
                    value: AppLanguage.en,
                    label: Text(tx('English')),
                  ),
                ],
                selected: {session.language},
                onSelectionChanged: (value) => session.setLanguage(value.first),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.employee, required this.user});

  final Employee? employee;
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? tx('Nhân viên OmniHR');
    final initial = name.trim().isEmpty ? 'O' : name.trim()[0].toUpperCase();
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Hero(
            tag: 'profile-avatar',
            child: Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [brandColor, brandGreen],
                ),
              ),
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle.isEmpty ? textOf(user?.email, '-') : subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (employee?.status != null) ...[
            const SizedBox(width: 8),
            Pill(
              label: friendlyStatus(employee!.status),
              color: statusColor(employee!.status),
            ),
          ],
        ],
      ),
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
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await widget.session.changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      _close(true);
    } catch (error) {
      _showError(error is ApiException ? error.message : error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _close(bool value) {
    if (!mounted) return;
    Navigator.pop(context, value);
  }

  void _showError(String message) {
    if (!mounted) return;
    showAppSnack(context, message, error: true);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: AppIconBadge(
        icon: Icons.password_rounded,
        color: brandColor,
        size: 54,
      ),
      title: Text(tx('Đổi mật khẩu')),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _currentController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: tx('Mật khẩu hiện tại'),
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return tx('Vui lòng nhập mật khẩu hiện tại');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _newController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: tx('Mật khẩu mới'),
                  prefixIcon: const Icon(Icons.password_rounded),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return tx('Vui lòng nhập mật khẩu mới');
                  }
                  if (value.length < 6) {
                    return tx('Mật khẩu mới phải có ít nhất 6 ký tự');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _confirmController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: tx('Nhập lại mật khẩu mới'),
                  prefixIcon: const Icon(Icons.verified_outlined),
                  suffixIcon: IconButton(
                    tooltip: tx(_obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'),
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return tx('Vui lòng nhập lại mật khẩu mới');
                  }
                  if (value != _newController.text) {
                    return tx('Mật khẩu nhập lại không khớp');
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: Text(tx('Hủy')),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: Text(tx(_submitting ? 'Đang lưu...' : 'Lưu')),
        ),
      ],
    );
  }
}
