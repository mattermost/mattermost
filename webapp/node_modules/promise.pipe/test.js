var test = require('blue-tape')
var pipe = require('./')

function adder (n) {
  return new Promise(function (resolve, reject) {
    resolve(n + 1)
  })
}

function addAsync (n) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      return resolve(adder(n))
    }, 500)
  })
}

test('should chain a single promise', function (t) {
  var addOne = pipe(adder)

  t.ok(addOne)
  return addOne(0).then(function (result) {
    t.equal(result, 1)
  })
})

test('should chain multiple promises', function (t) {
  var addThree = pipe(adder, adder, adder)

  t.ok(addThree)
  return addThree(0).then(function (result) {
    t.equal(result, 3)
  })
})

test('it should persist context', function (t) {
  var math = { addThree: pipe(adder, adder, adder, setIdentity) }

  function setIdentity (val) {
    this.identitiy = val
  }

  t.ok(math.addThree)
  return math.addThree(0).then(function (result) {
    t.ok(math.identitiy)
    t.equals(math.identitiy, 3)
  })
})

test('it should chain IO', function (t) {
  var addThreeAsync = pipe(addAsync, addAsync, addAsync)

  t.ok(addThreeAsync)
  return addThreeAsync(0).then(function (result) {
    t.equal(result, 3)
  })
})

test('it should persist context with IO', function (t) {
  var math = { addThree: pipe(addAsync, addAsync, addAsync, setIdentity) }

  function setIdentity (val) {
    this.identitiy = val
  }

  t.ok(math.addThree)
  return math.addThree(0).then(function (result) {
    t.ok(math.identitiy)
    t.equals(math.identitiy, 3)
  })
})

test('it should accept an array of promises', function (t) {
  var addThreeAsync = pipe([addAsync, addAsync, addAsync])

  t.ok(addThreeAsync)
  return addThreeAsync(0).then(function (result) {
    t.equal(result, 3)
  })
})

test('it should fail with 0 arguments', function (t) {
  try { pipe() } catch (err) {
    t.ok(err)
    t.end()
  }
})
