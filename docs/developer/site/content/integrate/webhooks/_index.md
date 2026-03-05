---
title: Webhooks
description: Webhooks
weight: 20
aliases:
  - /integrate/webhooks/golang-webhook/
subsection: webhooks
cascade:
  - subsection: webhooks
---

Mattermost supports webhooks to easily integrate external applications into the server.

### Incoming webhooks

Use incoming webhooks to post messages to Mattermost public channels, private channels, and direct messages. Messages are sent via an HTTP POST request to a Mattermost URL generated for each application and contain a specifically formatted JSON payload in the request body.

[Create an incoming webhook]({{< ref "/integrate/webhooks/incoming" >}})

### Outgoing webhooks

Outgoing webhooks will send an HTTP POST request to a web service and process a response back to Mattermost when a message matches one or both of the following conditions:

- It's posted in a specified channel.
- The first word matches or starts with one of the defined trigger words, such as `gif`.

Outgoing webhooks are supported in public channels only. If you need a trigger that works in a private channel or a direct message, consider using a [slash command]({{< ref "/integrate/slash-commands" >}}) instead.

{{<note "Note:">}}
To prevent malicious users from trying to perform {{< newtabref href="https://en.wikipedia.org/wiki/Phishing" title="phishing attacks" >}} a **BOT** indicator appears next to posts coming from webhooks regardless of what username is specified.
{{</note>}}

[Create an outgoing webhook]({{< ref "/integrate/webhooks/outgoing" >}})
