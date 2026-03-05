---
title: "iOS push notifications"
heading: "iOS push notifications"
description: "Learn how to generate an APNs Auth Key for iOS push notifications."
date: 2025-09-19T08:44:00+08:00
weight: 2
aliases:
  - /contribute/mobile/push-notifications/ios
---

## Generate APNs Auth Key

To deliver push notifications on iOS, you need to authenticate with **Apple Push Notification service (APNs)**.  
Mattermost recommends using **token-based authentication** with an APNs Auth Key (`.p8`) instead of certificates.

---

### Prerequisites

- Apple Developer Program account  
- Registered iOS app Bundle ID with **Push Notifications** capability enabled  

---

### 1. Create an APNs Auth Key

1. Sign in to {{< newtabref href="https://developer.apple.com/account/resources/authkeys/list" title="Apple Developer: Keys" >}}.
2. Click **+** to register a new key.
   ![Apple Developer register new key](/img/mobile/ios-register-key.png)
3. **Enter a Key Name** to easily identify it later (e.g., *Mattermost Push Proxy*).
   ![Enter key name](/img/mobile/ios-key-name.png)
4. **Enable APNs** by checking the **Apple Push Notifications service (APNs)** box and click **Configure** to configure the key.
   ![Enable APNs](/img/mobile/ios-enable-apns.png)
5. On the **Configure Key** screen:
   - Select an **Environment**: *Sandbox*, *Production*, or *Sandbox & Production*.
   - Choose a **Key Restriction**: *Team Scoped (All Topics)* or *Topic Specific*. 
   ![Configure APNs key](/img/mobile/ios-configure-apns.png)
   - If you select *Topic Specific*, add the topics (App IDs) you want to associate.
   ![Add topics](/img/mobile/ios-add-topics.png)
6. Click **Save**, then **Continue**.
7. Review the Key details and click **Register**.
8. Download the generated file `AuthKey_XXXXXXXXXX.p8` and store it securely.
   > You can only download the file once.
9. Note the following values:
   - **Key ID** (from the Keys list)
   - **Team ID** (from your Apple Developer Membership)
   - **Bundle ID** (your app identifier, used as the APNs topic)

![Apple Developer key list](/img/mobile/ios-key-list.png)

---

### 2. Next Steps

Once you’ve generated your APNs Auth Key and collected the Key ID, Team ID, and Bundle ID, continue to the [Push Notification Service setup]({{< ref "/contribute/more-info/mobile/push-notifications/service" >}}) page to configure the Mattermost Push Notification Service (MPNS).
