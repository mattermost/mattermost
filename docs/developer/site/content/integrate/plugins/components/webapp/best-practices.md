---
title: Best practices
heading: "Best practices for web app plugins"
description: "Thinking about adding a plugin to Mattermost? Check out these design best practices."
weight: 0
aliases:
  - /extend/plugins/webapp/best-practices/
  - /integrate/plugins/webapp/best-practices/
---

## Design best practices

### Actions that apply to specific Channels
- Recommendation: Have your plugin register the actions to [the channel header]({{< ref "/integrate/reference/webapp/webapp-reference#registerChannelHeaderButtonAction" >}}). This makes it quickly accessible for users and the actions apply on the channel they're viewing.
- Example: Zoom meeting posts to a channel

  ![Custom Channel Header Button](/img/extend/bp-channel-header.png)

You can additionally [register a slash command]({{< ref "/integrate/reference/server/server-reference#API.RegisterCommand" >}}) on the server-side to take channel-specific actions.
- Example: Jira project actions

  ![Slash Command](/img/extend/bp-slash-command.gif)

### Actions that apply to specific messages
- Recommendation: Have your plugin register a [post dropdown menu component]({{< ref "/integrate/reference/webapp/webapp-reference#registerPostDropdownMenuComponent" >}}) with some text, icon and an action function. This adds your action to the "More Actions" post menu dropdown for easy discovery.
- Examples: Create or attach to Jira issue from a message; copy a message to another channel; report an inappropriate message
- Sample code: [mattermost/mattermost-plugin-todo/webapp/src/index.js](https://github.com/mattermost/mattermost-plugin-todo/blob/0c4dbfb58a72f8392ea66e101996afd06fdb2913/webapp/src/index.js#L30-L37)

  ![Post Dropdown Menu](/img/extend/bp-post-dropdown-menu.png)

### Actions related to files or images
- Recommendation: Have your plugin register a [file upload method]({{< ref "/integrate/reference/webapp/webapp-reference#registerFileUploadMethod" >}}) with some text, icon and an action function. This adds your new action to the file upload menu.
- Examples: File sharing from OneDrive or GDrive; Draw plugin for sketches

  ![File Upload Action](/img/extend/bp-file-upload.png)

### Actions that apply to specific teams
- Recommendation: Have your plugin register [left sidebar header component]({{< ref "/integrate/reference/webapp/webapp-reference#registerLeftSidebarHeaderComponent" >}}) with some text, icon and an action function. This adds your action above your team's channels in the sidebar.
- Examples: Trello kanban board plugin, GitHub Plugin

  ![left sidebar header](/img/extend/bp-left-sidebar-header.png)

### Quick links or status summaries of workflows
- Recommendation: Have your plugin register a [bottom team sidebar component]({{< ref "/integrate/reference/webapp/webapp-reference#registerBottomTeamSidebarComponent" >}}). This adds icons to the lower left corner of the UI.
- Examples: GitHub sidebar links with summary of outstanding reviews or unread messages; ServiceNow incident status summary

  ![bottom team sidebar](/img/extend/bp-bottom-team-sidebar.png)

### Global actions that can be taken anywhere in the server and not directly related to teams, channels or users
- Recommendation: Have your plugin register [main menu action]({{< ref "/integrate/reference/webapp/webapp-reference#registerMainMenuAction" >}}) with some text, icon for mobile, and an action function. This adds your action to the Main Menu. You can additionally [register a slash command]({{< ref "/integrate/reference/server/server-reference#API.RegisterCommand" >}}) on the server-side.
- Examples: Share feedback plugin in Main Menu; /jira slash commands for quick actions

  ![main menu action](/img/extend/bp-main-menu-action.png)

### Actions that apply to specific users
- Recommendation: Have your plugin register a [popover user actions component]({{< ref "/integrate/reference/webapp/webapp-reference#registerPopoverUserActionsComponent" >}}). This adds your action button to the user profile popover.
- Examples: Report User plugin; Display extra information about the user from an LDAP server

  ![popover user actions component](/img/extend/bp-user-popover.png)

### Extra information on a user profile
- Recommendation: Have your plugin register a [popover user attribute component]({{< ref "/integrate/reference/webapp/webapp-reference#registerPopoverUserAttributesComponent" >}}). This adds your custom attributes to the user profile popover.
- Examples: Custom User Attributes plugin

  ![popover user attribute component](/img/extend/bp-user-attributes.png)

### Actions related to emoji and GIFs
- Recommendation: Have your plugin add a component to the emoji picker. This is not yet supported, but some {{< newtabref href="https://github.com/mattermost/mattermost/issues/10412#issuecomment-481776595" title="work had previously started" >}} with the issue currently opened as Help Wanted.
- Examples: Bitmoji plugin; GIFs via Giphy or Gfycat

## Set up the plugin to properly communicate with the Mattermost Server

### Use the Mattermost Server's `SiteURL` in your web app plugin

In order to make sure your plugin has full compatibility with your Mattermost server, you should use the server's configured SiteURL in each API call you send to the server from the webapp. Here's an {{< newtabref href="https://github.com/mattermost/mattermost-plugin-jira/blob/19a9c2442817132b4eee5c77e259b80a40188a6a/webapp/src/selectors/index.js#L13-L26" title="example" >}} of how to compute the SiteURL:

```js
export const getPluginServerRoute = (state) => {
    const config = getConfig(state);

    let basePath = '';
    if (config && config.SiteURL) {
        basePath = new URL(config.SiteURL).pathname;

        if (basePath && basePath[basePath.length - 1] === '/') {
            basePath = basePath.substr(0, basePath.length - 1);
        }
    }

    return basePath + '/plugins/' + PluginId;
};
```

### Include the server's CSRF token in your web app plugin's requests

The Mattermost server can be configured to require a CSRF token to be present in HTTP requests sent from the webapp. In order to include the token in each request, you can use the `mattermost-redux` library's `Client4.getOptions` function to add the token to your `fetch` request. Here's an {{< newtabref href="https://github.com/mattermost/mattermost-plugin-jira/blob/19a9c2442817132b4eee5c77e259b80a40188a6a/webapp/src/client/index.js#L14" title="example" >}} of how to include the CSRF token.

```js
const response = await fetch(url, Client4.getOptions(options));
```
