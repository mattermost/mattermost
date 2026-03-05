---
title: "Android push notifications"
heading: "Android push notifications at Mattermost"
description: "Learn how Android push notifications work using Mattermost and Firebase Cloud Messaging."
date: 2015-05-20T11:35:32-04:00
weight: 1
aliases:
  - /contribute/mobile/push-notifications/android
---

Push notifications on Android are managed and dispatched using {{< newtabref href="http://firebase.google.com/docs/cloud-messaging/" title="Firebase Cloud Messaging (FCM)" >}}

- Create a Firebase project within the {{< newtabref href="https://console.firebase.google.com" title="Firebase Console" >}}.

- Click **Add Project**
   ![image](/img/mobile/firebase_console.png)

- Enter the project name, project ID and Country

- Click **CREATE PROJECT**

   ![image](/img/mobile/firebase_project.png)

Once the project is created you'll be redirected to the Firebase project
dashboard

![image](/img/mobile/firebase_dashboard.png)

- Click **Add Firebase to your Android App**
- Enter the package ID of your custom Mattermost app as the **Android package name**.
- Enter an **App nickname** so you can identify it with ease
- Click **REGISTER APP**
- Once the app has been registered, download the **google-services.json** file which will be used later

- Click **CONTINUE** and then **FINISH**
   ![image](/img/mobile/firebase_register_app.png)
   ![image](/img/mobile/firebase_google_services.png)
   ![image](/img/mobile/firebase_sdk.png)

Now that you have created the Firebase project and the app and
downloaded the *google-services.json* file, you need to make some
changes in the project.

- Replace `android/app/google-services.json` with the one you downloaded earlier

At this point, you can build the Mattermost app for Android and setup the [Mattermost Push Notification Service]({{< ref "/contribute/more-info/mobile/push-notifications/service" >}}).

