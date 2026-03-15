---
title: "Customize Mattermost"
heading: "Customize Mattermost"
description: "Learn more about customizing Mattermost to create a more personalized experience depending on the needs of your deployment."
weight: 50
aliases:
  - /extend/customization/
  - /integrate/other-integrations/customization/
---

Mattermost allows for a variety of customization options and modifications, making it possible to create a more adequate experience depending on the needs of each deployment.

There are a few limitations regarding {{< newtabref href="https://mattermost.com/trademark-standards-of-use/" title="how the re-branding of Mattermost" >}} must be handled, such as the fact that changes to the Enterprise Edition's source code isn't supported. However these limitations can be overcome with the utilization of [Plugins]({{< ref "/integrate/plugins" >}}).

# Customizable components

## Server (Team Edition only)

The {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/server" title="Mattermost server" >}}'s source code, written in Golang, may be customized to deliver additional functionalities or to meet specific security requirements.

It's recommended that you attempt to meet such customizations by leveraging the [Plugin framework]({{< ref "/integrate/plugins" >}}) in order to avoid creating any breaking changes, however details on how to build a custom server may be found [here]({{< ref "/integrate/customization/customization/server-build" >}}).

## Server files

Some parts of server-side customizations don't require changes to the source code. View more details on which server files may be customized in [here]({{< ref "/integrate/customization/customization/server-files" >}}).

{{<note "Note:">}}
Modifications to server files can be utilized in both Team Edition and Enterprise Editions.
{{</note>}}

## Web app

Mattermost's web application runs on React, and {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/webapp" title="its codebase" >}} has been open-sourced (regardless of which edition your server uses). You can view details on how to customize the web app in [here]({{< ref "/integrate/customization/customization/webapp" >}}). Keep in mind, however, that some changes to the web app can also leverage the [Plugin]({{< ref "/integrate/plugins/components/webapp" >}}) framework, which can help reduce the necessity of rebasing your custom client to each Mattermost release.
