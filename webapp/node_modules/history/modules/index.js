export createHistory from './createBrowserHistory'
export createHashHistory from './createHashHistory'
export createMemoryHistory from './createMemoryHistory'

export useBasename from './useBasename'
export useBeforeUnload from './useBeforeUnload'
export useQueries from './useQueries'

export Actions from './Actions'

// deprecated
export enableBeforeUnload from './enableBeforeUnload'
export enableQueries from './enableQueries'

import deprecate from './deprecate'
import _createLocation from './createLocation'
export const createLocation = deprecate(
  _createLocation,
  'Using createLocation without a history instance is deprecated; please use history.createLocation instead'
)
