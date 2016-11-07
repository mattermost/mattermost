###
 * whet.extend v0.9.7
 * Standalone port of jQuery.extend that actually works on node.js
 * https://github.com/Meettya/whet.extend
 *
 * Copyright 2012, Dmitrii Karpich
 * Released under the MIT License
###

module.exports = extend = (deep, target, args...) ->

  unless _isClass deep, 'Boolean'
    args.unshift target
    [ target, deep ] = [ deep or {}, false ]

  #Handle case when target is a string or something (possible in deep copy)
  target = {} if _isPrimitiveType target 
  
  for options in args when options?
    for name, copy of options
      target[name] = _findValue deep, copy, target[name]

  target

###
Internal methods from now
###

_isClass = (obj, str) ->
  "[object #{str}]" is Object::toString.call obj

_isOwnProp = (obj, prop) ->
  Object::hasOwnProperty.call obj, prop

_isTypeOf = (obj, str) ->
  str is typeof obj

_isPlainObj = (obj) ->
  
  return false unless obj 
  return false if obj.nodeType or obj.setInterval or not _isClass obj, 'Object'

  # Not own constructor property must be Object
  return false if obj.constructor and
                  not _isOwnProp(obj, 'constructor') and
                  not _isOwnProp(obj.constructor::, 'isPrototypeOf')

  # Own properties are enumerated firstly, so to speed up, 
  # if last one is own, then all properties are own.
  key for key of obj
  key is undefined or _isOwnProp obj, key

_isPrimitiveType = (obj) ->
  not ( _isTypeOf(obj, 'object') or _isTypeOf(obj, 'function') )

_prepareClone = (copy, src) ->
  if _isClass copy, 'Array'
    if _isClass src, 'Array' then src else []
  else
    if _isPlainObj src then src else {}

_findValue = (deep, copy, src) ->
  # if we're merging plain objects or arrays
  if deep and ( _isClass(copy, 'Array') or _isPlainObj copy )
    clone = _prepareClone copy, src       
    extend deep, clone, copy         
  else
    copy
