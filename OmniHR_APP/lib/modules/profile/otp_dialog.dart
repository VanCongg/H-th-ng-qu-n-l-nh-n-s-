// Hộp thoại nhập mã OTP gửi qua email (dùng khi đổi mật khẩu, số điện thoại, email).

import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';

/// Asks the server to email a one-time code for [purpose] - PASSWORD_CHANGE,
/// PHONE_CHANGE or EMAIL_CHANGE, with [target] the new phone or email - and
/// returns the code the person types in, or null when they back out. For a
/// new email the code goes to that new address, which is what proves it is
/// theirs.
Future<String?> showOtpDialog(
  BuildContext context, {
  required AppSession session,
  required String purpose,
  String? target,
}) {
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (context) =>
        _OtpDialog(session: session, purpose: purpose, target: target),
  );
}

class _OtpDialog extends StatefulWidget {
  const _OtpDialog({required this.session, required this.purpose, this.target});

  final AppSession session;
  final String purpose;
  final String? target;

  @override
  State<_OtpDialog> createState() => _OtpDialogState();
}

class _OtpDialogState extends State<_OtpDialog> {
  final _controller = TextEditingController();
  String? _sentTo;
  String? _error;
  bool _sending = false;
  int _resendIn = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _send();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final sent = await widget.session.requestVerificationCode(
        purpose: widget.purpose,
        target: widget.target,
      );
      if (!mounted) return;
      setState(() {
        _sentTo = textOf(sent['sentTo']);
        _resendIn = intOf(sent['resendAfterSeconds']);
      });
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted || _resendIn <= 1) {
          timer.cancel();
        }
        if (mounted) {
          setState(() => _resendIn = _resendIn > 0 ? _resendIn - 1 : 0);
        }
      });
    } catch (error) {
      if (mounted) {
        setState(
          () =>
              _error = error is ApiException ? error.message : error.toString(),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final code = _controller.text;
    return AlertDialog(
      icon: AppIconBadge(
        icon: Icons.mark_email_read_outlined,
        color: brandColor,
        size: 54,
      ),
      title: Text(tx('Nhập mã xác thực')),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_sending && _sentTo == null)
                Text(tx('Đang gửi mã tới email của bạn...'))
              else if (_sentTo != null)
                Text(
                  tx(
                    'Mã gồm 6 chữ số đã được gửi tới {email}. Mã có hiệu lực trong 10 phút.',
                    {'email': _sentTo!},
                  ),
                ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: TextStyle(color: dangerColor)),
              ],
              const SizedBox(height: 14),
              TextField(
                controller: _controller,
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24,
                  letterSpacing: 8,
                  fontWeight: FontWeight.w800,
                ),
                decoration: const InputDecoration(counterText: ''),
                onChanged: (value) {
                  final digits = value.replaceAll(RegExp(r'\D'), '');
                  if (digits != value) {
                    _controller.value = TextEditingValue(
                      text: digits,
                      selection: TextSelection.collapsed(offset: digits.length),
                    );
                  }
                  setState(() {});
                },
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _sending || _resendIn > 0 ? null : _send,
                  child: Text(
                    _resendIn > 0
                        ? tx('Gửi lại mã ({seconds}s)', {
                            'seconds': '$_resendIn',
                          })
                        : tx('Gửi lại mã'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
      actions: [
        AppDialogActions(
          children: [
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: Text(tx('Hủy')),
            ),
            FilledButton(
              onPressed: code.length == 6
                  ? () => Navigator.pop(context, code)
                  : null,
              child: Text(tx('Xác nhận')),
            ),
          ],
        ),
      ],
    );
  }
}
