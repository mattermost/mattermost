# Mattermost Mobile v2

- **Minimum Server versions:** Current ESR version (10.11.0+)
- **Supported iOS versions:** 16.0+
- **Supported Android versions:** 7.0+

Mattermost is an open source Slack-alternative used by thousands of companies around the world in 21 languages. Learn more at [https://mattermost.com](https://mattermost.com).

You can download our apps from the [App Store](https://mattermost.com/mattermost-ios-app/) or [Google Play Store](https://mattermost.com/mattermost-android-app/), or [build them yourself](https://developers.mattermost.com/contribute/mobile/build-your-own/). 

We plan on releasing monthly updates with new features - check the [changelog](https://github.com/mattermost/mattermost-mobile/blob/master/CHANGELOG.md) for what features are currently supported! 

**Important:** If you self-compile the Mattermost Mobile apps you also need to deploy your own [Mattermost Push Notification Service](https://github.com/mattermost/mattermost-push-proxy/releases). 

# How to Contribute

### Testing

To help with testing app updates before they're released, you can:

1. Sign up to be a beta tester
   - [Android](https://play.google.com/apps/testing/com.mattermost.rnbeta)
   - [iOS](https://testflight.apple.com/join/Q7Rx7K9P) - Open this link from your iOS device
2. Install the `Mattermost Beta` app. New updates in the Beta app are released periodically. You will receive a notification when the new updates are available.
3. File any bugs you find by filing a [GitHub issue](https://github.com/mattermost/mattermost-mobile/issues) with:
   - Device information
   - Repro steps
   - Observed behavior (including screenshot / video when possible)
   - Expected behavior
4. (Optional) [Sign up for our team site](https://community.mattermost.com/signup_user_complete/?id=codoy5s743rq5mk18i7u5ksz7e&md=link&sbr=su)
   - Join the [Native Mobile Apps channel](https://community.mattermost.com/core/channels/native-mobile-apps) to see what's new and discuss feedback with other contributors and the core team
   
You can leave the Beta testing program at any time:
- On Android, [click this link](https://play.google.com/apps/testing/com.mattermost.rnbeta) while logged in with your Google Play email address used to opt-in for the Beta program, then click **Leave the program**. 
- On iOS, access the `Mattermost Beta` app page in TestFlight and click **Stop Testing**.

### Contribute Code 

1. Look in [GitHub issues](https://mattermost.com/pl/help-wanted-mattermost-mobile) for issues marked as [Help Wanted]
2. Comment to let people know you’re working on it
3. Follow [these instructions](https://developers.mattermost.com/contribute/mobile/developer-setup/) to set up your developer environment
4. Join the [Native Mobile Apps channel](https://community.mattermost.com/core/channels/native-mobile-apps) on our team site to ask questions



# Frequently Asked Questions

### How is data handled on mobile devices after a user account is deactivated?

App data is wiped from the device when a user logs out of the app. If the user is logged in when the account is deactivated, then within one minute the system logs the user out, and as a result all app data is wiped from the device.

### I need the code for the v1 version

You can still access it! We have moved the code from master to the [v1 branch](https://github.com/mattermost/mattermost-mobile/tree/v1). Be aware that we will not be providing any more v1 versions or updates in the public stores.

# Troubleshooting

### I keep getting a message "Cannot connect to the server. Please check your server URL and internet connection."

This sometimes appears when there is an issue with the SSL certificate configuration. 

To check that your SSL certificate is set up correctly, test the SSL certificate by visiting a site such as https://www.ssllabs.com/ssltest/index.html. If there’s an error about the missing chain or certificate path, there is likely an intermediate certificate missing that needs to be included.

Please note that the apps cannot connect to servers with self-signed certificates, consider using [Let's Encrypt](https://docs.mattermost.com/install/config-ssl-http2-nginx.html) instead. 

### I see a “Connecting…” bar that does not go away

If your app is working properly, you should see a grey “Connecting…” bar that clears or says “Connected” after the app reconnects. 

If you are seeing this message all the time, and your internet connection seems fine: 

Ask your server administrator if the server uses NGINX or another webserver as a reverse proxy. If so, they should check that it is configured correctly for [supporting the websocket connection for APIv4 endpoints](https://docs.mattermost.com/install/install-ubuntu-1604.html#configuring-nginx-as-a-proxy-for-mattermost-server). 
