---
title: Bump Version Number
heading: "Bump Version Number at Mattermost"
description: "Learn how to bump a version number in your local copy of mattermost-mobile."
date: 2017-11-07T14:28:35-05:00
weight: 1
---

This must be done in your local copy of the [mattermost-mobile](https://github.com/mattermost/mattermost-mobile)

1. Source the environment variables
    ```
    export LC_ALL="en_US.UTF-8"
    
    ############ MATTERMOST BUILD ############
    export COMMIT_CHANGES_TO_GIT=true
    export BRANCH_TO_BUILD=master
    export GIT_LOCAL_BRANCH=version-number
    export RESET_GIT_BRANCH=false
    
    
    export INCREMENT_VERSION_NUMBER_MESSAGE="Bump app version number to"
    export VERSION_NUMBER=
    ```
        
{{%note "Env vars"%}}Alternatively you can copy the environment variables to the `mattermost-mobile/fastlane/.env` file.{{%/note%}}

{{%note "Specify version number"%}}Set the variable `VERSION_NUMBER` to X.X.X (eg: 1.17.0).{{%/note%}}

2. Increase the version number of the app.
    - ``$ cd fastlane`` in the mattermost-mobile directory.
    - run ``$ fastlane set_app_version``.

3. Submit a PR on the mobile repo with the branch `version-number`.
  
4. Merge the PR into master and cherry-pick to the release branch.
