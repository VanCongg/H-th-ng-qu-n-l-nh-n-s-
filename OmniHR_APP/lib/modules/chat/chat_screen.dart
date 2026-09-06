import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/chat_models.dart';
import 'chat_message_bubble.dart';
import 'pending_action_card.dart';

const _quickReplies = [
  'Hôm nay tôi đã chấm công chưa?',
  'Tôi còn bao nhiêu ngày phép?',
  'Tôi muốn xin nghỉ',
  'Công việc nào của tôi sắp đến hạn?',
  'Tháng này có ai sinh nhật?',
  'Manager của tôi là ai?',
];

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  late final _messages = <ChatMessage>[
    ChatMessage(
      role: ChatMessageRole.assistant,
      content: tx(
        'Xin chào, tôi là HRGenie. Bạn muốn hỏi về chấm công, nghỉ phép hay '
        'công việc?',
      ),
    ),
  ];

  int? _conversationId;
  bool _sending = false;
  bool _actionBusy = false;

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    await _sendText(text);
  }

  Future<void> _sendText(String text) async {
    if (text.isEmpty || _sending) return;

    setState(() {
      _messages.add(ChatMessage(role: ChatMessageRole.user, content: text));
      _sending = true;
    });
    _controller.clear();
    _scrollToEnd();

    try {
      final data = mapOf(
        await widget.session.api.post(
          '/chatbot/message',
          body: {
            if (_conversationId != null) 'conversationId': _conversationId,
            'message': text,
          },
        ),
      );
      final pendingMap = mapOf(data['pendingAction']);
      final pendingAction = pendingMap.isEmpty
          ? null
          : PendingChatAction.fromJson(pendingMap);
      setState(() {
        _conversationId = intOf(data['conversationId'], _conversationId ?? 0);
        _messages.add(
          ChatMessage(
            role: ChatMessageRole.assistant,
            content: textOf(data['reply'], tx('Tôi chưa có phản hồi phù hợp.')),
            pendingAction: pendingAction,
          ),
        );
      });
    } catch (error) {
      setState(() {
        _messages.add(
          ChatMessage(
            role: ChatMessageRole.assistant,
            content: error is ApiException ? error.message : error.toString(),
          ),
        );
      });
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        _scrollToEnd();
      }
    }
  }

  Future<void> _confirm(PendingChatAction action) async {
    if (_actionBusy) return;
    setState(() => _actionBusy = true);
    try {
      final data = mapOf(
        await widget.session.api.post(
          '/chatbot/actions/${action.actionId}/confirm',
        ),
      );
      setState(() {
        _clearPendingAction(action.actionId);
        _messages.add(
          ChatMessage(
            role: ChatMessageRole.assistant,
            content: textOf(data['reply'], tx('Đã xác nhận thao tác.')),
          ),
        );
      });
    } catch (error) {
      _showError(error);
    } finally {
      if (mounted) {
        setState(() => _actionBusy = false);
        _scrollToEnd();
      }
    }
  }

  Future<void> _cancel(PendingChatAction action) async {
    if (_actionBusy) return;
    setState(() => _actionBusy = true);
    try {
      final data = mapOf(
        await widget.session.api.post(
          '/chatbot/actions/${action.actionId}/cancel',
          body: {'reason': 'User cancelled from mobile'},
        ),
      );
      setState(() {
        _clearPendingAction(action.actionId);
        _messages.add(
          ChatMessage(
            role: ChatMessageRole.assistant,
            content: textOf(data['reply'], tx('Đã hủy thao tác.')),
          ),
        );
      });
    } catch (error) {
      _showError(error);
    } finally {
      if (mounted) {
        setState(() => _actionBusy = false);
        _scrollToEnd();
      }
    }
  }

  void _showError(Object error) {
    if (!mounted) return;
    showAppSnack(
      context,
      error is ApiException ? error.message : error.toString(),
      error: true,
    );
  }

  void _clearPendingAction(int actionId) {
    for (var index = 0; index < _messages.length; index += 1) {
      final message = _messages[index];
      if (message.pendingAction?.actionId == actionId) {
        _messages[index] = ChatMessage(
          role: message.role,
          content: message.content,
        );
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: appBackgroundColor,
      appBar: AppBar(
        title: const Text('HRGenie'),
        actions: [
          IconButton(
            tooltip: tx('Làm mới'),
            onPressed: _sending || _actionBusy
                ? null
                : () {
                    setState(() {
                      _conversationId = null;
                      _messages
                        ..clear()
                        ..add(
                          ChatMessage(
                            role: ChatMessageRole.assistant,
                            content: tx(
                              'Tôi đã mở hội thoại mới. Bạn muốn hỏi gì?',
                            ),
                          ),
                        );
                    });
                  },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.separated(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                itemCount: _messages.length + (_sending ? 1 : 0),
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  if (_sending && index == _messages.length) {
                    return const _TypingIndicator();
                  }

                  final message = _messages[index];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ChatMessageBubble(message: message),
                      if (message.pendingAction != null) ...[
                        const SizedBox(height: 10),
                        PendingActionCard(
                          action: message.pendingAction!,
                          busy: _actionBusy,
                          onConfirm: () => _confirm(message.pendingAction!),
                          onCancel: () => _cancel(message.pendingAction!),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
            _QuickReplies(
              enabled: !_sending && !_actionBusy,
              onSelected: _sendText,
            ),
            _Composer(
              controller: _controller,
              sending: _sending,
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickReplies extends StatelessWidget {
  const _QuickReplies({required this.enabled, required this.onSelected});

  final bool enabled;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surfaceColor,
        border: Border(
          top: BorderSide(color: brandColor.withValues(alpha: 0.06)),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 6),
        child: Row(
          children: [
            for (final reply in _quickReplies) ...[
              ActionChip(
                avatar: const Icon(Icons.bolt_rounded, size: 16),
                label: Text(tx(reply)),
                onPressed: enabled ? () => onSelected(reply) : null,
              ),
              const SizedBox(width: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surfaceColor,
        border: Border(
          top: BorderSide(color: brandColor.withValues(alpha: 0.08)),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: tx('Nhập câu hỏi cho HRGenie'),
                  prefixIcon: const Icon(Icons.auto_awesome_rounded),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox.square(
              dimension: 48,
              child: FilledButton(
                onPressed: sending ? null : onSend,
                style: FilledButton.styleFrom(padding: EdgeInsets.zero),
                child: sending
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: brandColor.withValues(alpha: 0.08)),
        ),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: SizedBox.square(
            dimension: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
    );
  }
}
