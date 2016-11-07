# Flux
An application architecture for React utilizing a unidirectional data flow.

<img src="./docs/img/flux-diagram-white-background.png" style="width: 100%;" />


## Documentation
Please read the blog post announcing Flux: ["An Application Architecture for React"](http://facebook.github.io/react/blog/2014/05/06/flux.html).

Then read more about the [Flux architecture](http://facebook.github.io/flux/docs/overview.html) and dive into our [TodoMVC tutorial](http://facebook.github.io/flux/docs/todo-list.html).  

Going further, please take a look at our in-depth examination of [action creators and the dispatcher](http://facebook.github.io/react/blog/2014/07/30/flux-actions-and-the-dispatcher.html).


## Examples
Basic example: [TodoMVC](https://github.com/facebook/flux/tree/master/examples/flux-todomvc)

Slightly more complex example: [Chat Client](https://github.com/facebook/flux/tree/master/examples/flux-chat)

Flux Utils example : [TodoMVC](https://github.com/facebook/flux/tree/master/examples/flux-utils-todomvc)


## Requirements
Flux is more of a pattern than a framework, and does not have any hard dependencies.  However, we often use [EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter) as a basis for `Stores` and [React](https://github.com/facebook/react) for our `Views`.  The one piece of Flux not readily available elsewhere is the `Dispatcher`.  This module, along with some other utilities, is available here to complete your Flux toolbox.


## Installing Flux
Flux is available as a [npm module](https://www.npmjs.org/package/flux), so you can add it to your package.json file or run `npm install flux`.  The dispatcher will be available as `Flux.Dispatcher` and can be required like this:

```javascript
var Dispatcher = require('flux').Dispatcher;
```

Take a look at the [dispatcher API and some examples](http://facebook.github.io/flux/docs/dispatcher.html#content).

## Flux Utils

We have also provided some basic utility classes to help get you started with Flux. These base classes are a solid foundation for a simple Flux application, but they are **not** a feature-complete framework that will handle all use cases. There are many other great Flux frameworks out there if these utilities do not fulfill your needs.

```js
import {ReduceStore} from 'flux/utils';

class CounterStore extends ReduceStore<number> {
  getInitialState(): number {
    return 0;
  }

  reduce(state: number, action: Object): number {
    switch (action.type) {
      case 'increment':
        return state + 1;

      case 'square':
        return state * state;

      default:
        return state;
    }
  }
}
```

Check out the [example](https://github.com/facebook/flux/tree/master/examples/flux-utils-todomvc) and [documentation](https://facebook.github.io/flux/docs/flux-utils.html) for more information.

## Building Flux from a Cloned Repo
Clone the repo and navigate into the resulting `flux` directory.  Then run `npm install`.

This will run [Gulp](http://gulpjs.com/)-based build tasks automatically and produce the file Flux.js, which you can then require as a module.

You could then require the Dispatcher like so:

```javascript
var Dispatcher = require('path/to/this/directory/Flux').Dispatcher;
```

The build process also produces de-sugared versions of the `Dispatcher` and `invariant` modules in a `lib` directory, and you can require those modules directly, copying them into whatever directory is most convenient for you.  The flux-todomvc and flux-chat example applications both do this.


## How Flux works
Flux applications have three major parts: the ___dispatcher___, the ___stores___, and the ___views___ (React components).  These should not be confused with Model-View-Controller.  Controllers do exist in a Flux application, but they are ___controller-views___ -- views often found at the top of the hierarchy that retrieve data from the stores and pass this data down to their children.  Additionally, ___action creators___ — dispatcher helper methods — are often used to support a semantic dispatcher API.  It can be useful to think of them as a fourth part of the Flux update cycle.

Flux eschews MVC in favor of a unidirectional data flow. When a user interacts with a React ___view___, the view propagates an ___action___ through a central ___dispatcher___, to the various ___stores___ that hold the application's data and business logic, which updates all of the views that are affected. This works especially well with React's declarative programming style, which allows the store to send updates without specifying how to transition views between states.

We originally set out to deal correctly with derived data: for example, we wanted to show an unread count for message threads while another view showed a list of threads, with the unread ones highlighted. This was difficult to handle with MVC — marking a single thread as read would update the thread model, and then also need to update the unread count model.  These dependencies and cascading updates often occur in a large MVC application, leading to a tangled weave of data flow and unpredictable results.

Control is inverted with ___stores___: the stores accept updates and reconcile them as appropriate, rather than depending on something external to update its data in a consistent way. Nothing outside the store has any insight into how it manages the data for its domain, helping to keep a clear separation of concerns. This also makes stores more testable than models, especially since stores have no direct setter methods like `setAsRead()`, but instead have only an input point for a data payload, which is delivered through the ___dispatcher___ and originates with ___action creators___.


## Structure and Data Flow
A unidirectional data flow is central to the Flux pattern, and in fact Flux takes its name from the Latin word for flow. In the above diagram, the ___dispatcher___, ___stores___ and ___views___ are independent nodes with distinct inputs and outputs. The ___action creators___ are simply discrete, semantic helper functions that facilitate passing data to the ___dispatcher___ in the form of an ___action___.

All data flows through the ___dispatcher___ as a central hub.  ___Actions___ most often originate from user interactions with the ___views___, and ___action creators___ are nothing more than a call into the ___dispatcher___.  The ___dispatcher___ then invokes the callbacks that the ___stores___ have registered with it, effectively dispatching the data payload contained in the ___actions___ to all ___stores___.  Within their registered callbacks, ___stores___ determine which ___actions___ they are interested in, and respond accordingly.  The ___stores___ then emit a "change" event to alert the ___controller-views___ that a change to the data layer has occurred.  ___Controller-views___ listen for these events and retrieve data from the ___stores___ in an event handler.  The ___controller-views___ call their own `render()` method via `setState()` or `forceUpdate()`, updating themselves and all of their children.

This structure allows us to reason easily about our application in a way that is reminiscent of functional reactive programming, or more specifically data-flow programming or flow-based programming, where data flows through the application in a single direction — there are no two-way bindings. Application state is maintained only in the ___stores___, allowing the different parts of the application to remain highly decoupled. Where dependencies do occur between ___stores___, they are kept in a strict hierarchy, with synchronous updates managed by the ___dispatcher___.

We found that two-way data bindings led to cascading updates, where changing one object led to another object changing, which could also trigger more updates. As applications grew, these cascading updates made it very difficult to predict what would change as the result of one user interaction. When updates can only change data within a single round, the system as a whole becomes more predictable.


## Join the Flux community
See the [CONTRIBUTING](/CONTRIBUTING.md) file for how to help out.


## License
Flux is BSD-licensed. We also provide an additional patent grant.
