---
title: "Get started"
sidebar_position: 10
---
Mattermost offers a wealth of methods to add functionality and customize the experience to suit your needs, whether you want to add new user capabilities with slash commands, build an advanced chatbot, or completely change the functionality of your server.

## Webhooks

Webhooks provide a simple way to post messages to a channel and trigger external actions.

[Create your Webhook now](/developers/integrate/webhooks)

## Slash commands

Slash commands are messages that begin with `/` and trigger an HTTP request to a web service that can in turn post one or more messages in response.

[Create your Slash command now](/developers/integrate/slash-commands)

## Plugins

Plugins are the most comprehensive way to add new features and customization, but come with additional development overhead and must be written in Go. They’re for developers who need tightly integrated services or want to improve the server, mobile, desktop, and web apps without making contributions to the core codebase.

[Get started with plugins](/developers/integrate/plugins)


<Note title="Tip">
See the [Mattermost Server SDK Reference](/developers/integrate/reference/server/server-reference) and [Mattermost Client UI SDK Reference](/developers/integrate/reference/webapp/webapp-reference) documentation for details on available server API endpoints and client methods.
</Note>


## API

Interact with users, channels, and everything else that happens on your Mattermost server via a modern REST API that meets the OpenAPI specification. The API is for developers who want to build bots and other interactions that don’t rely on customizing the Mattermost user experience.

[View the REST API Reference](https://api.mattermost.com)<br/>

## Other ways to integrate and extend

* Embed - Learn how to use the Mattermost API to [embed Mattermost](/developers/integrate/customization/embedding) into web browsers and web applications.
* Customize - Modify the source code for the server or web app to make basic [changes and customization](/developers/integrate/customization/customization).
* Interactive Messages - Create messages that include [interactive functionality](https://docs.mattermost.com/developer/interactive-messages.html).
