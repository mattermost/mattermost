---
title: "Debug Server plugins"
heading: "Debug plugins in the Mattermost Server"
description: "Plugins communicate with the main Mattermost server by RPC. Learn how to debug them."
aliases: 
  - /extend/plugins/server/debugging/
  - /integrate/plugins/server/debugging/
---

Plugins communicate with the main Mattermost Server by {{< newtabref href="https://github.com/hashicorp/go-plugin" title="RPC" >}}. In order to debug them with Delve, a few steps are necessary.
### macOS
1. After starting the main Mattermost application, run `ps aux | grep name.of.your.plugin`. This will print a list of running processes that match that name, as such: `username      78836   0.0  0.1  4397696  12492 s006  S     7:07AM   0:00.03 plugins/name.of.your.plugin/server/dist/plugin-darwin-amd64`.
2. Grab the `pid`, which is the second number after your username in the output above. Run `dlv attach pid`, where `pid` is that number. let the plugin continue executing soon after connecting; Otherwise, the server will detect it as stopped and attempt to restart it.
3. You're done. You should have access to your plugin's code through Delve and be able to set breakpoints, etc.
