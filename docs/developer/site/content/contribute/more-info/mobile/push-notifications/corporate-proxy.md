---
title: "Corporate proxy"
heading: "Push notification service with corporate proxy"
description: "Receive mobile push notifications in Mattermost if the use of a corporate proxy server is required by your IT policy."
date: 2020-03-09T11:35:32
weight: 4
aliases:
  - /contribute/mobile/push-notifications/corporate-proxy
---

When your IT policy requires a corporate proxy to scan and audit all outbound traffic the following options are available:

###### 1. Deploy Mattermost with connection restricted post-proxy relay in DMZ or a trusted cloud environment

Some legacy corporate proxy configurations may be incompatible with the requirements of modern mobile architectures, such as the requirement of HTTP/2 requests from Apple to send push notifications to iOS devices.

In this case, a **post-proxy relay** (which accepts network traffic from a corporate proxy such as NGINX, and transmits it to the final destination) can be deployed to take messages from the Mattermost server passing through your corporate IT proxy in the incompatible format, e.g. HTTP/1.1, transform it to HTTP/2 and relay it to its final destination, either to the {{< newtabref href="https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/APNSOverview.html#//apple_ref/doc/uid/TP40008194-CH8-SW1" title="Apple Push Notification Service (APNS)" >}} and {{< newtabref href="https://firebase.google.com/docs/cloud-messaging" title="Google Fire Cloud Messaging (FCM)" >}} services.

The **post-proxy relay** [can be configured using the Mattermost Push Proxy installation guide]({{< ref "/contribute/more-info/mobile/push-notifications/service" >}}) with connection restrictions to meet your custom security and compliance requirements.

You can also host in a trusted cloud environment such as AWS or Azure in place of a DMZ (this option may depend on your organization's internal policies).

![image](/img/mobile/post-proxy-relay.png)

###### 2. Whitelist Mattermost push notification proxy to bypass your corporate proxy server

Depending on your internal IT policy and approved waivers/exceptions, you may choose to deploy the [Mattermost Push Proxy]({{< ref "/contribute/more-info/mobile/push-notifications/service" >}}) to connect directly to {{< newtabref href="https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/APNSOverview.html#//apple_ref/doc/uid/TP40008194-CH8-SW1" title="Apple Push Notification Service (APNS)" >}} without your corporate proxy.

You will need to {{< newtabref href="https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html#//apple_ref/doc/uid/TP40008194-CH11-SW1" title="whitelist one subdomain and one port from Apple" >}} for this option:

 - Development server: `api.development.push.apple.com:443`
 - Production server: `api.push.apple.com:443`

###### 3. Run App Store versions of the Mattermost mobile apps

You can use the mobile applications hosted by Mattermost in the {{< newtabref href="https://apps.apple.com/ca/app/mattermost/id1257222717" title="Apple App Store" >}} or {{< newtabref href="https://play.google.com/store/apps/details?id=com.mattermost.rn" title="Google Play Store" >}} and connect with {{< newtabref href="https://docs.mattermost.com/deploy/mobile-hpns.html" title="Mattermost Hosted Push Notification Service (HPNS)" >}} through your corporate proxy.

The use of hosted applications by Mattermost {{< newtabref href="https://docs.mattermost.com/deploy/mobile-appconfig.html" title="can be deployed with Enterprise Mobility Management solutions via AppConfig" >}}. Wrapping is not supported with this option.
