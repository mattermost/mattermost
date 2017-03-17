import warning from 'warning'
import { canUseDOM } from './ExecutionEnvironment'
import { parsePath } from './PathUtils'
import runTransitionHook from './runTransitionHook'
import deprecate from './deprecate'

function useBasename(createHistory) {
  return function (options={}) {
    const history = createHistory(options)

    let { basename } = options

    let checkedBaseHref = false

    function checkBaseHref() {
      if (checkedBaseHref) {
        return
      }

      // Automatically use the value of <base href> in HTML
      // documents as basename if it's not explicitly given.
      if (basename == null && canUseDOM) {
        const base = document.getElementsByTagName('base')[0]
        const baseHref = base && base.getAttribute('href')

        if (baseHref != null) {
          basename = baseHref

          warning(
            false,
            'Automatically setting basename using <base href> is deprecated and will ' +
            'be removed in the next major release. The semantics of <base href> are ' +
            'subtly different from basename. Please pass the basename explicitly in ' +
            'the options to createHistory'
          )
        }
      }

      checkedBaseHref = true
    }

    function addBasename(location) {
      checkBaseHref()

      if (basename && location.basename == null) {
        if (location.pathname.indexOf(basename) === 0) {
          location.pathname = location.pathname.substring(basename.length)
          location.basename = basename

          if (location.pathname === '')
            location.pathname = '/'
        } else {
          location.basename = ''
        }
      }

      return location
    }

    function prependBasename(location) {
      checkBaseHref()

      if (!basename)
        return location

      if (typeof location === 'string')
        location = parsePath(location)

      const pname = location.pathname
      const normalizedBasename = basename.slice(-1) === '/' ? basename : basename + '/'
      const normalizedPathname = pname.charAt(0) === '/' ? pname.slice(1) : pname
      const pathname = normalizedBasename + normalizedPathname

      return {
        ...location,
        pathname
      }
    }

    // Override all read methods with basename-aware versions.
    function listenBefore(hook) {
      return history.listenBefore(function (location, callback) {
        runTransitionHook(hook, addBasename(location), callback)
      })
    }

    function listen(listener) {
      return history.listen(function (location) {
        listener(addBasename(location))
      })
    }

    // Override all write methods with basename-aware versions.
    function push(location) {
      history.push(prependBasename(location))
    }

    function replace(location) {
      history.replace(prependBasename(location))
    }

    function createPath(location) {
      return history.createPath(prependBasename(location))
    }

    function createHref(location) {
      return history.createHref(prependBasename(location))
    }

    function createLocation(location, ...args) {
      return addBasename(
        history.createLocation(prependBasename(location), ...args)
      )
    }

    // deprecated
    function pushState(state, path) {
      if (typeof path === 'string')
        path = parsePath(path)

      push({ state, ...path })
    }

    // deprecated
    function replaceState(state, path) {
      if (typeof path === 'string')
        path = parsePath(path)

      replace({ state, ...path })
    }

    return {
      ...history,
      listenBefore,
      listen,
      push,
      replace,
      createPath,
      createHref,
      createLocation,

      pushState: deprecate(
        pushState,
        'pushState is deprecated; use push instead'
      ),
      replaceState: deprecate(
        replaceState,
        'replaceState is deprecated; use replace instead'
      )
    }
  }
}

export default useBasename
