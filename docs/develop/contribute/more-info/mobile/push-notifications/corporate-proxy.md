---
title: "Corporate proxy"
sidebar_position: 4
---

When your IT policy requires a corporate proxy to scan and audit all outbound traffic the following options are available:

###### 1. Deploy Mattermost with connection restricted post-proxy relay in DMZ or a trusted cloud environment

Some legacy corporate proxy configurations may be incompatible with the requirements of modern mobile architectures, such as the requirement of HTTP/2 requests from Apple to send push notifications to iOS devices.

In this case, a **post-proxy relay** (which accepts network traffic from a corporate proxy such as NGINX, and transmits it to the final destination) can be deployed to take messages from the Mattermost server passing through your corporate IT proxy in the incompatible format, e.g. HTTP/1.1, transform it to HTTP/2 and relay it to its final destination, either to the [Apple Push Notification Service (APNS)](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/APNSOverview.html#//apple_ref/doc/uid/TP40008194-CH8-SW1) and [Google Fire Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) services.

The **post-proxy relay** [can be configured using the Mattermost Push Proxy installation guide](/developers/contribute/more-info/mobile/push-notifications/service) with connection restrictions to meet your custom security and compliance requirements.

You can also host in a trusted cloud environment such as AWS or Azure in place of a DMZ (this option may depend on your organization's internal policies).

![image](/img/mobile/post-proxy-relay.png)

###### 2. Whitelist Mattermost push notification proxy to bypass your corporate proxy server

Depending on your internal IT policy and approved waivers/exceptions, you may choose to deploy the [Mattermost Push Proxy](/developers/contribute/more-info/mobile/push-notifications/service) to connect directly to [Apple Push Notification Service (APNS)](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/APNSOverview.html#//apple_ref/doc/uid/TP40008194-CH8-SW1) without your corporate proxy.

You will need to [whitelist one subdomain and one port from Apple](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html#//apple_ref/doc/uid/TP40008194-CH11-SW1) for this option:

 - Development server: `api.development.push.apple.com:443`
 - Production server: `api.push.apple.com:443`

###### 3. Run App Store versions of the Mattermost mobile apps

You can use the mobile applications hosted by Mattermost in the [Apple App Store](https://apps.apple.com/ca/app/mattermost/id1257222717) or [Google Play Store](https://play.google.com/store/apps/details?id=com.mattermost.rn) and connect with [Mattermost Hosted Push Notification Service (HPNS)](https://docs.mattermost.com/deploy/mobile-hpns.html) through your corporate proxy.

The use of hosted applications by Mattermost [can be deployed with Enterprise Mobility Management solutions via AppConfig](https://docs.mattermost.com/deploy/mobile-appconfig.html). Wrapping is not supported with this option.
