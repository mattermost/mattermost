---
title: "Bump Version Number"
sidebar_position: 1
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
        

<Note title="Env vars">
Alternatively you can copy the environment variables to the `mattermost-mobile/fastlane/.env` file.
</Note>



<Note title="Specify version number">
Set the variable `VERSION_NUMBER` to X.X.X (eg: 1.17.0).
</Note>


2. Increase the version number of the app.
    - ``$ cd fastlane`` in the mattermost-mobile directory.
    - run ``$ fastlane set_app_version``.

3. Submit a PR on the mobile repo with the branch `version-number`.
  
4. Merge the PR into master and cherry-pick to the release branch.
