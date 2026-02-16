self.addEventListener('push', function (event) {
  if (!event) return

  var payload = {}

  if (event.data) {
    try {
      payload = event.data.json()
    } catch (error) {
      payload = {
        title: 'WhisprSpace',
        body: event.data.text(),
      }
    }
  }

  var title = payload.title || 'WhisprSpace'
  var body = payload.body || 'You have a new notification.'
  var targetUrl = payload.url || '/notifications'
  var notificationId = payload.notificationId || null
  var tag = payload.tag || (notificationId ? 'notif-' + notificationId : 'notif-generic')

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: {
        url: targetUrl,
        notificationId: notificationId,
      },
      tag: tag,
      renotify: false,
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var targetUrl =
    event.notification &&
    event.notification.data &&
    event.notification.data.url
      ? event.notification.data.url
      : '/notifications'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i]
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl)
          }
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})

