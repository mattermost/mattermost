---
title: "Sign unsigned Android builds"
heading: "Sign unsigned Android builds"
description: "Learn the steps needed to modify and sign the Mattermost mobile app so it can be distributed and installed on Android devices."
date: 2018-05-20T11:35:32-04:00
weight: 1
aliases:
- /contribute/mobile/unsigned/android
---

With every Mattermost mobile app release, we publish the Android unsigned apk in in the {{< newtabref href="https://github.com/mattermost/mattermost-mobile/releases" title="GitHub Releases" >}} page. This guide describes the steps needed to modify and sign the app, so it can be distributed and installed on Android devices.

#### Prerequisites

1. {{< newtabref href="https://ibotpeaches.github.io/Apktool/" title="Apktool" >}} is a tool for reverse engineering Android apk files.
2. {{< newtabref href="http://xmlstar.sourceforge.net/doc/UG/xmlstarlet-ug.html" title="XMLStarlet" >}} is a set of command line utilities (tools) which can be used to transform, query, validate, and edit XML documents and files using a simple set of shell commands in the same way it is done for plain text files using UNIX `grep`, `sed`, `awk`, `diff`, `patch`, `join`, etc., commands.
3. {{< newtabref href="https://stedolan.github.io/jq/" title="JQ" >}} is like `sed` for JSON data - you can use it to slice, filter, map, and transform structured data with the same ease that `sed`, `awk`, and `grep` let you work with text.
4. Android SDK as described in the [Developer Setup]({{< ref "/contribute/more-info/mobile/developer-setup#additional-setup-for-android" >}}).
5. Set up keys and Google Services as described in steps 2, 3, 4, and 6 of the [Build your own App guide]({{< ref "/contribute/more-info/mobile/build-your-own/android#build-preparations" >}}).
6. [sign-android](/scripts/sign-android) script to sign the Android app.

#### Sign tool

```bash
Usage: sign-android <unsigned apk file>
		[-e|--extract path]
		[-p|--package-id packageID]
		[-g|--google-services path]
		[-d|--display-name displayName]
		outputApk
Usage: sign-android -h|--help
Options:
	-e, --extract path			    (Optional) Path to extract the unsigned APK file.
                                    By default the path of the unsigned APK is used.

	-p, --package-id packageID		(Optional) Specify the unique Android application ID.

	-g, --google-services path		(Optional) Path to the google-services.json file.
							        Will setup the Firebase to receive Push Notifications.
							        Warning: will apply only if packageID is set.

	-d, --display-name displayName	(Optional) Specify new application display name.
                                    By default "Mattermost" is used.

	-h, --help				        Display help message.
```

#### Sign the Mattermost Android app

Now that all requirements are met, it's time to sign the Mattermost app for Android. Most of the options of the signing tool are optional but you should use your own `package identifier`, `google services settings`, and change the `display name`.

* Create a folder that will serve as your working directory to store all the needed files.
* Download the [sign-android](/scripts/sign-android) script and save it in your working directory.
* Download the {{< newtabref href="https://github.com/mattermost/mattermost-mobile/releases" title="Android unsigned build" >}} and save it in your working directory.
* Open a terminal to your working directory and make sure the `sign-android` script is executable.

    ```
    $ ls -la
    total 49756
    drwxr-xr-x   4 user  staff       128 Oct  2 08:12 .
    drwx------@ 59 user  staff      1888 Oct  1 14:12 ..
    -rw-r--r--   1 user  staff  50685064 Sep 29 10:58 Mattermost-unsigned.apk
    -rw-r--r--   1 user  staff      2597 Oct  2 08:19 google-services.json
    -rwxr-xr-x   1 user  staff      7005 Sep 30 12:47 sign-android
    ```

* Sign the app

    ```bash
    $ ./sign-android Mattermost-unsigned.apk -p com.example.test -g google-services.json -d "My App" MyApp-signed.apk
    ```

Once the code sign is complete you should have a signed APK in the working directory with the name **MyApp-signed.apk**.

---
{{<note "Note:">}}
The app name can be anything but be sure to use double quotes if the name includes white spaces. If you are using a `Google Services` JSON file, you need to specify a `package identifier` that has a corresponding client in the JSON configuration file.
{{</note>}}

---
