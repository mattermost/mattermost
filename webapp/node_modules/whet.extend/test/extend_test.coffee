###
Test suite for node AND browser in one file
So, we are need some data from global
Its so wrong, but its OK for test
###
# resolve require from [window] or by require() 
# _ = @_ ? require 'lodash'

lib_path = GLOBAL?.lib_path || ''

extend = require "#{lib_path}whet.extend"

describe 'whet.extend:', ->

  str = int = arr = date = obj = deep = null

  beforeEach ->
    str  = 'me a test'
    int  = 10
    arr  = [ 1, 'what', new Date( 81, 8, 4 )];
    date = new Date( 81, 4, 13 );

    obj = 
      str : str
      int : int
      arr : arr
      date : date

    deep = 
      ori : obj
      layer : 
        int : 10
        str : 'str'
        date : new Date( 84, 5, 12 )
        arr : [ 101, 'dude', new Date( 82, 10, 4 )]
        deep : 
          str : obj.str
          int : int
          arr : obj.arr
          date : new Date( 81, 7, 4 )
    
  describe 'should merge string with:', ->

    it 'string', ->
      ori    = 'what u gonna say';
      target = extend ori, str

      ori.should.eql 'what u gonna say'
      str.should.eql 'me a test'
      target.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't'

    it 'number', ->
      ori    = 'what u gonna say'
      target = extend ori, int

      ori.should.eql 'what u gonna say'
      int.should.eql 10 
      target.should.eql {}

    it 'array', ->
      ori    = 'what u gonna say'
      target = extend ori, arr 

      ori.should.eql 'what u gonna say'
      arr.should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      target.should.eql
        '0' : 1,
        '1' : 'what',
        '2' : new Date( 81, 8, 4 )

    it  'date', ->
      ori    = 'what u gonna say'
      target = extend ori, date 

      ori.should.eql 'what u gonna say' 
      date.should.eql new Date( 81, 4, 13 )
      target.should.eql new Date( 81, 4, 13 )

    it 'object', ->
      ori    = 'what u gonna say'
      target = extend ori, obj 

      ori.should.eql 'what u gonna say'
      obj.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

      target.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

  describe 'should merge number with:', ->

    it 'string', ->
      ori    = 20
      target = extend ori, str 

      ori.should.eql 20 
      str.should.eql 'me a test' 
      target.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't'

    it 'number', ->
      ori    = 20
      target = extend ori, int 

      ori.should.eql 20 
      int.should.eql 10 
      target.should.eql {}

    it 'array', ->
      ori    = 20
      target = extend ori, arr

      ori.should.eql 20 
      arr.should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      target.should.eql
        '0' : 1,
        '1' : 'what',
        '2' : new Date( 81, 8, 4 )

    it 'date', ->
      ori    = 20
      target = extend ori, date 

      ori.should.eql 20 
      date.should.eql new Date( 81, 4, 13 )
      target.should.eql new Date( 81, 4, 13 )

    it 'object', ->
      ori    = 20
      target = extend ori, obj

      ori.should.eql 20
      obj.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

      target.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

  describe 'should merge array with:', ->

    it 'string', ->
      ori    = [ 1, 2, 3, 4, 5, 6 ]
      target = extend ori, str 

      ori.should.eql [ 'm', 'e', ' ', 'a', ' ', 't', 'e', 's', 't' ]
      str.should.eql 'me a test'
      target.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't'

    it 'number', ->
      ori    = [ 1, 2, 3, 4, 5, 6 ]
      target = extend ori, int 

      ori.should.eql [ 1, 2, 3, 4, 5, 6 ]
      int.should.eql 10 
      target.should.eql [ 1, 2, 3, 4, 5, 6 ]

    it 'array', ->
      ori    = [ 1, 2, 3, 4, 5, 6 ]
      target = extend ori, arr 

      ori.should.eql [ 1, 'what', new Date( 81, 8, 4 ), 4, 5, 6 ]
      arr.should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      target.should.eql [ 1, 'what', new Date( 81, 8, 4 ), 4, 5, 6 ]

    it 'date', ->
      ori    = [ 1, 2, 3, 4, 5, 6 ]
      target = extend ori, date 

      ori.should.eql [ 1, 2, 3, 4, 5, 6 ]
      date.should.eql  new Date( 81, 4, 13 )
      target.should.eql [ 1, 2, 3, 4, 5, 6 ]

    it 'object', ->
      ori    = [ 1, 2, 3, 4, 5, 6 ]
      target = extend ori, obj

      ori.length.should.equal 6 
      ori[ 'str' ].should.eql 'me a test'
      ori[ 'int' ].should.eql 10 
      ori[ 'arr' ].should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      ori[ 'date' ].should.eql  new Date( 81, 4, 13 )
      obj.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )
    
      target.length.should.equal 6 
      target[ 'str' ].should.eql 'me a test' 
      target[ 'int' ].should.eql 10 
      target[ 'arr' ].should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      target[ 'date' ].should.eql new Date( 81, 4, 13 )

  describe 'should merge date with:', ->
  
    it 'string', ->
      ori    = new Date( 81, 9, 20 )
      target = extend ori, str 

      ori.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't'
   
      str.should.eql 'me a test'
      target.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't'

    it 'number', ->
      ori    = new Date( 81, 9, 20 )
      target = extend ori, int 

      ori.should.eql {}
      int.should.eql 10 
      target.should.eql {}

    it 'array', ->
      ori    = new Date( 81, 9, 20 )
      target = extend ori, arr

      ori.should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      int.should.eql 10 
      target.should.eql [ 1, 'what', new Date( 81, 8, 4 )]

    it 'date', ->
      ori    = new Date( 81, 9, 20 )
      target = extend ori, date 

      ori.should.eql {}
      date.should.eql new Date( 81, 4, 13 )
      target.should.eql {}

    it 'object', ->
      ori    = new Date( 81, 9, 20 )
      target = extend ori, obj 

      ori.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

      obj.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

      target.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

  describe 'should merge object with:', ->
  
    it 'string', ->
      ori =
        str : 'no shit'
        int : 76
        arr : [ 1, 2, 3, 4 ]
        date : new Date( 81, 7, 26 )
   
      target = extend ori, str 

      ori.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't',
        str: 'no shit',
        int: 76,
        arr: [ 1, 2, 3, 4 ],
        date: new Date( 81, 7, 26 )
      
      str.should.eql 'me a test' 
      target.should.eql
        '0' : 'm',
        '1' : 'e',
        '2' : ' ',
        '3' : 'a',
        '4' : ' ',
        '5' : 't',
        '6' : 'e',
        '7' : 's',
        '8' : 't',
        str: 'no shit',
        int: 76,
        arr: [ 1, 2, 3, 4 ],
        date: new Date( 81, 7, 26 )

    it 'number', ->
      ori = 
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
   
      target = extend ori, int 

      ori.should.eql
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      int.should.eql 10 
      target.should.eql
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )

    it 'array', ->
      ori =
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      target = extend ori, arr

      ori.should.eql
        '0' : 1,
        '1' : 'what',
        '2' : new Date( 81, 8, 4 ),
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      arr.should.eql [ 1, 'what', new Date( 81, 8, 4 )]
      target.should.eql
        '0' : 1,
        '1' : 'what',
        '2' : new Date( 81, 8, 4 ),
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )

    it 'date', ->
      ori = 
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      target = extend ori, date 

      ori.should.eql
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      date.should.eql new Date( 81, 4, 13 )
      target.should.eql
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )

    it 'object', ->
      ori =
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      target = extend ori, obj 

      ori.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )
      
      obj.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )
      
      target.should.eql
        str : 'me a test',
        int : 10,
        arr : [ 1, 'what', new Date( 81, 8, 4 )],
        date : new Date( 81, 4, 13 )

  describe 'should make deep clone: ', ->

    it 'object with object', ->
      ori =
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 )
      
      target = extend true, ori, deep

      ori.should.eql
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 ),
        ori :
          str : 'me a test',
          int : 10,
          arr : [ 1, 'what', new Date( 81, 8, 4 )],
          date : new Date( 81, 4, 13 )
        layer : 
          int : 10,
          str : 'str',
          date : new Date( 84, 5, 12 ),
          arr : [ 101, 'dude', new Date( 82, 10, 4 )],
          deep : 
            str : 'me a test',
            int : 10,
            arr : [ 1, 'what', new Date( 81, 8, 4 )],
            date : new Date( 81, 7, 4 )

      deep.should.eql
        ori : 
          str : 'me a test',
          int : 10,
          arr : [ 1, 'what', new Date( 81, 8, 4 )],
          date : new Date( 81, 4, 13 )
        layer : 
          int : 10,
          str : 'str',
          date : new Date( 84, 5, 12 ),
          arr : [ 101, 'dude', new Date( 82, 10, 4 )],
          deep : 
            str : 'me a test',
            int : 10,
            arr : [ 1, 'what', new Date( 81, 8, 4 )],
            date : new Date( 81, 7, 4 )

      target.should.eql
        str : 'no shit',
        int : 76,
        arr : [ 1, 2, 3, 4 ],
        date : new Date( 81, 7, 26 ),
        ori : 
          str : 'me a test',
          int : 10,
          arr : [ 1, 'what', new Date( 81, 8, 4 )],
          date : new Date( 81, 4, 13 )
        layer : 
          int : 10,
          str : 'str',
          date : new Date( 84, 5, 12 ),
          arr : [ 101, 'dude', new Date( 82, 10, 4 )],
          deep : 
            str : 'me a test',
            int : 10,
            arr : [ 1, 'what', new Date( 81, 8, 4 )],
            date : new Date( 81, 7, 4 )

      target.layer.deep = 339;
      deep.should.eql
        ori : 
          str : 'me a test',
          int : 10,
          arr : [ 1, 'what', new Date( 81, 8, 4 )],
          date : new Date( 81, 4, 13 )
        layer : 
          int : 10,
          str : 'str',
          date : new Date( 84, 5, 12 ),
          arr : [ 101, 'dude', new Date( 82, 10, 4 )],
          deep : 
            str : 'me a test',
            int : 10,
            arr : [ 1, 'what', new Date( 81, 8, 4 )],
            date : new Date( 81, 7, 4 )

    ###
    NEVER USE EXTEND WITH THE ABOVE SITUATION
    ###

  describe 'must pass additional test: ', ->

    it 'should merge objects with \'null\' and \'undefined\'', ->
      ori = 
        a : 10
        b : null
        c : 'test data'
        d : undefined

      additional = 
        x : 'googol'
        y : 8939843
        z : null
        az : undefined

      target = extend ori, additional
      target.should.to.be.eql 
        a : 10
        b : null
        c : 'test data'
        d : undefined
        x : 'googol'
        y : 8939843
        z : null
        az : undefined


