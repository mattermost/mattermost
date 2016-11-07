/* components */
import _Router from './Router';
export { _Router as Router };
import _Link from './Link';
export { _Link as Link };
import _IndexLink from './IndexLink';
export { _IndexLink as IndexLink };
import _withRouter from './withRouter';
export { _withRouter as withRouter };

/* components (configuration) */

import _IndexRedirect from './IndexRedirect';
export { _IndexRedirect as IndexRedirect };
import _IndexRoute from './IndexRoute';
export { _IndexRoute as IndexRoute };
import _Redirect from './Redirect';
export { _Redirect as Redirect };
import _Route from './Route';
export { _Route as Route };

/* mixins */

import _History from './History';
export { _History as History };
import _Lifecycle from './Lifecycle';
export { _Lifecycle as Lifecycle };
import _RouteContext from './RouteContext';
export { _RouteContext as RouteContext };

/* utils */

import _useRoutes from './useRoutes';
export { _useRoutes as useRoutes };

export { createRoutes } from './RouteUtils';
import _RouterContext from './RouterContext';
export { _RouterContext as RouterContext };
import _RoutingContext from './RoutingContext';
export { _RoutingContext as RoutingContext };
import _PropTypes from './PropTypes';
export { _PropTypes as PropTypes };

export { locationShape, routerShape } from './PropTypes';
import _match from './match';
export { _match as match };
import _useRouterHistory from './useRouterHistory';
export { _useRouterHistory as useRouterHistory };

export { formatPattern } from './PatternUtils';
import _applyRouterMiddleware from './applyRouterMiddleware';
export { _applyRouterMiddleware as applyRouterMiddleware };

/* histories */

import _browserHistory from './browserHistory';
export { _browserHistory as browserHistory };
import _hashHistory from './hashHistory';
export { _hashHistory as hashHistory };
import _createMemoryHistory from './createMemoryHistory';
export { _createMemoryHistory as createMemoryHistory };