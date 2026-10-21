// WebSocket (socket.io) đẩy thông báo thời gian thực lên web / app.
// Kết nối phải gửi access token; hợp lệ thì vào phòng riêng "user:<id>", không thì bị ngắt.

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtAccessPayload } from "../auth/jwt-payload.type";

@Injectable()
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true
  }
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtAccessPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET")
      });
      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  // Gửi thông báo tới mọi kết nối của một người dùng.
  emitToUser(userId: number, notification: unknown) {
    this.server.to(`user:${userId}`).emit("notification", notification);
  }
}
