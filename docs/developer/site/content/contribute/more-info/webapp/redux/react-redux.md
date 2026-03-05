---
title: "Use Redux with React"
heading: "Use Redux with React in Mattermost"
description: "Find out how using Redux with React is fairly straightforward thanks to the React Redux library."
date: 2017-08-20T11:35:32-04:00
weight: 7
aliases:
  - /contribute/webapp/redux/react-redux
---

Using Redux with React is fairly straightforward thanks to the {{< newtabref href="https://github.com/reactjs/react-redux" title="React Redux" >}} library. It provides the `connect` function to create higher order components that have access to the Redux store to set their props.

A typical Redux-connected component will be in its own folder with two files: `index.jsx` containing the code to connect to the Redux store and the file where the component is actually implemented. This helps to keep the Redux logic separate from the rendering for the component which keeps it more easily readable and makes it easier to test since it can be done without the whole Redux store.

```jsx
// components/my_component/index.jsx

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {messageUser} from 'actions/entities/users';

import {getCurrentUser, getUser} from 'selectors/entities/users';

import MyComponent from './my_component';

// mapStateToProps receives the Redux store state and any props passed into the connected
// component, and they are used to return any additional data from the Redux store that is
// needed to render the component. ownProps will also be passed directly to the component.
function mapStateToProps(state, ownProps) {
    return {
        currentUser: getCurrentUser(state),
        otherUser: getUser(state, ownProps.userId),
    };
}

// mapDispatchToProps receives the Redux store's dispatch method so that bindActionCreators
// can be used to automatically dispatch those actions as necessary.
function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            messageUser,
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MyComponent);

// components/my_component/my_component.jsx

import React from 'react';

function MyComponent(props) {
    const handleClick = () => {
        props.actions.messageUser(props.otherUser, props.currentUser, `Hello, ${props.otherUser.first_name}!`);
    };

    return (
        <label>
            {`${props.otherUser.first_name} ${props.otherUser.last_name}: `}
            <button onClick={this.handleClick}>{'Say Hi'}</button>
        </label>
    );
}
```

Both `mapStateToProps` and `mapDispatchToProps` are optional and can be omitted as necessary.

If you're using a selector that is produced through a factory, such as `makeGetUser`, you can instead generate an individual `mapStateToProps` function for each instance of the component.

```jsx
// component/my_component/index.jsx

...

import {getCurrentUser, makeGetUser} from 'selectors/entities/users';

// makeMapStateToProps is called once for each instance of the component on the page. Because of this
// a separate getUser selector is created for each instance, allowing them to be memoized separately.
function makeMapStateToProps() {
    const getUser = makeGetUser();

    return (state, ownProps) => {
        return {
            currentUser: getCurrentUser(state),
            otherUser: getUser(state, ownProps.userId)
        };
    };
}

...

export default connect(makeMapStateToProps, mapDispatchToProps)(MyComponent);
```

## Performance considerations

Something very important to note when using React with Redux is that every single `mapStateToProps` function within your application will be called whenever anything in the store changes. If any work being done in `mapStateToProps` performs any complicated calculations or returns rich objects, it should be moved into a [selector]({{< ref "/contribute/more-info/webapp/redux/selectors" >}}) so that it can be memoized whenever possible.
