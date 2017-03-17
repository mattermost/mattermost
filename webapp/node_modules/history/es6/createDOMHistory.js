'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import invariant from 'invariant';
import { canUseDOM } from './ExecutionEnvironment';
import { getUserConfirmation, go } from './DOMUtils';
import createHistory from './createHistory';

function createDOMHistory(options) {
  var history = createHistory(_extends({
    getUserConfirmation: getUserConfirmation
  }, options, {
    go: go
  }));

  function listen(listener) {
    !canUseDOM ? process.env.NODE_ENV !== 'production' ? invariant(false, 'DOM history needs a DOM') : invariant(false) : undefined;

    return history.listen(listener);
  }

  return _extends({}, history, {
    listen: listen
  });
}

export default createDOMHistory;