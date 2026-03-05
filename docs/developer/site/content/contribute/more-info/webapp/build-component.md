---
title: "Build a component"
heading: "How to build a component in Mattermost"
description: "This page describes how to build a new React component in the Mattermost web app and the requirements it must meet."
date: 2017-08-20T11:35:32-04:00
weight: 4
aliases:
  - /contribute/webapp/build-component
---

This page describes how to build a new React component in the Mattermost web app. A new component must meet the following requirements:

1. Is pure, meaning that all information required to render is passed in by props.
2. Has no direct store interaction. Use `connect` to wrap the component if needed.
3. Has component tests.
4. Is generic and re-usable when possible.
5. Has documented props.

If none of those make any sense to you or you're new to React and Redux, then check out these links:

- https://react.dev/learn/
- http://redux.js.org/

These requirements are discussed in more detail in the following sections.

## Design the component

The most important part of designing your component is deciding on what the props will be. Props are very much the API for your component. Think of them as a contract between your component and the users.

Props are read-only variables that get passed down to your component either directly from a parent component or from an `index.ts` container that connects the component to the Redux store.

How do you decide what props your component should have? Think about what your component is trying to display to the user. Any data you need to accomplish that should be part of the props.

As an example, let's imagine we're building an `ItemList` component with the purpose of displaying a list of items. The props for such a component might look like:

```typescript
type Props = {
    /**
     * The title of the list
     */
    title?: string;
    
    /**
     * An array of items to display
     */
    items: ListItem[];
}
```

The `title` prop is a string that's displayed as the title of the list, and `items` is an array of objects that make up the contents of the list. Note that `items` is required while `title` is optional.

Make sure you add brief but clear comments to each prop type as shown in the example.

Our ItemList component would live in a file named `item_list.tsx`.

## Use a Redux container component

The next question to ask yourself is whether you're going to need a container component. This is the `index.ts` file mentioned above. If your component needs either of the following, then you'll need a container:

1. Needs some data injected into its props that the parent component doesn't have access to
2. Needs to be able to perform some sort of action that affects the state of the store

Continuing the `ItemList` example above, maybe our parent component doesn't care about our list of items and doesn't have access to them. Let's also imagine that we want to let the user remove items from the list by clicking on them. This means our component now needs a container for both criteria above and our props will change slightly:

```typescript
type Props = {
    /**
     * The title of the list
     */
    title?: string;
    
    /**
     * An array of item components to display
     */
    items: ListItem[];
    
    actions: {
        /**
        * An action to remove an item from the list
        */
        removeItem: (item: ListItem) => void;
    };
}
```

Note that the type definition for actions passed from Redux won't include the any reference to Redux's `dispatch` or Redux Thunk's `getState`. This is intentional as `connect` hides those details from the component.

The container will then handle getting data from the Redux state in `mapStateToProps` and passing Redux actions to the component using `mapDispatchToProps`. Note that either of these are optional if only one is needed.

```typescript
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {removeItem} from 'mattermost-redux/actions/items';
import {getItems} from 'mattermost-redux/selectors/entities/items';

import {GlobalState} from 'types/store';

import ItemList from './item_list';

function mapStateToProps(state: GlobalState) {
    return {
        items: getItems(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            removeItem,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ItemList);
```

If the selectors and/or actions you need don't yet exist in Redux then you should go add those first by following the [guide to adding actions and selectors]({{< ref "/contribute/more-info/webapp/redux/actions" >}}).

Your `index.ts` and `item_list.ts` files will live together in an `item_list/` directory.

## Implement the component

With the props defined and, if necessary, the container built, you're ready to implement the rest of your component. For the most part, implementing a component for the web app is no different than building any other React component. While older code tends to use class components which extend `React.PureComponent`, most newer code should use functional components.

Our `ItemList` example might look something like this:

```tsx
type Props = {
    /**
     * The title of the list
     */
    title?: string;
    
    /**
     * An array of item components to display
     */
    items: ListItem[];
    
    actions: {
        /**
        * An action to remove an item from the list
        */
        removeItem: (item: ListItem) => void;
    };
}

export default function ItemList(props: Props) {
    const title = this.props.title ? <h1>{this.props.title}</h1> : null;
    const items = this.props.items.map((item: ListItem) => (
        <Item
            key={item.id}
            item={item}
            removeItem={this.props.actions.removeItem}
        />
    ));

    return (
        <div className='item-list'>
            {title}
            {items}
        </div>
    );
}
```

---
To test your component, [follow the guide here]({{< ref "/contribute/more-info/webapp/unit-testing" >}}).
