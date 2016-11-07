###
global helper for chai.should()
###
chai = require 'chai'
GLOBAL.should = chai.should()
GLOBAL.expect = chai.expect # to work with 'undefined' - should cant it

###
addon for lib_path
###
GLOBAL.lib_path = '../lib/'