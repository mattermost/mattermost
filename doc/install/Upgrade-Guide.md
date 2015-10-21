# Mattermost Upgrade Guide

### Upgrading Mattermost v0.7 to v1.1.1

_Note: [Mattermost v1.1.1](https://github.com/mattermost/platform/releases/tag/v1.1.1) is a special release of Mattermost v1.1 that upgrades the database to Mattermost v1.1 from EITHER Mattermost v0.7 or Mattermost v1.0. THe following instructions are for upgrading from Mattermost v0.7 to v1.1.1 and skipping the upgrade to Mattermost v1.0._

If you've manually changed Mattermost v0.7 configuration by updating the `config.json` file, you'll need to port those changes to Mattermost v1.1.1: 

1. Go to the `config.json` file that you manually updated and note any differences from the [default `config.json` file in Mattermost 0.7](https://github.com/mattermost/platform/blob/v0.7.0/config/config.json). 

2. For each setting that you changed, check [the changelog documentation](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#configjson-changes-from-v07-to-v10) on whether the configuration setting has changed between v0.7 and v1.1.1

3. Update your new [`config.json` file in Mattermost v1.1](https://github.com/mattermost/platform/blob/v1.1.0/config/config.json), based on your preferences and the changelog documentation above. 

Optionally, you can use the new [System Console user interface](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md) to make changes to your new `config.json` file. 



