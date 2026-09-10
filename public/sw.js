// Service worker enxuto: só trata push e o clique na notificação.
// Sem cache de assets/offline nesta rodada.
self.addEventListener("push", (event) => {
  let dados = { title: "prevIA", body: "Você tem novidades.", url: "/pipeline" };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    // corpo não veio em JSON — mantém o padrão.
  }

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/pipeline";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "focus" in clients[0]) {
        await clients[0].focus();
        return clients[0].navigate ? clients[0].navigate(url) : undefined;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
