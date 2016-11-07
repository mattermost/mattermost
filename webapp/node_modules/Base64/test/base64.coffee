assert = require 'assert'

{btoa, atob} = require '..'


describe 'Base64.js', ->

  it 'can encode ASCII input', ->
    assert.strictEqual btoa(''), ''
    assert.strictEqual btoa('f'), 'Zg=='
    assert.strictEqual btoa('fo'), 'Zm8='
    assert.strictEqual btoa('foo'), 'Zm9v'
    assert.strictEqual btoa('quux'), 'cXV1eA=='
    assert.strictEqual btoa('!"#$%'), 'ISIjJCU='
    assert.strictEqual btoa("&'()*+"), 'JicoKSor'
    assert.strictEqual btoa(',-./012'), 'LC0uLzAxMg=='
    assert.strictEqual btoa('3456789:'), 'MzQ1Njc4OTo='
    assert.strictEqual btoa(';<=>?@ABC'), 'Ozw9Pj9AQUJD'
    assert.strictEqual btoa('DEFGHIJKLM'), 'REVGR0hJSktMTQ=='
    assert.strictEqual btoa('NOPQRSTUVWX'), 'Tk9QUVJTVFVWV1g='
    assert.strictEqual btoa('YZ[\\]^_`abc'), 'WVpbXF1eX2BhYmM='
    assert.strictEqual btoa('defghijklmnop'), 'ZGVmZ2hpamtsbW5vcA=='
    assert.strictEqual btoa('qrstuvwxyz{|}~'), 'cXJzdHV2d3h5ent8fX4='

  it 'cannot encode non-ASCII input', ->
    assert.throws (-> btoa '✈'), (err) ->
      err instanceof Error and
      err.name is 'InvalidCharacterError' and
      err.message is "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."

  it 'can decode Base64-encoded input', ->
    assert.strictEqual atob(''), ''
    assert.strictEqual atob('Zg=='), 'f'
    assert.strictEqual atob('Zm8='), 'fo'
    assert.strictEqual atob('Zm9v'), 'foo'
    assert.strictEqual atob('cXV1eA=='), 'quux'
    assert.strictEqual atob('ISIjJCU='), '!"#$%'
    assert.strictEqual atob('JicoKSor'), "&'()*+"
    assert.strictEqual atob('LC0uLzAxMg=='), ',-./012'
    assert.strictEqual atob('MzQ1Njc4OTo='), '3456789:'
    assert.strictEqual atob('Ozw9Pj9AQUJD'), ';<=>?@ABC'
    assert.strictEqual atob('REVGR0hJSktMTQ=='), 'DEFGHIJKLM'
    assert.strictEqual atob('Tk9QUVJTVFVWV1g='), 'NOPQRSTUVWX'
    assert.strictEqual atob('WVpbXF1eX2BhYmM='), 'YZ[\\]^_`abc'
    assert.strictEqual atob('ZGVmZ2hpamtsbW5vcA=='), 'defghijklmnop'
    assert.strictEqual atob('cXJzdHV2d3h5ent8fX4='), 'qrstuvwxyz{|}~'

  it 'cannot decode invalid input', ->
    assert.throws (-> atob 'a'), (err) ->
      err instanceof Error and
      err.name is 'InvalidCharacterError' and
      err.message is "'atob' failed: The string to be decoded is not correctly encoded."
