---
title: "Sign unsigned builds"
heading: "Sign unsigned builds with Mattermost"
description: "Mattermost publishes an unsigned build of the mobile app in the GitHub Releases page with every version that gets released."
date: 2018-05-20T11:35:32-04:00
weight: 4
aliases:
  - /contribute/mobile/unsigned
---

Mattermost publishes an unsigned build of the mobile app in the {{< newtabref href="https://github.com/mattermost/mattermost-mobile/releases" title="GitHub Releases" >}} page with every version that gets released.

These unsigned builds cannot be distributed nor installed directly on devices until they are properly signed.

---
{{<note "Note:">}}
Android and Apple require all apps to be digitally signed with a certificate before they can be installed.
{{</note>}}

---

To avoid rebuilding the apps from scratch, you could just **sign** the unsigned builds published by Mattermost with your certificates and keys.

- [Sign Unsigned Android]({{< ref "/contribute/more-info/mobile/unsigned/android" >}})
- [Sign Unsigned iOS]({{< ref "/contribute/more-info/mobile/unsigned/ios" >}})
