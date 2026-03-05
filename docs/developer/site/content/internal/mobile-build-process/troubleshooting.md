---
title: Troubleshooting
heading: "Troubleshooting the Mobile Build Process"
description: "Having problems with the mobile build process? Give these troubleshooting tips a try."
date: 2017-11-07T14:28:35-05:00
weight: 3
---

##### Error message
Unable to resolve module `mattermost-redux/client` from `/Users/****/workspace/mm/mobile-build-app-pr/share_extension/android/index.js`: Module `mattermost-redux/client` does not exist in the Haste module map.

##### Solution
Make sure the **mattermost-redux** package is build correctly.

The `make build` set of commands uses `npm ci`, sometimes the `npm ci` command will not run
the *prepare* script used by `mattermost-redux` thus the library will not built causing the
mobile build to fail.

   - ssh to the build machine (MacStadium)
   - ``cd ~/workspace/mm/mattermost-mobile-prod-release/mattermost-mobile``
   - ``rm -rf node_modules``
   - ``npm cache clean --force``
   - ``npm i``
   - Finally make sure ``ls node_modules/mattermost-redux/`` shows that mattermost-redux was built.

{{%note "Credentials" %}} The IP of the build machine user/pwd can be found in the [build-machine-credentials.md](https://github.com/mattermost/mattermost-mobile-private/blob/master/build-machine-credentials.md) file that belongs to the 
mattermost-mobile-private repo.{{%/note%}}
