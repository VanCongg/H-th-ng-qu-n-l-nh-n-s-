import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

/// A person's picture, or their initial on the brand gradient when they have
/// none. Handles both kinds of avatar the backend stores: a `data:image/...`
/// URL uploaded from the app or the web, and a plain http(s) link.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.avatarUrl,
    this.size = 40,
  });

  final String name;
  final String? avatarUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final image = avatarImage(avatarUrl);
    final initial = name.trim().isEmpty ? 'O' : name.trim()[0].toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        // Same avatar gradient as the web header.
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1971C2), Color(0xFF0CA678), Color(0xFFF59F00)],
          stops: [0, 0.65, 1],
        ),
        image: image == null
            ? null
            : DecorationImage(image: image, fit: BoxFit.cover),
      ),
      child: image == null
          ? Text(
              initial,
              style: TextStyle(
                color: Colors.white,
                fontSize: size * 0.4,
                fontWeight: FontWeight.w900,
              ),
            )
          : null,
    );
  }
}

/// Decoded pictures by URL: a data URL is decoded once, not on every rebuild.
final Map<String, Uint8List> _decoded = {};

/// The image behind an avatar value, or null when there is none to show.
ImageProvider? avatarImage(String? value) {
  final url = value?.trim() ?? '';
  if (url.isEmpty) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return NetworkImage(url);
  }
  if (!url.startsWith('data:image/')) return null;
  final bytes = _decoded[url] ??= _decodeDataUrl(url);
  return bytes.isEmpty ? null : MemoryImage(bytes);
}

Uint8List _decodeDataUrl(String url) {
  final comma = url.indexOf(',');
  if (comma < 0) return Uint8List(0);
  if (_decoded.length > 32) _decoded.clear();
  try {
    return base64Decode(url.substring(comma + 1));
  } on FormatException {
    return Uint8List(0);
  }
}
