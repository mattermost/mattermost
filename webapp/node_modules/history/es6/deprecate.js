'use strict';

import warning from 'warning';

function deprecate(fn, message) {
  return function () {
    process.env.NODE_ENV !== 'production' ? warning(false, '[history] ' + message) : undefined;
    return fn.apply(this, arguments);
  };
}

export default deprecate;