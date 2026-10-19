---
title: "Build your own mobile app"
sidebar_position: 2
---

You can build the app from source and distribute it within your team or company either using the App Stores, Enterprise App Stores or EMM providers, or another way of your choosing.

At Mattermost, we build and deploy the Apps using a CI pipeline. The pipeline has different jobs and steps that run on specific contexts based on what we want to accomplish. You can check it out [here](https://github.com/mattermost/mattermost-mobile/blob/main/.github/workflows).

As an alternative we've also created a set of **scripts** to help automate build tasks. Learn more about the scripts by reviewing the [package.json](https://github.com/mattermost/mattermost-mobile/blob/master/package.json) file.


<Note title="Note">
By using the **scripts**, [Fastlane](https://docs.fastlane.tools/#choose-your-installation-method) and other dependencies will be installed in your system.
</Note>




- [Build the Android app](/developers/contribute/more-info/mobile/build-your-own/android)
- [Build the iOS app](/developers/contribute/more-info/mobile/build-your-own/ios)

### Push notifications with your own mobile app

When building your own Mattermost mobile app, you will also need to host the [Mattermost Push Notification Service](https://github.com/mattermost/mattermost-push-proxy) in order to receive push notifications.

See [Setup Push Notifications](/developers/contribute/more-info/mobile/push-notifications) for more details.
