import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/password_rules.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';

/// Resets a forgotten password in two steps: the sign-in name, then the code
/// emailed to the account together with the new password. Returns the sign-in
/// name once the password is reset, or null when the person backs out.
Future<String?> showForgotPasswordDialog(
  BuildContext context, {
  required AppSession session,
  String initialIdentifier = '',
}) {
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (context) => _ForgotPasswordDialog(
      session: session,
      initialIdentifier: initialIdentifier,
    ),
  );
}

class _ForgotPasswordDialog extends StatefulWidget {
  const _ForgotPasswordDialog({
    required this.session,
    required this.initialIdentifier,
  });

  final AppSession session;
  final String initialIdentifier;

  @override
  State<_ForgotPasswordDialog> createState() => _ForgotPasswordDialogState();
}

class _ForgotPasswordDialogState extends State<_ForgotPasswordDialog> {
  static const _resendAfterSeconds = 60;

  final _formKey = GlobalKey<FormState>();
  late final _identifierController = TextEditingController(
    text: widget.initialIdentifier,
  );
  final _codeController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  bool _obscure = true;
  int _resendIn = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _identifierController.dispose();
    _codeController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  String get _identifier => _identifierController.text.trim();

  Future<void> _sendCode() async {
    if (_identifier.isEmpty) {
      _formKey.currentState?.validate();
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.session.forgotPassword(_identifier);
      if (!mounted) return;
      setState(() {
        _codeSent = true;
        _resendIn = _resendAfterSeconds;
      });
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted || _resendIn <= 1) timer.cancel();
        if (mounted) {
          setState(() => _resendIn = _resendIn > 0 ? _resendIn - 1 : 0);
        }
      });
    } catch (error) {
      if (mounted) showAppSnack(context, _message(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await widget.session.resetPassword(
        identifier: _identifier,
        otpCode: _codeController.text,
        newPassword: _newController.text,
      );
      if (mounted) Navigator.pop(context, _identifier);
    } catch (error) {
      if (mounted) showAppSnack(context, _message(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _message(Object error) =>
      error is ApiException ? error.message : error.toString();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: AppIconBadge(
        icon: _codeSent
            ? Icons.mark_email_read_outlined
            : Icons.lock_reset_rounded,
        color: brandColor,
        size: 54,
      ),
      title: Text(tx('Quên mật khẩu')),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: _codeSent ? _resetFields() : _identifierFields(),
            ),
          ),
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
      actions: [
        AppDialogActions(
          children: [
            OutlinedButton(
              onPressed: _busy ? null : () => Navigator.pop(context),
              child: Text(tx('Hủy')),
            ),
            FilledButton(
              onPressed: _busy ? null : (_codeSent ? _reset : _sendCode),
              child: Text(
                _busy
                    ? tx(_codeSent ? 'Đang lưu...' : 'Đang gửi...')
                    : tx(_codeSent ? 'Xác nhận' : 'Gửi mã'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  List<Widget> _identifierFields() => [
    Text(
      tx(
        'Nhập tên đăng nhập, email hoặc mã nhân viên. Mã xác thực sẽ được gửi tới email của tài khoản.',
      ),
    ),
    const SizedBox(height: 14),
    TextFormField(
      controller: _identifierController,
      autofocus: true,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.done,
      onFieldSubmitted: (_) => _sendCode(),
      decoration: InputDecoration(
        labelText: tx('Tài khoản'),
        hintText: tx('Tên đăng nhập, email hoặc mã NV'),
        prefixIcon: const Icon(Icons.person_outline_rounded),
      ),
      validator: (value) => (value ?? '').trim().isEmpty
          ? tx('Vui lòng nhập tên đăng nhập hoặc email')
          : null,
    ),
  ];

  List<Widget> _resetFields() => [
    Text(
      tx(
        'Nếu tài khoản tồn tại, mã 6 chữ số đã được gửi tới email của tài khoản. Mã có hiệu lực trong 10 phút.',
      ),
    ),
    const SizedBox(height: 14),
    TextFormField(
      controller: _codeController,
      autofocus: true,
      keyboardType: TextInputType.number,
      maxLength: 6,
      decoration: InputDecoration(
        labelText: tx('Mã xác thực'),
        prefixIcon: const Icon(Icons.pin_outlined),
        counterText: '',
      ),
      onChanged: (value) {
        final digits = value.replaceAll(RegExp(r'\D'), '');
        if (digits != value) {
          _codeController.value = TextEditingValue(
            text: digits,
            selection: TextSelection.collapsed(offset: digits.length),
          );
        }
      },
      validator: (value) => (value ?? '').length == 6
          ? null
          : tx('Vui lòng nhập mã gồm 6 chữ số'),
    ),
    const SizedBox(height: 12),
    TextFormField(
      controller: _newController,
      obscureText: _obscure,
      decoration: InputDecoration(
        labelText: tx('Mật khẩu mới'),
        prefixIcon: const Icon(Icons.password_rounded),
        errorMaxLines: 2,
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return tx('Vui lòng nhập mật khẩu mới');
        }
        if (!meetsPasswordRules(value)) return tx(passwordRuleHint);
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
    Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: _busy || _resendIn > 0 ? null : _sendCode,
        child: Text(
          _resendIn > 0
              ? tx('Gửi lại mã ({seconds}s)', {'seconds': '$_resendIn'})
              : tx('Gửi lại mã'),
        ),
      ),
    ),
  ];
}
