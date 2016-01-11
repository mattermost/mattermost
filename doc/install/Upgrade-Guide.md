# Mattermost Upgrade Guide

### Upgrading Mattermost to Next Major Release 

Each release of Mattermost contains logic to upgrade it from the previously major build version. For example, version 1.2 upgrades the database and configuration data schema for a Mattermost version 1.1 server. The following procedure outlines how to upgrade Mattermost to the next major release version. 

If you're upgrading across multiple major releases, from 1.0.x to 1.2.x for example, please run the following procedure once for each incremental upgrade, in sequential order. 

1. Download the **next major build release** of your server
  1.  Determine the current version of your Mattermost server 
    1. Go to any team site, opening the main menu at the top right of the left-hand sidebar and selecting **About Mattermost**
  2. Identify the next major build release of your Mattermost server from the list of [stable Mattermost releases](https://github.com/mattermost/platform/releases)
    1. For example, if your current version is 1.1.0, you want to select version 1.2.0. 
      1. In some cases there will be **minor build releases**, such as 1.2.1 and 1.2.2. The minor build number indicates a bug fix or security issue release. Testing on minor build versions is less extensive than on major build versions and it is recommended that you use the minor build only if you need the specific additions included. 
  3. Review Release Notes 
    1. Check the release notes for the version of Mattermost you are able to install, and note any setting changes in the **Compatibility** section that apply to your deployment (Release notes across versions are available from the [CHANGELOG](https://github.com/mattermost/platform/blob/master/CHANGELOG.md)). 
  4. Download the `mattermost.tar.gz` file with the correct version for your upgrade
    1. You can use `wget` to retrieve a specific version. For example, to download v1.1.0 run `wget https://github.com/mattermost/platform/releases/download/v1.x.x/mattermost.tar.gz`
2. Stop the Mattermost Server
  1. As best practice, consider posting to the Town Square channel of active teams pre-announcing the scheduled downtime to apply these upgrade procedures
  2. To stop the server run `sudo stop mattermost`
2. Backup your data
  1. Back up your `config.json` file, which contains your system configuration. This will be used to restore your current settings after the new version is installed
  2. Backup your database using your organization's standard procedures for backing up MySQL or PostgreSQL
  3. If you're using local file storage, back up the location where files are stored
4. Decompress `mattermost.tar.gz` and use its contents to replace the current version of Mattermost on disk
  1. Run `tar -xvzf mattermost.tar.gz`
5. Restore the state of your server by copying the backed up version of `config.json` in place of the default `config.json` 
6. Start your server and address any setting changes relevant in the latest version of Mattermost
  1. Run `sudo start mattermost`
  2. Go to the **System Console** to update any settings that have been added or modified based on the **Compatibility** section in the release notes of the version you are installing (Release notes across versions are available from the [CHANGELOG](https://github.com/mattermost/platform/blob/master/CHANGELOG.md)). 
    1. Opening the System Console and saving a change will upgrade your `config.json` schema to the latest version using default values for new settings added
7. Test the system is working by going to the URL of an existing team. You may need to refresh your Mattermost browser page in order to get the latest updates from the upgrade

### Upgrading from Mattermost Beta (Version 0.7)

The following instructions apply to updating installations of Mattermost v0.7-Beta to Mattermost 1.1. 

## GitLab Mattermost Upgrade Troubleshooting 

#### Upgrading GitLab Mattermost when GitLab upgrade skips versions 

Mattermost is designed to be upgraded sequentially through major version releases. If you skip versions when upgrading GitLab, you may find a `panic: The database schema version of 1.1.0 cannot be upgraded. You must not skip a version` error in your `/var/log/gitlab/mattermost/current` directory. If so: 

1. Run `platform -version` to check your version of Mattermost 
2. If your version of the Mattermost binary doesn't match the version listed in the database error message, downgrade the version of the Mattermost binary you are using by [following the manual upgrade steps for Mattermost](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-to-next-major-release) and using the database schema version listed in the error messages for the version you select in Step 1) iv). 
3. Once Mattermost is working again, you can use the same upgrade procedure to upgrade Mattermost version by version to your current GitLab version. After this is done, GitLab automation should continue to work for future upgrades, so long as you don't skip versions. 

| GitLab Version | Mattermost Version | 
|----------------|---------------------|
|  8.1.x | v1.1.0 | 
|  8.2.x | v1.2.1 | 
|  8.3.x | v1.3.0 | 

## Upgrade Guide for Mattermost Beta Release 

#### Upgrading Mattermost in GitLab 8.0 to GitLab 8.1 with omnibus

Mattermost 0.7.1-beta in GitLab 8.0 was a pre-release of Mattermost and Mattermost v1.1.1 in GitLab 8.1 was [updated significantly](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#configjson-changes-from-v07-to-v10) to get to a stable, forwards-compatible platform for Mattermost. 

The Mattermost team didn't think it made sense for GitLab omnibus to attempt an automated re-configuration of Mattermost (since 0.7.1-beta was a pre-release) given the scale of change, so we're providing instructions for GitLab users who have customized their Mattermost deployments in 8.0 to move to 8.1: 

1. Follow the [Upgrading Mattermost v0.7.1-beta to v1.1.1 instructions](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-v071-beta-to-v111) below to identify the settings in Mattermost's `config.json` file that differ from defaults and need to be updated from GitLab 8.0 to 8.1
2. Upgrade to GitLab 8.1 using omnibus, and allowing it overwrite `config.json` to the new Mattermost v1.1.1 format
3. Manually update `config.json` to new settings identified in Step 1

Optionally, you can use the new [System Console user interface](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md) to make changes to your new `config.json` file.

#### Upgrading Mattermost v0.7.1-beta to v1.1.1

_Note: [Mattermost v1.1.1](https://github.com/mattermost/platform/releases/tag/v1.1.1) is a special release of Mattermost v1.1 that upgrades the database to Mattermost v1.1 from EITHER Mattermost v0.7 or Mattermost v1.0. The following instructions are for upgrading from Mattermost v0.7.1-beta to v1.1.1 and skipping the upgrade to Mattermost v1.0._

If you've manually changed Mattermost v0.7.1-beta configuration by updating the `config.json` file, you'll need to port those changes to Mattermost v1.1.1: 

1. Go to the `config.json` file that you manually updated and note any differences from the [default `config.json` file in Mattermost 0.7](https://github.com/mattermost/platform/blob/v0.7.0/config/config.json). 

2. For each setting that you changed, check [the changelog documentation](https://github.com/mattermost/platform/blob/master/CHANGELOG.md#configjson-changes-from-v07-to-v10) on whether the configuration setting has changed between v0.7 and v1.1.1

3. Update your new [`config.json` file in Mattermost v1.1](https://github.com/mattermost/platform/blob/v1.1.0/config/config.json), based on your preferences and the changelog documentation above

Optionally, you can use the new [System Console user interface](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md) to make changes to your new `config.json` file.
