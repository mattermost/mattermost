import { PropTypes } from 'react';

var func = PropTypes.func;
var object = PropTypes.object;
var arrayOf = PropTypes.arrayOf;
var oneOfType = PropTypes.oneOfType;
var element = PropTypes.element;
var shape = PropTypes.shape;
var string = PropTypes.string;


export function falsy(props, propName, componentName) {
  if (props[propName]) return new Error('<' + componentName + '> should not have a "' + propName + '" prop');
}

export var history = shape({
  listen: func.isRequired,
  push: func.isRequired,
  replace: func.isRequired,
  go: func.isRequired,
  goBack: func.isRequired,
  goForward: func.isRequired
});

export var component = oneOfType([func, string]);
export var components = oneOfType([component, object]);
export var route = oneOfType([object, element]);
export var routes = oneOfType([route, arrayOf(route)]);