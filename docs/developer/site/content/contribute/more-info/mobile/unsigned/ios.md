---
title: "Sign unsigned iOS builds"
heading: "Sign unsigned iOS builds"
description: "Learn about the steps needed to modify and sign the Mattermost app so it can be distributed and installed on iOS devices."
date: 2018-05-20T11:35:32-04:00
weight: 2
aliases:
  - /contribute/mobile/unsigned/ios
---

With every Mattermost mobile app release, we publish the iOS unsigned ipa in in the {{< newtabref href="https://github.com/mattermost/mattermost-mobile/releases" title="GitHub Releases" >}} page, this guide describes the steps needed to modify and sign the app, so it can be distributed and installed on iOS devices.

#### Requisites

1. macOS with {{< newtabref href="https://itunes.apple.com/us/app/xcode/id497799835?ls=1&mt=12" title="Xcode" >}} installed. The minimum required version is **11.0**.
2. Install the Xcode command line tools:
	```bash
	$ xcode-select --install
    ```
3. Set up your Certificate and Provisioning profiles as described in steps 1 and 2 for [Run on iOS Devices]({{< ref "/contribute/more-info/mobile/developer-setup/run#run-on-ios-devices" >}}) in the Developer Setup.
4. [sign-ios](/scripts/sign-ios) script to sign the iOS app.

#### Sign Tool

```bash
Usage: sign-ios <unsigned ipa file>
		[-a|--app provisioning]
		[-n|--notification provisioning]
		[-s|--share provisioning]
		[-c|--certificate certificateName]
		[-g|--app-group-id appGroupId]
		[-d|--display-name displayName]
		outputIpa
Usage: sign-ios -h|--help
Options:
	-a, --app provisioning	            Provisioning profile for the main application.
							                -a xxx.mobileprovision

	-n, --notification provisioning		Provisioning profile for the notification extension.
							                -n xxx.mobileprovision

	-s, --share provisioning		    Provisioning profile for the share extension.
							                -s xxx.mobileprovision

	-d, --display-name displayName		(Optional) Specify new application display name.
                                        By default "Mattermost" is used.
							                Warning: will apply for all nested apps and extensions.

	-g, --app-group-id appGroupId		Specify the app group identifier to use (AppGroupId).
							                Warning: will apply for all nested apps and extensions.

	-v, --verbose				        Verbose output.

	-h, --help				            Display help message.
```

#### Sign the Mattermost iOS app

Now that all requisites are met, it's time to sign the Mattermost app for iOS. Most of the options of the signing tool are mandatory
and you should be using your own `provisioning profiles`, `certificate`, also you could change the app `display name`.

* Create a folder that will serve as your working directory to store all the needed files.
* Download your **Apple Distribution certificate** from the {{< newtabref href="https://developer.apple.com/account/resources/certificates/list" title="Apple Developer portal" >}} and save it in your working directory.
* Install the previously downloaded certificate into your macOS Keychain. {{< newtabref href="https://developer.apple.com/support/certificates" title="Learn more" >}}.
* Download your **Provisioning profiles** from the {{< newtabref href="https://developer.apple.com/account/resources/profiles/list" title="Apple Developer portal" >}} and save it in your working directory.
* Download the [sign-ios](/scripts/sign-ios) script and save it in your working directory.
* Download the {{< newtabref href="https://github.com/mattermost/mattermost-mobile/releases" title="iOS unsigned build" >}} and save it in your working directory.
* Open a terminal to your working directory and make sure the `sign-ios` script is executable.

```
$ ls -la
total 81472
drwxr-xr-x  7 user  staff       224 Oct 11 10:54 .
drwxr-xr-x  8 user  staff       256 Oct 11 10:49 ..
-rw-r--r--@ 1 user  staff  75261811 Oct  2 12:44 Mattermost-unsigned.ipa
-rw-r--r--@ 1 user  staff     10746 Oct  2 10:30 app.mobileprovision
-rw-r--r--@ 1 user  staff      9963 Oct  2 10:30 noti.mobileprovision
-rw-r--r--@ 1 user  staff     10763 Oct  2 10:30 share.mobileprovision
-rwxr-xr-x  1 user  staff     38581 Oct 11 10:54 sign-ios
```

* Sign the app

```bash
$ ./sign-ios Mattermost-unsigned.ipa -c "Apple Distribution: XXXXXX. (XXXXXXXXXX)" -a app.mobileprovision -n noti.mobileprovision -s share.mobileprovision -g group.com.mattermost -d "My App Display Name" MyApp-signed.ipa
```

Once the code sign is complete you should have a signed IPA in the working directory with the name **MyApp-signed.ipa**.

---
{{<note "Note:">}}
The app name can be anything but be sure to use double quotes if the name includes white spaces. The name of the `certificate` should match the name in the macOS Keychain.
{{</note>}}

---
