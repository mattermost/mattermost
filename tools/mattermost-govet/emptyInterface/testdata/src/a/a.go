// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

// Valid: using any instead of interface{}
func validUsingAny() {
	var x any
	x = 42
	x = "hello"
	_ = x
}

func acceptAny(val any) {}

func returnAny() any {
	return 42
}

type ValidStruct struct {
	Field any
}

// Invalid: using interface{}
func invalidUsingInterface() {
	var x interface{} // want "using 'interface\\{\\}', please replace it with 'any'."
	x = 42
	_ = x
}

func acceptInterface(val interface{}) {} // want "using 'interface\\{\\}', please replace it with 'any'."

func returnInterface() interface{} { // want "using 'interface\\{\\}', please replace it with 'any'."
	return 42
}

type InvalidStruct struct {
	Field interface{} // want "using 'interface\\{\\}', please replace it with 'any'."
}

// Invalid: multiple empty interfaces
type MultipleEmptyInterfaces struct {
	Field1 interface{} // want "using 'interface\\{\\}', please replace it with 'any'."
	Field2 interface{} // want "using 'interface\\{\\}', please replace it with 'any'."
	Field3 any         // Valid
}

func multipleParams(a interface{}, b interface{}, c any) {} // want "using 'interface\\{\\}', please replace it with 'any'." "using 'interface\\{\\}', please replace it with 'any'."

// Valid: non-empty interfaces
type Reader interface {
	Read(p []byte) (n int, err error)
}

type Writer interface {
	Write(p []byte) (n int, err error)
}

func acceptReader(r Reader) {}

// Invalid: map with interface{} values
var invalidMap = map[string]interface{}{} // want "using 'interface\\{\\}', please replace it with 'any'."

// Valid: map with any values
var validMap = map[string]any{}

// Invalid: slice of interface{}
var invalidSlice []interface{} // want "using 'interface\\{\\}', please replace it with 'any'."

// Valid: slice of any
var validSlice []any

// Invalid: channel of interface{}
var invalidChan chan interface{} // want "using 'interface\\{\\}', please replace it with 'any'."

// Valid: channel of any
var validChan chan any
