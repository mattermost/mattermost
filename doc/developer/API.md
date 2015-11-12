# Mattermost APIs

Mattermost APIs let you integrate your favorite tools and services withing your Mattermost experience. 

## Slack-compatible Webhooks

To offer an alternative to propreitary SaaS services, Mattermost focuses on being "Slack-compatible, but not Slack limited". That means providing support for developers of Slack applications to easily extend their apps to Mattermost, as well as support and capabilities beyond what Slack offers. 

### [Incoming Webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md)

Incoming webhooks allow external applications to post messages into Mattermost channels and private groups by sending a JSON payload via HTTP POST request to a secret Mattermost URL generated specifically for each application.

In addition to supporting Slack's incoming webhook formatting, Mattermost webhooks offer full support of industry-standard markdown formatting, including headings, tables and in-line images. 

### [Outgoing Webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Outgoing-Webhooks.md) 

Outgoing webhooks allow external applications to receive webhook events from events happening within Mattermost channels and private groups via JSON payloads via HTTP POST requests sent to incoming webhook URLs defined by your applications. 

Over time, Mattermost outgoing webhooks will support not only Slack applications using a compatible format, but also offer optional events and triggers beyond Slack's feature set. 

## Mattermost Web Service API

Mattermost offers a Web Service API accessible by Mattermost Drivers, listed below. Initial documentation on the [transport layer for the web service is available](API-Web-Service.md) and functional documentation is under development. 

## Mattermost Drivers

Mattermost drivers offer access to the Mattermost web service API in different languages and frameworks.

### [ReactJS Javascript Driver](https://github.com/mattermost/platform/blob/master/web/react/utils/client.jsx)

[client.jsx](https://github.com/mattermost/platform/blob/master/web/react/utils/client.jsx) - This Javascript driver connects with the ReactJS components of Mattermost. The web client does the vast majority of its work by connecting to a RESTful JSON web service. There is a very small amount of processing for error checking and set up that happens on the web server.

### [Golang Driver](https://github.com/mattermost/platform/blob/master/model/client.go)

[client.go](https://github.com/mattermost/platform/blob/master/model/client.go) - This is a RESTful driver connecting with the Golang-based webservice of Mattermost and is used by unit tests. 
