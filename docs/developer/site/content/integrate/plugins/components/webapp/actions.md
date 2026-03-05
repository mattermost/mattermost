---
title: Redux actions
heading: "Redux actions for web app plugins"
description: "Mattermost-redux is a library of shared code between Mattermost JavaScript clients. Learn how to use Redux actions with a plugin."
date: 2018-07-10T00:00:00-05:00
weight: 11
aliases:
  - /extend/plugins/webapp/actions/
  - /integrate/plugins/webapp/actions/
---

When building web app plugins, it's common to perform actions or access the state that web and mobile apps already support. The majority of these actions exist in {{< newtabref href="https://github.com/mattermost/mattermost-redux" title="mattermost-redux" >}}, which is our library of shared code between Mattermost JavaScript clients. The `mattermost-redux` library exports types and functions that are imported by the web application. These functions can be imported by plugins and used the same way. There are a few different kinds of functions exported by the library:

* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/actions" title="actions" >}}: Actions perform API requests and can change the state of Mattermost.
* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/client" title="client" >}}: The client package can be used to instantiate a Client4 object to interact with the Mattermost API directly. This is useful in plugins as well as JavaScript server applications communicating with Mattermost.
* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/constants" title="constants" >}}: An assortment of constants within Mattermost's data model.
* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/selectors" title="selectors" >}}: Selectors return certain data from the Redux store, such as getPost which allows you get a post by id.
* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/store" title="store" >}}: Functions related to the Redux store itself.
* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/types" title="types" >}}: Various types of objects in Mattermost's data model. These are useful for plugins written in Typescript.
* {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/utils" title="utils" >}}: Various utility functions shared across the web application.

## Prerequisites

It's assumed you have already set up your plugin development environment for web app plugins to match {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="mattermost-plugin-starter-template" >}}. If not, follow the README instructions of that repository first, or [see the Hello, World! guide]({{< ref "/integrate/plugins/components/webapp/hello-world" >}}).

## Basic example

Here's an example of a web app plugin making use of {{< newtabref href="https://github.com/mattermost/mattermost-redux" title="mattermost-redux's" >}} selectors:

```ts
import {useSelector} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

const MyComponent = ({postId}) => {
    const post = useSelector((state) => getPost(state, postId));
    const currentUser = useSelector(getCurrentUser);
    const currentChannel = useSelector(getCurrentChannel);
    const currentTeam = useSelector(getCurrentTeam);

    // ...
};
```

## Some common actions

We've listed out some of the commonly-used actions that you can use in your web app plugin. You can find all the actions are available for your plugin to import {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/actions" title="in the source code for mattermost-redux" >}}.

* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/3d1028034d7677adfda58e91b9a5dcaf1bc0ff99/src/actions/channels.ts#L47" title="createChannel(channel: Channel, userId: string)" >}}

Dispatch this action to create a new channel.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/3d1028034d7677adfda58e91b9a5dcaf1bc0ff99/src/actions/emojis.ts#L32" title="getCustomEmoji(emojiId: string)" >}}

Dispatch this action to fetch a specific emoji associated with the `emojiId` provided.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/3d1028034d7677adfda58e91b9a5dcaf1bc0ff99/src/actions/posts.ts#L162" title="createPost(post: Post, files: any[] = [])" >}}

Dispatch this action to create a new post.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/3d1028034d7677adfda58e91b9a5dcaf1bc0ff99/src/actions/teams.ts#L67" title="getMyTeams()" >}}

Dispatch this action to fetch all the team types associated with the current user.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/3d1028034d7677adfda58e91b9a5dcaf1bc0ff99/src/actions/users.ts#L53" title="createUser(user: UserProfile, token: string, inviteId: string, redirect: string)" >}}

Dispatch this action to create a new user profile.


## Some common selectors

Here are some examples of commonly-used selectors you can use in your web app plugin. You can find all the selectors that are available for your plugin to import {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/selectors" title="in the source code for mattermost-redux" >}}.

* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/common.ts#L46" title="getCurrentUserId(state)" >}}

Retrieves the `userId` of the current user from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/common.ts#L42" title="getCurrentUser(state: GlobalState): UserProfile" >}}

Retrieves the user profile of the current user from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/common.ts#L50" title="getUsers(state: GlobalState): IDMappedObjects<UserProfile>" >}}

Retrieves all user profiles from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/channels.ts#L218" title="getChannel(state: GlobalState, id: string)" >}}

Retrieves a channel as it exists in the store without filling in any additional details such as the `display_name` for Direct Messages/Group Messages.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/common.ts#L14" title="getCurrentChannelId(state: GlobalState)" >}}

Retrieves the channel ID of the current channel from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/channels.ts#L235" title="getCurrentChannel: (state: GlobalState)" >}}

Retrieves the complete channel info of the current channel from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/posts.ts#L46" title="getPost(state: GlobalState, postId: $ID<Post>)" >}}

Retrieves the specific post associated with the supplied `postID` from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/teams.ts#L20" title="getCurrentTeamId(state: GlobalState)" >}}

Retrieves the `teamId` of the current team from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/teams.ts#L57" title="getCurrentTeam: (state: GlobalState)" >}}

Retrieves the team info of the current team from the `Redux store`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/selectors/entities/emojis.ts#L37" title="getCustomEmojisByName: (state: GlobalState)" >}}

Retrieves the the specific emoji associated with the supplied `customEmojiName` from the `Redux store`.


## Some common client functions

We've listed out some of the commonly-used client functions you can use in your web app plugin. You can find all the client functions that are available for your plugin to import {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts" title="in the source code for mattermost-redux" >}}.

* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L846" title="getUser = (userId: string)" >}}

Routes to the user profile of the specified `userId` from the `Mattermost Server`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L853" title="getUserByUsername = (username: string)" >}}

Routes to the user profile of the specified `username` from the `Mattermost Server`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L1600" title="getChannel = (channelId: string)" >}}

Routes to the channel of the specified `channelId` from the `Mattermost Server`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L1609" title="getChannelByName = (teamId: string, channelName: string, includeDeleted = false)" >}}

Routes to the channel of the specified `channelName` from the `Mattermost Server`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L1192" title="getTeam = (teamId: string)" >}}

Routes to the team of the specified `teamId` from the `Mattermost Server`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L1199" title="getTeamByName = (teamName: string)" >}}

Routes to the team of the specified `teamName` from the `Mattermost Server`.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L2463" title="executeCommand = (command: string, commandArgs: CommandArgs)" >}}

Executes the specified command with the arguments provided and fetches the response.


* ### {{< newtabref href="https://github.com/mattermost/mattermost-redux/blob/master/src/client/client4.ts#L440" title="getOptions(options: Options) {const newOptions: Options = {...options}" >}}

Get the client options to make requests to the server. Use this to create your own custom requests.

## Custom reducers and actions

Reducers in Redux are pure functions that describe how the data in the store changes after any given action. Reducers will always produce the same resulting state for a given state and action. You can register a custom reducer for your plugin against the Redux store with the `registerReducer` function.

### [registerReducer(reducer)]({{< ref "/integrate/reference/webapp/webapp-reference#registerReducer" >}})

Registers a reducer against the Redux store. It will be accessible in Redux state under `state['plugins-<yourpluginid>']`. It generally accepts a reducer and returns undefined.

When building web app plugins, it is common to perform actions that web and mobile apps already support. The majority of these actions exist in {{< newtabref href="https://github.com/mattermost/mattermost-redux" title="mattermost-redux" >}}, our library of shared code between Mattermost JavaScript clients.

Here we'll show how to use Redux actions with a plugin. To learn more about these actions, see the [contributor documentation]({{< ref "/contribute/more-info/webapp/redux/actions" >}}).

## Prerequisites

This guide assumes you have already set up your plugin development environment for web app plugins to match {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="mattermost-plugin-starter-template" >}}. If not, follow the README instructions of that repository first, or [see the Hello, World! guide]({{< ref "/integrate/plugins/components/webapp/hello-world" >}}).

## Import mattermost-redux

First, you'll need to add `mattermost-redux` as a dependency of your web app plugin.

```bash
cd /path/to/plugin/webapp
npm install mattermost-redux
```

That will add `mattermost-redux` as a dependency in your `package.json` file, allowing it to be imported into any of your plugin's JavaScript files.

## Use an action

Actions are used as part of components. To give components access to these actions, we pass them in as React props from the component's container `index.js` file. To demonstrate this, we'll create a new component.

In the `webapp` directory, let's create a component folder called `action_example` and switch into it.

```bash
mkdir -p src/components/action_example
cd src/components/action_example
```

In there, create two files: `index.js` and `action_example.jsx`. If you're not familiar with why we're creating these directories and files, [read the contributor documentation on using React with Redux]({{< ref "/contribute/more-info/webapp/redux/react-redux" >}}).

Open up `action_example.jsx` and add the following:

```jsx
import React from 'react';
import PropTypes from 'prop-types';

export default class ActionExample extends React.PureComponent {
    static propTypes = {
        user: PropTypes.object.isRequired,
        patchUser: PropTypes.func.isRequired, // here we define the action as a prop
    }

    updateFirstName = () => {
        const patchedUser = {
            id: this.props.user.id,
            first_name: 'Jim',
        };

        this.props.patchUser(patchedUser); // here we use the action
    }

    render() {
        return (
            <div>
                {'First name: ' + this.props.user.first_name}
                <a
                    href='#'
                    onClick={this.updateFirstName}
                >
                    Click me to update the first name!
                </a>
            </div>
        );
    }
}
```

This component will display a user's first name and then, when the link is clicked, use an action to update that user's first name to "Jim".

The action `patchUser` is from mattermost-redux. It takes in a subset of a user object and updates the user on the server, {{< newtabref href="https://api.mattermost.com/#tag/users%2Fpaths%2F~1users~1%7Buser_id%7D~1patch%2Fput" title="using the `PUT /users/{user_id}/patch` endpoint" >}}.

We must now use our container to import this action and pass it our component. Open up the `index.js` file and add:

```javascript
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {patchUser} from 'mattermost-redux/actions'; // importing the action

import ActionExample from './action_example.jsx';

const mapStateToProps = (state) => {
    const currentUserId = state.entities.users.currentUserId;

    return {
        user: state.entities.users.profiles[currentUserId],
    };
};

const mapDispatchToProps = (dispatch) => bindActionCreators({
    patchUser, // passing the action as a prop
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(ActionExample);
```

The container is doing two things. First, it's grabbing the current (logged in) user from the Redux state and passing it in as a prop. Anytime the Redux state updates, for example when we use the `patchUser` action, our component will get the updated copy of the current user. Second, the container is importing the `patchUser` action from mattermost-redux and passing it in as an action prop to our component.

Now we can use `this.props.patchUser()` to update a user. The example component we made uses it to patch the current user's first name.

To use our component in our plugin we would then use the registry in the initialization function of the plugin to register the component somewhere in the Mattermost UI. That is beyond the scope of this guide, but you can [read more about that here]({{< ref "/integrate/reference/webapp/webapp-reference" >}}).

## Available actions

The actions that are available for your plugin to import can be {{< newtabref href="https://github.com/mattermost/mattermost-redux/tree/master/src/actions" title="found in the source code for mattermost-redux" >}}.
