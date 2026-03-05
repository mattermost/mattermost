---
title: "Slash commands"
heading: "Slash commands at Mattermost"
description: "Slash commands trigger an HTTP request to a web service that can in turn post one or more messages in response."
date: "2017-08-19T12:01:23-04:00"
weight: 30
aliases:
  - /integrate/other-integrations/slash-commands/
  - /integrate/slash-commands/using-slash-commands/
subsection: slash commands
cascade:
  - subsection: slash commands
---

Slash commands are messages that begin with `/` and trigger an HTTP request to a web service that can in turn post one or more messages in response.

Slash commands have an additional feature, **autocomplete**, that displays a list of possible commands based on what has been typed in the message box. Typing `/` in an empty message box will display a list of all slash commands. As the slash command is typed in the message box, autocomplete will also display possible arguments and flags for the command.

Unlike [outgoing webhooks]({{< ref "/integrate/webhooks/outgoing" >}}), slash commands work in private channels and direct messages in addition to public channels, and can be configured to auto-complete when typing.
Mattermost includes a number of [built-in slash commands](https://docs.mattermost.com/channels/interact-with-channels.html). You can also create [custom slash commands]({{< ref "custom" >}}).

## Tips and best practices

1. Slash commands are designed to easily allow you to post messages. For other actions such as channel creation, you must also use the {{< newtabref title="Mattermost APIs" href="https://api.mattermost.com" >}}.
2. Posts size is limited to 16383 characters for servers running {{< newtabref href="https://docs.mattermost.com/administration/important-upgrade-notes.html" title="Mattermost Server v5.0 or later" >}}. Use the `extra_responses` field to reply to a triggered slash command with more than one post.
3. You can restrict who can create slash commands in {{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-custom-slash-commands" title="System Console > Integrations > Integration Management" >}}.
4. Mattermost [outgoing webhooks]({{< ref "/integrate/webhooks/outgoing" >}}) are Slack-compatible. You can copy-and-paste code used for a Slack outgoing webhook to create Mattermost integrations. Mattermost [automatically translates Slack's proprietary JSON payload format]({{< ref "slack#translate-slacks-data-format-to-mattermost" >}}).
5. The external application may be written in any programming language. It needs to provide a URL which receives the request sent by your Mattermost Server and responds with in the required JSON format.

## FAQ

### How do I debug slash commands?

To debug slash commands in **System Console > Logs**, set **System Console > Logging > Enable Webhook Debugging** to **true** and set **System Console > Logging > Console Log Level** to **DEBUG**.

### How do I send multiple responses from a slash command?

You can send multiple responses with an `extra_responses` parameter as follows.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 696

{
    "response_type": "in_channel",
    "text": "\n#### Test results for July 27th, 2017\n@channel here are the requested test results.\n\n| Component  | Tests Run   | Tests Failed                                   |\n| ---------- | ----------- | ---------------------------------------------- |\n| Server     | 948         | :white_check_mark: 0                           |\n| Web Client | 123         | :warning: 2 [(see details)](http://linktologs) |\n| iOS Client | 78          | :warning: 3 [(see details)](http://linktologs) |\n\t\t      ",
    "username": "test-automation",
    "icon_url": "https://www.mattermost.org/wp-content/uploads/2016/04/icon.png",
    "props": {
        "test_data": {
            "ios": 78,
            "server": 948,
            "web": 123
        }
    },
    "extra_responses": [
       {
         "text": "message 2",
         "username": "test-automation"
       },
       {
         "text": "message 3",
         "username": "test-automation"
       }
     ]
}
```

### What if my slash command takes time to build a response?

Reply immediately with an `ephemeral` message to confirm response of the command, and then use the `response_url` to send up to five additional messages within a 30-minute time period from the original command invocation.

### Why does my slash command fail to connect to `localhost`?

By default, Mattermost prohibits outgoing connections that resolve to certain common IP ranges, including the loopback (`127.0.0.0/8`) and various private-use subnets.

During development, you may override this behaviour by setting `ServiceSettings.AllowedUntrustedInternalConnections` to `"127.0.0.0/8"` in your `config.json` or via **System Console > Advanced > Developer**. See the {{< newtabref href="https://docs.mattermost.com/configure/environment-configuration-settings.html#allow-untrusted-internal-connections" title="configuration settings documentation" >}} for more details.

### Should I configure my slash command to use `POST` or `GET`?

Best practice suggests using `GET` only if a request is considered idempotent. This means that the request can be repeated safely and can be expected to return the same response for a given input. Some servers hosting your slash command may also impose a limit to the amount of data passed through the query string of a `GET` request.

Ultimately, however, the choice is yours. If in doubt, configure your slash command to use a `POST` request.

{{<note "Mattermost releases prior to 5.0.0">}}
Note that slash commands configured to use a <code>GET</code> request were broken prior to Mattermost release 5.0.0. The payload was incorrectly encoded in the body of the <code>GET</code> request instead of in the query string. While it was still technically possible to extract the payload, this was non-standard and broke some development stacks.
{{</note>}}

### Why does my slash command always fail with `returned an empty response`?

If you are emitting the `Content-Type: application/json` header, your body must be valid JSON. Any JSON decoding failure will result in this error message.

Also, you must provide a `response_type`. Mattermost does not assume a default if this field is missing.

### Why does my slash command print the JSON data instead of formatting it?

Ensure you are emitting the `Content-Type: application/json` header, otherwise your body will be treated as plain text and posted as such.

### Are slash commands Slack-compatible?

See the [Slack compatibility]({{< ref "slack" >}}) page.

### How do I use Bot Accounts to reply to slash commands?

#### If you are developing an integration
- Set up a [Personal Access Token]({{< ref "/integrate/reference/personal-access-token" >}}) for the Bot Account you want to reply with.
- Use the {{< newtabref title="REST API" href="https://api.mattermost.com/#tag/posts/operation/CreatePost" >}} to create a post with the Access Token.

#### If you are developing a plugin

Use [`CreatePost`]({{< ref "/integrate/reference/server/server-reference#API.CreatePost" >}}) plugin API. Make sure to set the  `UserId` of the post to the `UserId` of the Bot Account. If you want to create an ephemeral post, use [`SendEphemeralPost`]({{< ref "/integrate/reference/server/server-reference#API.SendEphemeralPost" >}}) plugin API instead.

## Troubleshoot slash commands

Join the {{< newtabref href="https://mattermost.com/pl/default-ask-mattermost-community" title="Mattermost user community" >}} for help troubleshooting your slash command.

## Share your integration

If you've built an integration for Mattermost, please consider [sharing your work]({{< ref "/integrate/getting-started" >}}) in our {{< newtabref href="https://mattermost.com/marketplace/" title="Marketplace" >}}.

The {{< newtabref href="https://mattermost.com/marketplace/" title="Marketplace" >}} lists open source integrations developed by the Mattermost community and are available for download, customization, and deployment to your private cloud or self-hosted infrastructure.
