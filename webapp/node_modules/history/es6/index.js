'use strict';

import deprecate from './deprecate';
import _createLocation from './createLocation';
import _createHistory from './createBrowserHistory';
export { _createHistory as createHistory };
import _createHashHistory from './createHashHistory';
export { _createHashHistory as createHashHistory };
import _createMemoryHistory from './createMemoryHistory';
export { _createMemoryHistory as createMemoryHistory };
import _useBasename from './useBasename';
export { _useBasename as useBasename };
import _useBeforeUnload from './useBeforeUnload';
export { _useBeforeUnload as useBeforeUnload };
import _useQueries from './useQueries';
export { _useQueries as useQueries };
import _Actions from './Actions';
export { _Actions as Actions };

// deprecated
import _enableBeforeUnload from './enableBeforeUnload';
export { _enableBeforeUnload as enableBeforeUnload };
import _enableQueries from './enableQueries';
export { _enableQueries as enableQueries };
var createLocation = deprecate(_createLocation, 'Using createLocation without a history instance is deprecated; please use history.createLocation instead');
export { createLocation };