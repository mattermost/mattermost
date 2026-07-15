---
title: "Adding a Plugin to Community"
sidebar_position: 40
---

To add a plugin to https://community.mattermost.com, you need to do the following:

1. Add the configuration for your plugin and enable it by modifying PluginSettings and PluginState here: https://github.com/mattermost/platform-private/blob/master/kubernetes/community-kubernetes/configmap-config.yaml
  - community-daily is using the configuration in the Database, so to configure the plugin you need first deploy the plugin and then access the system console and configure the plugin and enable it.
2. Add a line for your plugin here so it gets downloaded https://github.com/mattermost/platform-private/blob/master/kubernetes/community-kubernetes/configmap-plugins.yaml
  - Copy those changes to https://github.com/mattermost/platform-private/blob/master/kubernetes/community-daily-kubernetes/configmap-plugins.yaml for community-daily
3. Upload your plugin to the `mattermost-public-plugins-kubernetes` S3 bucket on our main AWS account
4. Run https://build.mattermost.com/job/build-pushes/job/comunity_update/ to update community.mattermost.com (you can check the ONLY_CONFIG option)
5. Run https://build-push.internal.mattermost.com/job/kubernetes-servers/job/comunity-update/ to update community-daily.mattermost.com


See an example commit here: https://github.com/mattermost/platform-private/commit/ee33cfcf14c195143d6c5ca008218f7fd710820b
