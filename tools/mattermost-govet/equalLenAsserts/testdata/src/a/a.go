// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import "testing"

// Mock testify modules
type require struct{}
type assert struct{}

func (r *require) Equal(t *testing.T, expected, actual interface{}, msgAndArgs ...interface{}) {}
func (r *require) Len(t *testing.T, object interface{}, length int, msgAndArgs ...interface{}) {}
func (r *require) Empty(t *testing.T, object interface{}, msgAndArgs ...interface{}) {}

func (a *assert) Equal(t *testing.T, expected, actual interface{}, msgAndArgs ...interface{}) {}
func (a *assert) Len(t *testing.T, object interface{}, length int, msgAndArgs ...interface{}) {}
func (a *assert) Empty(t *testing.T, object interface{}, msgAndArgs ...interface{}) {}

var Require = &require{}
var Assert = &assert{}

// Valid: Using Len correctly
func TestValidUsingLen(t *testing.T) {
	require := Require
	assert := Assert

	slice := []int{1, 2, 3}
	require.Len(t, slice, 3)
	assert.Len(t, slice, 5)

	str := "hello"
	require.Len(t, str, 5)
	assert.Len(t, str, 5)
}

// Valid: Using Empty correctly
func TestValidUsingEmpty(t *testing.T) {
	require := Require
	assert := Assert

	emptySlice := []int{}
	require.Empty(t, emptySlice)
	assert.Empty(t, emptySlice)

	emptyStr := ""
	require.Empty(t, emptyStr)
	assert.Empty(t, emptyStr)
}

// Invalid: Using Equal with len (require)
func TestInvalidRequireEqualWithLen(t *testing.T) {
	require := Require

	slice := []int{1, 2, 3}

	// Invalid: Equal with len
	require.Equal(t, 3, len(slice)) // want "calling len inside require/assert.Equal, please use require/assert.Len instead"
	require.Equal(t, len(slice), 3) // want "calling len inside require/assert.Equal, please use require/assert.Len instead"

	str := "hello"
	require.Equal(t, 5, len(str)) // want "calling len inside require/assert.Equal, please use require/assert.Len instead"
}

// Invalid: Using Equal with len(0) (require)
func TestInvalidRequireEqualWithLenZero(t *testing.T) {
	require := Require

	emptySlice := []int{}

	// Invalid: Equal with len and 0
	require.Equal(t, 0, len(emptySlice)) // want "calling len inside require/assert.Equal and comparing to 0, please use require/assert.Empty instead"
	require.Equal(t, len(emptySlice), 0) // want "calling len inside require/assert.Equal and comparing to 0, please use require/assert.Empty instead"
}

// Invalid: Using Len with 0 (require)
func TestInvalidRequireLenWithZero(t *testing.T) {
	require := Require

	emptySlice := []int{}

	// Invalid: Len with 0
	require.Len(t, emptySlice, 0) // want "calling require/assert.Len comparing to 0, please use require/assert.Empty instead"
}

// Invalid: Using Equal with len (assert)
func TestInvalidAssertEqualWithLen(t *testing.T) {
	assert := Assert

	slice := []int{1, 2, 3}

	// Invalid: Equal with len
	assert.Equal(t, 3, len(slice)) // want "calling len inside require/assert.Equal, please use require/assert.Len instead"
	assert.Equal(t, len(slice), 3) // want "calling len inside require/assert.Equal, please use require/assert.Len instead"

	str := "hello"
	assert.Equal(t, 5, len(str)) // want "calling len inside require/assert.Equal, please use require/assert.Len instead"
}

// Invalid: Using Equal with len(0) (assert)
func TestInvalidAssertEqualWithLenZero(t *testing.T) {
	assert := Assert

	emptySlice := []int{}

	// Invalid: Equal with len and 0
	assert.Equal(t, 0, len(emptySlice)) // want "calling len inside require/assert.Equal and comparing to 0, please use require/assert.Empty instead"
	assert.Equal(t, len(emptySlice), 0) // want "calling len inside require/assert.Equal and comparing to 0, please use require/assert.Empty instead"
}

// Invalid: Using Len with 0 (assert)
func TestInvalidAssertLenWithZero(t *testing.T) {
	assert := Assert

	emptySlice := []int{}

	// Invalid: Len with 0
	assert.Len(t, emptySlice, 0) // want "calling require/assert.Len comparing to 0, please use require/assert.Empty instead"
}

// Valid: Equal without len
func TestValidEqualWithoutLen(t *testing.T) {
	require := Require
	assert := Assert

	x := 5
	y := 5
	require.Equal(t, x, y)
	assert.Equal(t, x, y)

	require.Equal(t, 0, x-5)
	assert.Equal(t, 0, x-5)
}
