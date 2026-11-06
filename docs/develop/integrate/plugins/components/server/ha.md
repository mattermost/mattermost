---
title: "High availability"
sidebar_position: 60
---

Mattermost Enterprise Edition servers with an E20 license have the ability to run in [High Availability (HA)](https://docs.mattermost.com/deployment/cluster.html) mode, meaning a cluster of Mattermost app servers running together as a single Mattermost deployment.

It is important that all plugins consider HA environments when being built.

Plugins are started as subprocesses of the main Mattermost process on each app server. This means a Mattermost deployment that has three app servers will have three separate copies of the same plugin running. Each running copy of the plugin will be isolated from one another on different servers. Therefore, to run properly in HA the plugin's server-side code must be stateless.

To be stateless, the plugin must not retain any information or status in memory that may be needed across multiple events (e.g. HTTP requests or in other hooks). This data should instead be stored in a place that all running copies of the plugin have access to. For example, the [key-value store](/developers/integrate/reference/server#API.KVSet) the plugin API provides.

To better explain the problem with having a plugin store data in-memory, consider this case:

Let's say we have two Mattermost app servers running together in HA and an installed plugin with a feature that alerts a user any time a trigger word is posted in a channel.

1. The user uses the web app side of the plugin to set the word `hello` as the trigger word
2. An HTTP request is made to the server-side of the plugin to set `hello`
3. The plugin process running on app server 1 handles the request and stores `hello` in a variable

In this scenario, the trigger word is now only set for the plugin process running on app server 1. The plugin process running on app server 2 is unaware that the trigger word is `hello`. This means when someone posts a message containing `hello` and the request is load balanced to app server 2, the plugin is not going to alert our user when it should.

The proper way to deal with this case would be for the plugin to store the trigger word in a global store, such as the KV store. Then any time a user posts the plugin can pull the trigger word from the store and properly alert the user, regardless of which app server handles the request.

## Run a scheduled job in high availability mode

Using the [mattermost/public/pluginapi/cluster](https://github.com/mattermost/mattermost/blob/d2c3710265c293281c2b445d4f72f27871c2e127/server/public/pluginapi/cluster/job.go#L115-L116) package, we can schedule jobs to perform background activity at regular intervals, without having to explicitly coordinate with other instances of the same plugin. Here's an example from the [Demo Plugin](https://github.com/mattermost/mattermost-plugin-demo/blob/d647f1ed7fdc384f5bc163a6bba689ab4293704e/server/activate_hooks.go#L72):

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

## Discover cluster node identity

From Mattermost v12.2, plugins can discover the cluster topology and identify which node sent a cluster event.

**Get the local node ID**

`API.GetClusterNodeID()` returns the cluster ID of the node the plugin is running on. Use this value to tell other nodes where to send targeted cluster events. It returns an empty string until the node has joined the cluster — for example, when clustering is disabled or the node has not yet started.

```go
nodeID := p.API.GetClusterNodeID()
if nodeID == "" {
    // not running in a cluster
}
```

**List connected nodes**

`API.GetClusterNodes()` returns the nodes currently connected to the cluster, including the local node. Every `Id` in the returned list can be passed directly as `PluginClusterEventSendOptions.TargetId`. Nodes that are registered but not yet connected are excluded, because their registration ID cannot be used as a target. The method returns an empty list until this node has joined the cluster, consistent with `GetClusterNodeID()`.

<Note>

`GetClusterNodes()` may query the database on each call. Avoid calling it on hot paths such as per-message hooks.

</Note>

```go
nodes, err := p.API.GetClusterNodes()
if err != nil {
    return err
}
for _, node := range nodes {
    p.API.PublishPluginClusterEvent(
        model.PluginClusterEvent{Id: "sync", Data: payload},
        model.PluginClusterEventSendOptions{
            SendType: model.PluginClusterEventSendTypeReliable,
            TargetId: node.Id,
        },
    )
}
```

**Identify the sender of a cluster event**

`PluginClusterEvent.SourceId` is set by the server to the cluster node ID of the sender before the event is delivered to `OnPluginClusterEvent`. Use it to reply to a specific node or to filter events by origin. Events received from nodes running a server version earlier than 12.2 have an empty `SourceId`.

```go
func (p *Plugin) OnPluginClusterEvent(_ *plugin.Context, ev model.PluginClusterEvent) {
    if ev.SourceId == "" {
        // sender is on an older server version or clustering is not active
        return
    }
    // reply to the sender
    p.API.PublishPluginClusterEvent(
        model.PluginClusterEvent{Id: "ack", Data: []byte("ok")},
        model.PluginClusterEventSendOptions{
            SendType: model.PluginClusterEventSendTypeReliable,
            TargetId: ev.SourceId,
        },
    )
}
```

The `pluginapi` wrappers for these methods are `Cluster.GetNodeID()` and `Cluster.GetNodes()`.

## Test a plugin in high availability mode

The [pluginapi/testhelper](https://github.com/mattermost/mattermost/tree/master/server/public/pluginapi/testhelper) package runs a plugin's integration tests against a real Mattermost server in Docker. `testhelper.SetupCluster(t, n)` starts a cluster of `n` servers instead of a single one, so you can test behavior that spans servers, such as cluster events or state that must not be kept in memory:

```go
func TestTriggerWordAcrossNodes(t *testing.T) {
    th := testhelper.SetupCluster(t, 2)
    a, b := th.Nodes[0], th.Nodes[1]

    // Set the trigger word through a.Client, then post through b.Client
    // and check that the plugin on b alerts the user.
}
```

The servers share one database, which also holds the configuration, and one file store. The plugin is deployed once and runs on every server, and a configuration change made through one server reaches the others. Each test starts from a freshly formed cluster.

Each entry in `th.Nodes` is one server. Use its `AdminClient` and `Client` to call the plugin on that server, and its `ID` as `PluginClusterEventSendOptions.TargetId`. The ID changes whenever the server restarts. To take a server away, `Pause(t)` freezes it, so it looks hung to the rest of the cluster, and `Stop(t)` shuts it down, so it leaves the cluster. `Start(t)` brings it back. See the [package source](https://github.com/mattermost/mattermost/tree/master/server/public/pluginapi/testhelper) for the full API.

Clustering requires a license with the Cluster feature. Set the `MM_LICENSE` environment variable to the license when running the tests. The servers run in the test service environment, so a license signed with Mattermost's test key works. Without `MM_LICENSE`, cluster tests are skipped, so pull requests from forks still pass. A license the server rejects, or one without the Cluster feature, fails the test.

In GitHub Actions, map a repository secret to `MM_LICENSE` in the step that runs the tests:

```yaml
- name: Run tests
  env:
    MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}
  run: make test
```

:::tip
Setting up a cluster takes about 20 to 25 seconds per test, compared with about 5 seconds for a single server, because each test restarts the servers and waits for them to rejoin the cluster. Use `testhelper.Setup(t)` for tests that don't need more than one server.
:::
