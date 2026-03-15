---
title: "System Console"
heading: "The Mattermost System Console"
description: "Find out how to add fields, expose settings, and make settings available for non-admins in the System Console."
date: 2022-03-15T13:38:26-04:00
weight: 5
aliases:
  - /contribute/server/system_console
---

## Add fields to the configuration

In order to add fields to the configuration, you need to modify `model/config.go` in the server by adding the desired field to one of the structs such as `ServiceSettings` and setting its default value in the corresponding `SetDefaults` method.

Note that some of the configuration values are collected as telemetries. The telemetry definitions are defined in the `services/telemetry` package. Once a configuration is added, it should be added to the telemetry package. If the configuration value is not going to be collected as a telemetry, a `// telemetry: none` comment must be added to prevent the {{< newtabref href="https://github.com/mattermost/mattermost-govet#included-analyzers" title="configtelemetry" >}} check from failing.

Also we use struct tags to identify access level for configuration values. If the value requires a restriction, please use this tag accordingly.

### Expose settings in the System Console

To expose the newly-added field in the System Console, you need to add that same setting to the `AdminDefinition` JS object in `webapp/channels/src/components/admin_console/admin_definition.jsx`. This object defines most of the settings in the System Console.


### Make settings available for non-admin users

To make the newly added setting accessible to non-admin users in the apps, you'll need to add it to the `GenerateClientConfig` method in `config/client.go` in the server. Note that this always encodes the setting as a string, so anywhere that you would want to use this value in the client, you have to look for a string.
