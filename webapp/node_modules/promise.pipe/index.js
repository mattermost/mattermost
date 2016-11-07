module.exports = pipe

function pipe () {
  if (!arguments.length) throw new Error('pipe requires one or more arguments')
  var args = Array.isArray(arguments[0]) 
    ? arguments[0]
    : [].slice.apply(arguments)

  return reduce(kestrel, args[0], rest(args))
}

function rest (array) {
  return array.slice(1)
}

function reduce (fn, acc, list) {
  return list.reduce(fn, acc)
}

function kestrel (a, b) {
  return function () {
    var self = this
    return a.apply(self, arguments)
      .then(function (result) {
        return b.call(self, result)
      })
  }
}
