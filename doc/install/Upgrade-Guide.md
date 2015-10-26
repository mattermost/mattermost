# Mattermost Upgrade Guide

### Upgrading Mattermost in GitLab 8.0 to GitLab 8.1 with omnibus

Mattermost 0.7.1-beta in GitLab 8.0 was a pre-release of Mattermost and Mattermost v1.1.1 in GitLab 8.1 was [updated significantly](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#configjson-changes-from-v07-to-v10) to get to a stable, forwards-compatible platform for Mattermost. 

The Mattermost team didn't think it made sense for GitLab omnibus to attempt an automated re-configuration of Mattermost (since 0.7.1-beta was a pre-release) given the scale of change, so we're providing instructions for GitLab users who have customized their Mattermost deployments in 8.0 to move to 8.1: 

1. Follow the Upgrading Mattermost v0.7.1-beta to v1.1.1 instructions below to identify the settings in Mattermost's `config.json` file that differ from defaults and need to be updated from GitLab 8.0 to 8.1. 
2. Upgrade to GitLab 8.1 using omnibus, and allowing it overwrite `config.json` to the new Mattermost v1.1.1 format
3. Manually update `config.json` to new settings identified in Step 1. 

Optionally, you can use the new [System Console user interface](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md) to make changes to your new `config.json` file. 


### Upgrading Mattermost v0.7.1-beta to v1.1.1

_Note: [Mattermost v1.1.1](https://github.com/mattermost/platform/releases/tag/v1.1.1) is a special release of Mattermost v1.1 that upgrades the database to Mattermost v1.1 from EITHER Mattermost v0.7 or Mattermost v1.0. The following instructions are for upgrading from Mattermost v0.7.1-beta to v1.1.1 and skipping the upgrade to Mattermost v1.0._

If you've manually changed Mattermost v0.7.1-beta configuration by updating the `config.json` file, you'll need to port those changes to Mattermost v1.1.1: 

1. Go to the `config.json` file that you manually updated and note any differences from the [default `config.json` file in Mattermost 0.7](https://github.com/mattermost/platform/blob/v0.7.0/config/config.json). 

2. For each setting that you changed, check [the changelog documentation](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#configjson-changes-from-v07-to-v10) on whether the configuration setting has changed between v0.7 and v1.1.1

3. Update your new [`config.json` file in Mattermost v1.1](https://github.com/mattermost/platform/blob/v1.1.0/config/config.json), based on your preferences and the changelog documentation above. 

Optionally, you can use the new [System Console user interface](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md) to make changes to your new `config.json` file. 





