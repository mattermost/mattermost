import React from 'react';
import invariant from 'invariant';
import { createRouteFromReactElement } from './RouteUtils';
import { component, components } from './InternalPropTypes';

var _React$PropTypes = React.PropTypes;
var string = _React$PropTypes.string;
var func = _React$PropTypes.func;

/**
 * A <Route> is used to declare which components are rendered to the
 * page when the URL matches a given pattern.
 *
 * Routes are arranged in a nested tree structure. When a new URL is
 * requested, the tree is searched depth-first to find a route whose
 * path matches the URL.  When one is found, all routes in the tree
 * that lead to it are considered "active" and their components are
 * rendered into the DOM, nested in the same order as in the tree.
 */

var Route = React.createClass({
  displayName: 'Route',


  statics: {
    createRouteFromReactElement: createRouteFromReactElement
  },

  propTypes: {
    path: string,
    component: component,
    components: components,
    getComponent: func,
    getComponents: func
  },

  /* istanbul ignore next: sanity check */
  render: function render() {
    !false ? process.env.NODE_ENV !== 'production' ? invariant(false, '<Route> elements are for router configuration only and should not be rendered') : invariant(false) : void 0;
  }
});

export default Route;