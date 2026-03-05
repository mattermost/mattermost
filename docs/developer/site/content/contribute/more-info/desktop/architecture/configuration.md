---
title: "Configuration"
heading: "Configuration and server management"
description: "Outlines the renderer processes that represent external Mattermost servers, and the modules that manage them."
date: 2023-04-03T00:00:00-05:00
weight: 1
aliases:
  - /contribute/desktop/architecture/configuration
---

### Config module

The **configuration** module in the **Common** module is responsible for facilitating reading from and writing to external configuration sources. It also consolidates, verifies, and upgrades configuration where applicable.

#### Files

We have a few different configuration files in the Desktop App, but the main one is `config.json`. Most of the user's configuration from the Settings Window is stored there, as well as any user-configured servers.

The application supports different configuration versions and allows for them to be migrating to the version supported by the configuration module via the `upgradePreferences` module. When no configuration is found, the `defaultPreferences` object is copied over to the main configuration module.

We also support a build configuration in which the packager of the application can pre-define servers and a few other configuration items.

#### Registry

We support reading from the Windows registry to allow system administrators to define Group Policy that will pre-define servers and potentially disable user-defined servers and automatic updates as per administrator wishes.

Templates for these can be found under `resources\windows\gpo`.

### Server manager

The `ServerManager` is a singleton class that acts as a single source of truth for all server configuration, managing adding/modifying/removing servers and serving the server information to the rest of the application.

#### Initialization

We populate the `ServerManager` with all servers provided by the **configuration** module, marking them as pre-defined when applicable to not allow the user to modify them. Servers are given a unique UUID when the app initialized, and this UUID acts as the global way of identifying the server to the rest of the application.

An external call is responsible for populating information about the specific Mattermost server (eg. server version, plugins installed), but the data is stored within the `ServerManager`.

#### Modification

The `ServerManager` is the only place that allows the persistent server configuration to be modified. Changes cannot be made directly through the **configuration** module. Once a server is modified, the `ServerManager` will update the **configuration** module with the new changes.

When a server is added or updating, up to two events will be emitted:
- `SERVERS_UPDATE`: This event is emitted when the `ServerManager` has new changes. This could be a name, URL or an ordering change.
- `SERVERS_URL_MODIFIED`: This event is emitted specifically when a URL has changed, signifying that the application might need to fetch new remote server information or refresh any views associated with the server to reflect the new URL.

#### Lookup

We provide a server lookup call that allows for an arbitrary URL to be provided and potentially matched to a server. If found, the UUID will be provided. This function is useful for deep linking or for cross-server linking, when only a URL is available when the request is provided.