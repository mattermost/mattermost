import warning from 'warning'
import { canUseDOM } from './ExecutionEnvironment'
import { addEventListener, removeEventListener } from './DOMUtils'
import deprecate from './deprecate'

function startBeforeUnloadListener(getBeforeUnloadPromptMessage) {
  function listener(event) {
    const message = getBeforeUnloadPromptMessage()

    if (typeof message === 'string') {
      (event || window.event).returnValue = message
      return message
    }
  }

  addEventListener(window, 'beforeunload', listener)

  return function () {
    removeEventListener(window, 'beforeunload', listener)
  }
}

/**
 * Returns a new createHistory function that can be used to create
 * history objects that know how to use the beforeunload event in web
 * browsers to cancel navigation.
 */
function useBeforeUnload(createHistory) {
  return function (options) {
    const history = createHistory(options)

    let stopBeforeUnloadListener
    let beforeUnloadHooks = []

    function getBeforeUnloadPromptMessage() {
      let message

      for (let i = 0, len = beforeUnloadHooks.length; message == null && i < len; ++i)
        message = beforeUnloadHooks[i].call()

      return message
    }

    function listenBeforeUnload(hook) {
      beforeUnloadHooks.push(hook)

      if (beforeUnloadHooks.length === 1) {
        if (canUseDOM) {
          stopBeforeUnloadListener = startBeforeUnloadListener(getBeforeUnloadPromptMessage)
        } else {
          warning(
            false,
            'listenBeforeUnload only works in DOM environments'
          )
        }
      }

      return function () {
        beforeUnloadHooks = beforeUnloadHooks.filter(item => item !== hook)

        if (beforeUnloadHooks.length === 0 && stopBeforeUnloadListener) {
          stopBeforeUnloadListener()
          stopBeforeUnloadListener = null
        }
      }
    }

    // deprecated
    function registerBeforeUnloadHook(hook) {
      if (canUseDOM && beforeUnloadHooks.indexOf(hook) === -1) {
        beforeUnloadHooks.push(hook)

        if (beforeUnloadHooks.length === 1)
          stopBeforeUnloadListener = startBeforeUnloadListener(getBeforeUnloadPromptMessage)
      }
    }

    // deprecated
    function unregisterBeforeUnloadHook(hook) {
      if (beforeUnloadHooks.length > 0) {
        beforeUnloadHooks = beforeUnloadHooks.filter(item => item !== hook)

        if (beforeUnloadHooks.length === 0)
          stopBeforeUnloadListener()
      }
    }

    return {
      ...history,
      listenBeforeUnload,

      registerBeforeUnloadHook: deprecate(
        registerBeforeUnloadHook,
        'registerBeforeUnloadHook is deprecated; use listenBeforeUnload instead'
      ),
      unregisterBeforeUnloadHook: deprecate(
        unregisterBeforeUnloadHook,
        'unregisterBeforeUnloadHook is deprecated; use the callback returned from listenBeforeUnload instead'
      )
    }
  }
}

export default useBeforeUnload
