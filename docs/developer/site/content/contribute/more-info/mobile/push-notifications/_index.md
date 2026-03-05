---
title: "Set up push notifications"
heading: "Set up push notifications"
description: "Learn how to set up push notifications in your Mattermost mobile application."
date: 2015-05-20T11:35:32-04:00
weight: 3
aliases:
  - /contribute/mobile/push-notifications
---

When building a custom version of the Mattermost mobile app, you will also need to host your own {{< newtabref href="https://github.com/mattermost/mattermost-push-proxy/releases" title="Mattermost Push Notification Service" >}} and make a few modifications to your Mattermost mobile app to be able to get push notifications.

1. Setup the custom mobile apps to receive push notifications
    - [Android]({{< ref "/contribute/more-info/mobile/push-notifications/android" >}})
    - [iOS]({{< ref "/contribute/more-info/mobile/push-notifications/ios" >}})
2. [Setup the Mattermost push notification service]({{< ref "/contribute/more-info/mobile/push-notifications/service" >}})

If the use of a proxy server is required by your IT policy, see the [corporate proxy]({{<ref "corporate-proxy">}}) page.
