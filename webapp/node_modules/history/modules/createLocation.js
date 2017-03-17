import warning from 'warning'
import { POP } from './Actions'
import { parsePath } from './PathUtils'

function createLocation(location='/', action=POP, key=null, _fourthArg=null) {
  if (typeof location === 'string')
    location = parsePath(location)

  if (typeof action === 'object') {
    warning(
      false,
      'The state (2nd) argument to createLocation is deprecated; use a ' +
      'location descriptor instead'
    )

    location = { ...location, state: action }

    action = key || POP
    key = _fourthArg
  }

  const pathname = location.pathname || '/'
  const search = location.search || ''
  const hash = location.hash || ''
  const state = location.state || null

  return {
    pathname,
    search,
    hash,
    state,
    action,
    key
  }
}

export default createLocation
