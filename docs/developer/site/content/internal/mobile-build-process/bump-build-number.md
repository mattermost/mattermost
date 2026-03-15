---
title: Bump Build Number
heading: "Bump Build Number at Mattermost"
description: "Find out how to bump a build number in your local copy of mattermost-mobile."
date: 2017-11-07T14:28:35-05:00
weight: 2
---

This must be done in your local copy of the [mattermost-mobile](https://github.com/mattermost/mattermost-mobile)

1. Source the environment variables
    ```
    export LC_ALL="en_US.UTF-8"
    
    ############ MATTERMOST BUILD ############
    export COMMIT_CHANGES_TO_GIT=true
    export BRANCH_TO_BUILD=master
    export GIT_LOCAL_BRANCH=build-number
    export RESET_GIT_BRANCH=false
    
    export INCREMENT_BUILD_NUMBER=true
    export INCREMENT_BUILD_NUMBER_MESSAGE="Bump app build number to"
    ```

{{%note "Env vars"%}}Alternatively you can copy the environment variables to the `mattermost-mobile/fastlane/.env` file.{{%/note%}}

{{%note "Specify build number"%}}Sometimes you need to specify the build number instead of just increasing it by one.<br />In that case add the environment variable `BUILD_NUMBER` and set the build number.{{%/note%}}

2. Increase the build number of the app.
    - ``$ cd fastlane`` in the mattermost-mobile directory.
    - run ``$ fastlane set_app_build_number``.

3. Submit a PR on the mobile repo with the branch `build-number`.
  
4. Merge the PR into master and cherry-pick to the release branch.
