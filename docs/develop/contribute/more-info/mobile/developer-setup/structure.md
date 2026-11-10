---
title: "Folder structure"
sidebar_position: 1
---
The following is an overview of the Mobile app repository file structure:

```goat
|
+-- .circleci  # Circle CI workflow to build the apps
+-- .github    # GitHub actions
+-- .husky
+-- android    # Android specific code
+-- app        # React Native code
|   | 
|   +-- actions
|   +-- client
|   +-- components
|   +-- constants
|   +-- context
|   +-- database
|   +-- helpers
|   +-- hooks
|   +-- i18n
|   +-- init
|   +-- managers
|   +-- notifications
|   +-- products
|   +-- queries
|   +-- screens
|   +-- store
|   +-- utils
|
+-- assets
|   |
|   +-- base
|   |   |
|   |   +-- i18n
|   |   +-- images
|   |   +-- release
|   +-- fonts
|
+-- build
|   |
|   +-- notice-file
|
+-- detox
+-- docs
+-- eslint
+-- fastlane         # Fastlane scripts to build the app
+-- ios              # iOS specific code
+-- patches          # Patches for various dependencies
+-- scripts
+-- share_extension  # Android's share extension app
+-- test
+-- types
```
