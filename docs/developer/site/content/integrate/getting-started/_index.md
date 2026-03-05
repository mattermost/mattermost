---
title: "Get started"
heading: "Integrate and extend Mattermost"
description: "Extend Mattermost with APIs, plugins, webhooks, and more."
weight: 10
aliases: 
  - /integrate/getting-started/how-should-i-integrate/
  - /extend/getting-started/
  - /integrate/other-integrations/
---
Mattermost offers a wealth of methods to add functionality and customize the experience to suit your needs, whether you want to add new user capabilities with slash commands, build an advanced chatbot, or completely change the functionality of your server.

## Webhooks

Webhooks provide a simple way to post messages to a channel and trigger external actions.

[Create your Webhook now]({{< ref "/integrate/webhooks" >}})

## Slash commands

Slash commands are messages that begin with `/` and trigger an HTTP request to a web service that can in turn post one or more messages in response.

[Create your Slash command now]({{< ref "/integrate/slash-commands" >}})

## Plugins

Plugins are the most comprehensive way to add new features and customization, but come with additional development overhead and must be written in Go. They’re for developers who need tightly integrated services or want to improve the server, mobile, desktop, and web apps without making contributions to the core codebase.

[Get started with plugins]({{< ref "/integrate/plugins" >}})

{{<note "Tip:">}}
See the [Mattermost Server SDK Reference]({{< ref "/integrate/reference/server/server-reference" >}}) and [Mattermost Client UI SDK Reference]({{< ref "/integrate/reference/webapp/webapp-reference" >}}) documentation for details on available server API endpoints and client methods.
{{</note>}}

## API

Interact with users, channels, and everything else that happens on your Mattermost server via a modern REST API that meets the OpenAPI specification. The API is for developers who want to build bots and other interactions that don’t rely on customizing the Mattermost user experience.

{{< newtabref href="https://api.mattermost.com" title="View the REST API Reference" >}}<br/>

## Other ways to integrate and extend

* Embed - Learn how to use the Mattermost API to [embed Mattermost]({{< ref "/integrate/customization/embedding" >}}) into web browsers and web applications.
* Customize - Modify the source code for the server or web app to make basic [changes and customization]({{< ref "/integrate/customization/customization" >}}).
* Interactive Messages - Create messages that include {{< newtabref href="https://docs.mattermost.com/developer/interactive-messages.html" title="interactive functionality" >}}.
