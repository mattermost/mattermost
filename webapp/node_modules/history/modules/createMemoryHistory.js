import warning from 'warning'
import invariant from 'invariant'
import { parsePath } from './PathUtils'
import { PUSH, REPLACE, POP } from './Actions'
import createHistory from './createHistory'

function createStateStorage(entries) {
  return entries
    .filter(entry => entry.state)
    .reduce((memo, entry) => {
      memo[entry.key] = entry.state
      return memo
    }, {})
}

function createMemoryHistory(options={}) {
  if (Array.isArray(options)) {
    options = { entries: options }
  } else if (typeof options === 'string') {
    options = { entries: [ options ] }
  }

  const history = createHistory({
    ...options,
    getCurrentLocation,
    finishTransition,
    saveState,
    go
  })

  let { entries, current } = options

  if (typeof entries === 'string') {
    entries = [ entries ]
  } else if (!Array.isArray(entries)) {
    entries = [ '/' ]
  }

  entries = entries.map(function (entry) {
    const key = history.createKey()

    if (typeof entry === 'string')
      return { pathname: entry, key }

    if (typeof entry === 'object' && entry)
      return { ...entry, key }

    invariant(
      false,
      'Unable to create history entry from %s',
      entry
    )
  })

  if (current == null) {
    current = entries.length - 1
  } else {
    invariant(
      current >= 0 && current < entries.length,
      'Current index must be >= 0 and < %s, was %s',
      entries.length, current
    )
  }

  const storage = createStateStorage(entries)

  function saveState(key, state) {
    storage[key] = state
  }

  function readState(key) {
    return storage[key]
  }

  function getCurrentLocation() {
    const entry = entries[current]
    const { basename, pathname, search } = entry
    const path = (basename || '') + pathname + (search || '')

    let key, state
    if (entry.key) {
      key = entry.key
      state = readState(key)
    } else {
      key = history.createKey()
      state = null
      entry.key = key
    }

    const location = parsePath(path)

    return history.createLocation({ ...location, state }, undefined, key)
  }

  function canGo(n) {
    const index = current + n
    return index >= 0 && index < entries.length
  }

  function go(n) {
    if (n) {
      if (!canGo(n)) {
        warning(
          false,
          'Cannot go(%s) there is not enough history',
          n
        )
        return
      }

      current += n

      const currentLocation = getCurrentLocation()

      // change action to POP
      history.transitionTo({ ...currentLocation, action: POP })
    }
  }

  function finishTransition(location) {
    switch (location.action) {
      case PUSH:
        current += 1

        // if we are not on the top of stack
        // remove rest and push new
        if (current < entries.length)
          entries.splice(current)

        entries.push(location)
        saveState(location.key, location.state)
        break
      case REPLACE:
        entries[current] = location
        saveState(location.key, location.state)
        break
    }
  }

  return history
}

export default createMemoryHistory
