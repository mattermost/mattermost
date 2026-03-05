---
title: Web app plugin SDK reference
heading: "Mattermost web app plugin SDK reference"
description: "Learn how to implement the PluginClass interface used by the Mattermost web app to initialize and uninitialize your plugin."
date: 2018-07-10T00:00:00-05:00
weight: 10
aliases:
  - /extend/plugins/webapp/reference/
  - /integrate/plugins/components/webapp/reference/
---

Visit the [Plugins]({{< ref "/integrate/plugins" >}}) section to learn more about [developing Mattermost plugins]({{< ref "/integrate/plugins/developer-setup" >}}) and our recommended [developer workflow]({{< ref "/integrate/plugins/developer-workflow" >}}) for Mattermost plugins.

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

{{<pluginjsdocs>}}

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

The web app exposes a number of {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/plugins/export.js" title="exported libraries and functions" >}} on the `window` object for plugins to use. To avoid bloating your plugin, we recommend depending on these using {{< newtabref href="https://webpack.js.org/configuration/externals/" title="Webpack externals" >}} or importing them manually from the window. Below is a list of the exposed libraries and functions:

| Library         | Exported Name         | Description                                                        |
|-----------------|-----------------------|--------------------------------------------------------------------|
| react           | window.React          | {{< newtabref href="https://react.dev/" title="ReactJS" >}}                                    |
| react-dom       | window.ReactDOM       | {{< newtabref href="https://react.dev/docs/react-dom.html" title="ReactDOM" >}}                |
| redux           | window.Redux          | {{< newtabref href="https://redux.js.org/" title="Redux" >}}                                     |
| react-redux     | window.ReactRedux     | {{< newtabref href="https://github.com/reactjs/react-redux" title="React bindings for Redux" >}} |
| react-bootstrap | window.ReactBootstrap | {{< newtabref href="https://react-bootstrap.github.io/" title="Bootstrap for React" >}}          |
| prop-types      | window.PropTypes      | {{< newtabref href="https://www.npmjs.com/package/prop-types" title="PropTypes" >}}              |
| post-utils      | window.PostUtils      | Mattermost post utility functions (see below)                      |

{{<note "Note:">}}
Some sets of functions like "Functions exposed on window for plugin to use" and "Components exposed on window for internal plugin use only" are not listed here. You can refer to {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/plugins/export.js" title="export.js" >}} file which contains all the exports.
{{</note>}}


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
