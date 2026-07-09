self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    (async () => {
      // Avoid double popups: if a Kanbanica window is focused, the app shows an
      // in-app toast instead, so suppress the browser/desktop notification here.
      // When no window is focused (hidden tab, minimized, unfocused, or app
      // closed), show the browser notification. The Inbox is saved server-side
      // regardless — this only affects the popup.
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.some((c) => c.focused);
      if (focused) return;

      await self.registration.showNotification(data.title ?? "Kanbanica", {
        body: data.body ?? "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url ?? "/" },
        requireInteraction: false,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
