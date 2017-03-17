import { PropTypes } from 'react';

import deprecateObjectProperties from './deprecateObjectProperties';
import * as InternalPropTypes from './InternalPropTypes';
import warning from './routerWarning';

var func = PropTypes.func;
var object = PropTypes.object;
var shape = PropTypes.shape;
var string = PropTypes.string;


export var routerShape = shape({
  push: func.isRequired,
  replace: func.isRequired,
  go: func.isRequired,
  goBack: func.isRequired,
  goForward: func.isRequired,
  setRouteLeaveHook: func.isRequired,
  isActive: func.isRequired
});

export var locationShape = shape({
  pathname: string.isRequired,
  search: string.isRequired,
  state: object,
  action: string.isRequired,
  key: string
});

// Deprecated stuff below:

export var falsy = InternalPropTypes.falsy;
export var history = InternalPropTypes.history;
export var location = locationShape;
export var component = InternalPropTypes.component;
export var components = InternalPropTypes.components;
export var route = InternalPropTypes.route;
export var routes = InternalPropTypes.routes;
export var router = routerShape;

if (process.env.NODE_ENV !== 'production') {
  (function () {
    var deprecatePropType = function deprecatePropType(propType, message) {
      return function () {
        process.env.NODE_ENV !== 'production' ? warning(false, message) : void 0;
        return propType.apply(undefined, arguments);
      };
    };

    var deprecateInternalPropType = function deprecateInternalPropType(propType) {
      return deprecatePropType(propType, 'This prop type is not intended for external use, and was previously exported by mistake. These internal prop types are deprecated for external use, and will be removed in a later version.');
    };

    var deprecateRenamedPropType = function deprecateRenamedPropType(propType, name) {
      return deprecatePropType(propType, 'The `' + name + '` prop type is now exported as `' + name + 'Shape` to avoid name conflicts. This export is deprecated and will be removed in a later version.');
    };

    falsy = deprecateInternalPropType(falsy);
    history = deprecateInternalPropType(history);
    component = deprecateInternalPropType(component);
    components = deprecateInternalPropType(components);
    route = deprecateInternalPropType(route);
    routes = deprecateInternalPropType(routes);

    location = deprecateRenamedPropType(location, 'location');
    router = deprecateRenamedPropType(router, 'router');
  })();
}

var defaultExport = {
  falsy: falsy,
  history: history,
  location: location,
  component: component,
  components: components,
  route: route,
  // For some reason, routes was never here.
  router: router
};

if (process.env.NODE_ENV !== 'production') {
  defaultExport = deprecateObjectProperties(defaultExport, 'The default export from `react-router/lib/PropTypes` is deprecated. Please use the named exports instead.');
}

export default defaultExport;