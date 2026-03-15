---
title: "White label"
heading: "White label"
description: "Learn how to white label the Mattermost Mobile app, and how to replace and override the assets used for your Mattermost deployment."
date: 2018-05-20T11:35:32-04:00
weight: 3
aliases:
  - /contribute/mobile/build-your-own/white-label
---

We've made it easy to white label the mobile app and to replace and override the assets used, however, you have to [Build Your Own App]({{< ref "/contribute/more-info/mobile/build-your-own" >}}) from source.

If you look at the [Project Folder Structure]({{< ref "/contribute/more-info/mobile/developer-setup/structure" >}}), you'll see that there is an assets folder containing a base folder with assets provided by Mattermost. These include localization files and images as well as a release folder that optionally contains the icons and the splash screen of the app when building in release mode.

To replace these with your own assets, create a sub-directory called `override` in the `assets` folder. The assets that you add using the same directory structure and file names as in the `base` directory, will be used instead of the original ones.

### Localization strings

To replace these with your own assets, create a sub-directory called `override` in the `assets` folder. Using the same directory structure and file names as in the `base` directory, you can add assets to the override folder to be used instead.

For example, to override `assets/base/images/logo.png` you would replace your own `logo.png` file in `assets/override/images/logo.png`.

### Images

To replace an image, copy the image to `assets/override/images/` with the same location and file name as in the `base` folder.

---
{{<note "Note:">}}
Make sure the images have the same height, width, and DPI as the images that you are overriding.
{{</note>}}

---

### App splash screen and launch icons

In the `assets` directory you will find a folder named `assets/base/release` which contains an `icons` folder and a `splash_screen` folder under each platform directory.

Copy the full `release` directory under `assets/override/release` and then replace each image with the same name. Make sure you replace all the icon images for the platform you are building the app - the same applies to the splash screen.

The splash screen's background color is white by default and the image is centered. If you need to change the color or the layout to improve the experience of your new splash screen make sure that you also override the file `launch_screen.xml` for Android and `LaunchScreen.storyboard` for iOS. Both can be found under `assets/base/release/splash_screen/<platform>/`.

Splash screen and launch icons assets are replaced at build time when the environment variable `REPLACE_ASSETS` is set to true (default is false).

---
{{<note "Note:">}}
Make sure the images have the same height, width, and DPI as the images that you are overriding.
{{</note>}}

---

### Configuration

The `config.json` file handles custom configuration for the app for settings that cannot be controlled by the Mattermost server. Like with localization strings, create a `config.json` file under `assets/override` and just include the keys and values that you wish to change that are present in `assets/base/config.json`.

For example, if you want the app to automatically provide a server URL and skip the screen to input it, you would add the following to `assets/override/config.json`:

```json
{
  "DefaultServerUrl": "http://192.168.0.13:8065",
  "AutoSelectServerUrl": true
}
```
---
{{<note "Note:">}}
The above key/value pairs are taken from the original `config.json` file. Since we don’t need to change anything else, we only included these two settings.
{{</note>}}

---
