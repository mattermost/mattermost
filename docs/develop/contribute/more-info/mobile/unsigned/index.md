---
title: "Sign unsigned builds"
sidebar_position: 4
---

Mattermost publishes an unsigned build of the mobile app in the [GitHub Releases](https://github.com/mattermost/mattermost-mobile/releases) page with every version that gets released.

These unsigned builds cannot be distributed nor installed directly on devices until they are properly signed.

---

<Note title="Note">
Android and Apple require all apps to be digitally signed with a certificate before they can be installed.
</Note>


---

To avoid rebuilding the apps from scratch, you could just **sign** the unsigned builds published by Mattermost with your certificates and keys.

- [Sign Unsigned Android](/developers/contribute/more-info/mobile/unsigned/android)
- [Sign Unsigned iOS](/developers/contribute/more-info/mobile/unsigned/ios)
