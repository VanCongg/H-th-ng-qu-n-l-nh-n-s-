import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/axios";
import { notificationsApi } from "../api/endpoints";
import type { Notification } from "../api/types";

type NotificationsState = {
  items: Notification[];
  unreadCount: number;
  socket: Socket | null;
  connect: (token: string) => void;
  disconnect: () => void;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  socket: null,

  connect: (token) => {
    if (get().socket) {
      return;
    }

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"]
    });
    socket.on("notification", (notification: Notification) => {
      set((state) => ({
        items: [notification, ...state.items].slice(0, 10),
        unreadCount: state.unreadCount + 1
      }));
    });

    set({ socket });
    void get().refresh();
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, items: [], unreadCount: 0 });
  },

  refresh: async () => {
    const [list, unreadCount] = await Promise.all([
      notificationsApi.list({ limit: 10 }),
      notificationsApi.unreadCount()
    ]);
    set({ items: list.items, unreadCount });
  },

  markRead: async (id) => {
    await notificationsApi.markRead(id);
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      unreadCount: state.items.find((item) => item.id === id && !item.isRead)
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount
    }));
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead();
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0
    }));
  }
}));
