---
title: "Web app plugin SDK reference"
sidebar_position: 10
---

Visit the [Plugins](/developers/integrate/plugins) section to learn more about [developing Mattermost plugins](/developers/integrate/plugins/developer-setup) and our recommended [developer workflow](/developers/integrate/plugins/developer-workflow) for Mattermost plugins.

## Table of contents

- [PluginClass](#pluginclass)
  * [Example](#example)
- [Registry](#registry)
- [Theme](#theme)
- [Exported Libraries and Functions](#exported-libraries-and-functions)
    + [post-utils](#post-utils)
      - [`formatText(text, options)`](#formattexttext-options)
      - [`messageHtmlToComponent(html, isRHS, options)`](#messagehtmltocomponenthtml-isrhs-options)
      - [Usage Example](#usage-example)
- [window.WebappUtils](#windowwebapputils)
    + [window.WebappUtils.components](#windowwebapputilscomponents)
    + [window.WebappUtils.modals — published modal IDs](#windowwebapputilsmodals--published-modal-ids)

## PluginClass

The PluginClass interface defines two methods used by the Mattermost Web App to `initialize` and `uninitialize` your plugin:

```javascript
class PluginClass {
    /**
    * initialize is called by the webapp when the plugin is first loaded.
    * Receives the following:
    * - registry - an instance of the registry tied to your plugin id
    * - store - the Redux store of the web app.
    */
    initialize(registry, store)

    /**
    * uninitialize is called by the webapp if your plugin is uninstalled
    */
    uninitialize()
}
```

<a id="registerPlugin"></a>

Your plugin should implement this class and register it using the global `registerPlugin` method defined on the window by the webapp:

```javascript
window.registerPlugin('myplugin', new PluginClass());
```

Use the provided [registry](#registry) to register components, post type overrides and callbacks. Use the store to access the global state of the web app, but note that you should use the registry to register any custom reducers your plugin might require.

### Example

The entry point `index.js` of your application might contain:

```javascript
import UserPopularity from './components/profile_popover/user_popularity';
import SomePost from './components/some_post';
import MenuIcon from './components/menu_icon';
import {openExampleModal} from './actions';

class PluginClass {
    initialize(registry, store) {
        registry.registerPopoverUserAttributesComponent(
            UserPopularity,
        );
        registry.registerPostTypeComponent(
            'custom_somepost',
            SomePost,
        );
        registry.registerMainMenuAction(
            'Plugin Menu Item',
            () => store.dispatch(openExampleModal()),
            mobile_icon: MenuIcon,
        );
    }

    uninitialize() {
        // No clean up required.
    }
}

window.registerPlugin('myplugin', new PluginClass());
```

This will add a custom `UserPopularity` component to the profile popover, render a custom `SomePost` component for any post with the type `custom_somepost`, and insert a custom main menu item.

## Registry

An instance of the plugin registry is passed to each plugin via the `initialize` callback.


<PluginJsDocs />

### registerSidebarBrowseOrAddChannelMenuAction — placement

From Mattermost [NOT PRESENT — REQUIRES HUMAN JUDGMENT], `registerSidebarBrowseOrAddChannelMenuAction` accepts an optional `placement` field on the action object.

| Value | Behaviour |
|---|---|
| `'afterCreateChannel'` | Places the item immediately below "Create new channel" in the sidebar "+" menu. |
| `'default'` (or omitted) | Places the item after all built-in items, as before. |

```javascript
registry.registerSidebarBrowseOrAddChannelMenuAction({
    text: 'Create new board',
    icon: BoardIcon,
    action: (teamId) => { /* … */ },
    placement: 'afterCreateChannel',
});
```

### registerChannelTypeOption — showInNewChannelModal

From Mattermost [NOT PRESENT — REQUIRES HUMAN JUDGMENT], `registerChannelTypeOption` accepts a `showInNewChannelModal` boolean. Set it to `false` to keep the option out of the standard "Create a new channel" modal. The option is still available when the `new_channel_modal` published modal is opened with `channelTypePluginId` set to your plugin's ID (see [new_channel_modal](#new_channel_modal) below).

```javascript
registry.registerChannelTypeOption({
    id: 'public-board',
    pluginId: 'com.example.boards',
    label: 'Public board',
    description: 'A board visible to all members.',
    icon: BoardIcon,
    isAvailable: (state) => true,
    onCreate: async ({type, displayName, purpose, teamId}) => { /* … */ },
    createButtonText: 'Create board',
    showInNewChannelModal: false,
});
```

### Theme

In Mattermost, users are able to set custom themes that change the color scheme of the UI. It's important that plugins have access to a user's theme so that they can set their styling to match and not look out of place.

Every pluggable component in the web app will have the theme object as a prop.

The colors are exposed via CSS variables as well.

The theme object has the following properties:

| Property                | CSS Variable                 | Description                                                                         |
|-------------------------|------------------------------|-------------------------------------------------------------------------------------|
| sidebarBg               | --sidebar-bg                 | Background color of the left-hand sidebar                                           |
| sidebarText             | --sidebar-text               | Color of text in the left-hand sidebar                                              |
| sidebarUnreadText       | --sidebar-unread-text        | Color of text for unread channels in the left-hand sidebar                          |
| sidebarTextHoverBg      | --sidebar-text-hover-bg      | Background color of channels when hovered in the left-hand sidebar                  |
| sidebarTextActiveBorder | --sidebar-text-active-border | Color of the selected indicator channel indicator in the left-hand siebar           |
| sidebarTextActiveColor  | --sidebar-text-active-color  | Color of the text for the selected channel in the left-hand sidebar                 |
| sidebarHeaderBg         | --sidebar-header-bg          | Background color of the left-hand sidebar header                                    |
| sidebarHeaderTextColor  | --sidebar-header-text-color  | Color of text in the left-hand sidebar header                                       |
| onlineIndicator         | --online-indicator           | Color of the online status indicator                                                |
| awayIndicator           | --away-indicator             | Color of the away status indicator                                                  |
| dndIndicator            | --dnd-indicator              | Color of the do not disturb status indicator                                        |
| mentionBg               | --mention-bg                 | Background color for mention jewels in the left-hand sidebar                        |
| mentionColor            | --mention-color              | Color of text for mention jewels in the left-hand sidebar                           |
| centerChannelBg         | --center-channel-bg          | Background color of channels, right-hand sidebar and modals/popovers                |
| centerChannelColor      | --center-channel-color       | Color of text in channels, right-hand sidebar and modals/popovers                   |
| newMessageSeparator     | --new-message-separator      | Color of the new message separator in channels                                      |
| linkColor               | --link-color                 | Color of text for links                                                             |
| buttonBg                | --button-bg                  | Background color of buttons                                                         |
| buttonColor             | --button-color               | Color of text for buttons                                                           |
| errorTextColor          | --error-text                 | Color of text for errors                                                            |
| mentionHighlightBg      | --mention-highlight-bg       | Background color of mention highlights in posts                                     |
| mentionHighlightLink    | --mention-highlight-link     | Color of text for mention links in posts                                            |
| codeTheme               | NA                           | Code block theme, either 'github', 'monokai', 'solarized-dark' or 'solarized-light' |

## Exported libraries and functions

The web app exposes a number of [exported libraries and functions](https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/plugins/export.js) on the `window` object for plugins to use. To avoid bloating your plugin, we recommend depending on these using [Webpack externals](https://webpack.js.org/configuration/externals/) or importing them manually from the window. Below is a list of the exposed libraries and functions:

| Library         | Exported Name         | Description                                                        |
|-----------------|-----------------------|--------------------------------------------------------------------|
| react           | window.React          | [ReactJS](https://react.dev/)                                    |
| react-dom       | window.ReactDOM       | [ReactDOM](https://react.dev/docs/react-dom.html)                |
| redux           | window.Redux          | [Redux](https://redux.js.org/)                                     |
| react-redux     | window.ReactRedux     | [React bindings for Redux](https://github.com/reactjs/react-redux) |
| react-bootstrap | window.ReactBootstrap | [Bootstrap for React](https://react-bootstrap.github.io/)          |
| prop-types      | window.PropTypes      | [PropTypes](https://www.npmjs.com/package/prop-types)              |
| post-utils      | window.PostUtils      | Mattermost post utility functions (see below)                      |


<Note title="Note">
Some sets of functions like "Functions exposed on window for plugin to use" and "Components exposed on window for internal plugin use only" are not listed here. You can refer to [export.js](https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/plugins/export.js) file which contains all the exports.
</Note>



#### post-utils

Contains the following post utility functions:

##### `formatText(text, options)`
Performs formatting of text including Markdown, highlighting mentions and search terms and converting URLs, hashtags, @mentions and ~channels to links by taking a string and returning a string of formatted HTML.

* `text` - String of text to format, e.g. a post's message.
* `options` - (Optional) An object containing the following formatting options
* `searchTerm` - If specified, this word is highlighted in the resulting HTML. Defaults to nothing.
* `mentionHighlight` - Specifies whether or not to highlight mentions of the current user. Defaults to true.
* `mentionKeys` - A list of mention keys for the current user to highlight.
* `singleline` - Specifies whether or not to remove newlines. Defaults to false.
* `emoticons` - Enables emoticon parsing with a data-emoticon attribute. Defaults to true.
* `markdown` - Enables markdown parsing. Defaults to true.
* `siteURL` - The origin of this Mattermost instance. If provided, links to channels and posts will be replaced with internal links that can be handled by a special click handler.
* `atMentions` - Whether or not to render "@" mentions into spans with a data-mention attribute. Defaults to false.
* `channelNamesMap` - An object mapping channel display names to channels. If `channelNamesMap` and `team` are provided, ~channel mentions will be replaced with links to the relevant channel.
* `team` - The current team object.
* `proxyImages` - If specified, images are proxied. Defaults to false.

##### `messageHtmlToComponent(html, isRHS, options)`
Converts HTML to React components.

* `html` - String of HTML to convert to React components.
* `isRHS` - Boolean indicating if the resulting components are to be displayed in the right-hand sidebar. Has some minor effects on how UI events are triggered for components in the RHS.
* `options` - (Optional) An object containing options
* `mentions` - If set, mentions are replaced with the AtMention component. Defaults to true.
* `emoji` - If set, emoji text is replaced with the PostEmoji component. Defaults to true.
* `images` - If set, markdown images are replaced with the PostMarkdown component. Defaults to true.
* `latex` - If set, latex is replaced with the LatexBlock component. Defaults to true.

##### Usage example

A short usage example of a `PostType` component using the post utility functions to format text.

```jsx
import React from 'react'; // accessed through webpack externals
import PropTypes from 'prop-types';

const PostUtils = window.PostUtils; // must be accessed through `window`

export default class PostTypeFormatted extends React.PureComponent {

    // ...

    render() {
        const post = this.props.post;

        const formattedText = PostUtils.formatText(post.message); // format the text

        return (
            <div>
                {'Formatted text: '}
                {PostUtils.messageHtmlToComponent(formattedText)} // convert the html to components
            </div>
        );
    }
}
```

## window.WebappUtils

`window.WebappUtils` exposes stable, versioned namespaces for plugin use. Do not access other properties of this object — only the documented namespaces below are part of the public contract.

### window.WebappUtils.components

From Mattermost [NOT PRESENT — REQUIRES HUMAN JUDGMENT], `window.WebappUtils.components` exposes a curated set of core React components that plugins can render directly, so their UI matches core without bundling duplicate implementations.

| Member | Description |
|---|---|
| `WithTooltip` | Wraps a child element and shows a core-styled tooltip on hover. Accepts a `title` prop (string or React node). |

```jsx
const {WithTooltip} = window.WebappUtils.components;

function MyPluginButton() {
    return (
        <WithTooltip title="Open board">
            <button>{'Board'}</button>
        </WithTooltip>
    );
}
```

### window.WebappUtils.modals — published modal IDs

From Mattermost [NOT PRESENT — REQUIRES HUMAN JUDGMENT], two additional modal IDs are available for use with `window.WebappUtils.modals.openModal`.

#### new_channel_modal

Opens the "Create a new channel" modal. When opened with `channelTypePluginId`, the modal shows only the channel types that plugin registered (hiding Public and Private Channel) and pre-selects the first available option. This lets a plugin present its own channel-creation flow (for example, "Create a new board") inside the standard modal shell.

Props accepted alongside `channelTypePluginId`:

| Prop | Type | Description |
|---|---|---|
| `channelTypePluginId` | `string` | Filters the modal to this plugin's registered channel types only. |
| `modalHeaderText` | `string` | Replaces the default "Create a new channel" heading. |
| `nameLabel` | `string` | Replaces the default "Channel name" field label. |
| `namePlaceholder` | `string` | Replaces the default name field placeholder. |
| `purposeLabel` | `string` | Replaces the default "Channel Purpose" label. |
| `purposeHelpText` | `string` | Replaces the default purpose help text. |
| `categoryHelpText` | `string` | Replaces the default category selector help text. |

All props are optional. Omitting `channelTypePluginId` opens the standard modal with all built-in and plugin options.

```javascript
window.WebappUtils.modals.openModal('new_channel_modal', {
    channelTypePluginId: 'com.example.boards',
    modalHeaderText: 'Create a new board',
    nameLabel: 'Board name',
    namePlaceholder: 'Enter a name for your new board',
    purposeLabel: 'Board description',
    purposeHelpText: 'This will be displayed when browsing for boards and channels.',
});
```

#### channel_settings

Opens the Channel Settings modal for a given channel, pinned open like `team_settings`. Accepts `channelId` and an optional `initialTab`.

| Prop | Type | Description |
|---|---|---|
| `channelId` | `string` | The channel to open settings for. |
| `initialTab` | `string` | A built-in tab ID (`'info'`, `'configuration'`, …) or the ID returned by `registerChannelSettingsTab` for a plugin tab. If the tab is not shown for the channel, the modal falls back to the first available tab. |

```javascript
window.WebappUtils.modals.openModal('channel_settings', {
    channelId: currentChannelId,
    initialTab: myPluginTabId, // id returned by registry.registerChannelSettingsTab(…)
});
```
