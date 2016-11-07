/**
 * Indicates that navigation was caused by a call to history.push.
 */
'use strict';

var PUSH = 'PUSH';

export { PUSH };
/**
 * Indicates that navigation was caused by a call to history.replace.
 */
var REPLACE = 'REPLACE';

export { REPLACE };
/**
 * Indicates that navigation was caused by some other action such
 * as using a browser's back/forward buttons and/or manually manipulating
 * the URL in a browser's location bar. This is the default.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onpopstate
 * for more information.
 */
var POP = 'POP';

export { POP };
export default {
  PUSH: PUSH,
  REPLACE: REPLACE,
  POP: POP
};