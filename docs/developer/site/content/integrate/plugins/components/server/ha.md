---
title: High availability
heading: "High availability"
description: "All Mattermost plugins should consider high availability (HA) environments. Learn more about our standards for working with HA mode servers."
date: 2018-07-10T00:00:00-05:00
weight: 60
aliases: 
  - /extend/plugins/server/ha/
  - /integrate/plugins/server/ha/
---

Mattermost Enterprise Edition servers with an E20 license have the ability to run in {{< newtabref href="https://docs.mattermost.com/deployment/cluster.html" title="High Availability (HA)" >}} mode, meaning a cluster of Mattermost app servers running together as a single Mattermost deployment.

It is important that all plugins consider HA environments when being built.

Plugins are started as subprocesses of the main Mattermost process on each app server. This means a Mattermost deployment that has three app servers will have three separate copies of the same plugin running. Each running copy of the plugin will be isolated from one another on different servers. Therefore, to run properly in HA the plugin's server-side code must be stateless.

To be stateless, the plugin must not retain any information or status in memory that may be needed across multiple events (e.g. HTTP requests or in other hooks). This data should instead be stored in a place that all running copies of the plugin have access to. For example, the [key-value store]({{< ref "/integrate/reference/server/server-reference#API.KVSet" >}}) the plugin API provides.

To better explain the problem with having a plugin store data in-memory, consider this case:

Let's say we have two Mattermost app servers running together in HA and an installed plugin with a feature that alerts a user any time a trigger word is posted in a channel.

1. The user uses the web app side of the plugin to set the word `hello` as the trigger word
2. An HTTP request is made to the server-side of the plugin to set `hello`
3. The plugin process running on app server 1 handles the request and stores `hello` in a variable

In this scenario, the trigger word is now only set for the plugin process running on app server 1. The plugin process running on app server 2 is unaware that the trigger word is `hello`. This means when someone posts a message containing `hello` and the request is load balanced to app server 2, the plugin is not going to alert our user when it should.

The proper way to deal with this case would be for the plugin to store the trigger word in a global store, such as the KV store. Then any time a user posts the plugin can pull the trigger word from the store and properly alert the user, regardless of which app server handles the request.

## Run a scheduled job in high availability mode

Using the {{< newtabref href="https://github.com/mattermost/mattermost/blob/d2c3710265c293281c2b445d4f72f27871c2e127/server/public/pluginapi/cluster/job.go#L115-L116" title="mattermost/public/pluginapi/cluster" >}} package, we can schedule jobs to perform background activity at regular intervals, without having to explicitly coordinate with other instances of the same plugin. Here's an example from the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo/blob/d647f1ed7fdc384f5bc163a6bba689ab4293704e/server/activate_hooks.go#L72" title="Demo Plugin" >}}:

```go
job, cronErr := cluster.Schedule(
    p.API,
    "BackgroundJob",
    cluster.MakeWaitForRoundedInterval(15*time.Minute),
    p.BackgroundJobFunc,
)
if cronErr != nil {
    return errors.Wrap(cronErr, "failed to schedule background job")
}

p.backgroundJob = job
```
