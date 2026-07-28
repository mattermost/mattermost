// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import "testing"

// Mock testify modules
type require struct{}
type assert struct{}

func (r *require) NoError(t *testing.T, err error, msgAndArgs ...interface{}) {}
func (r *require) Equal(t *testing.T, expected, actual interface{}, msgAndArgs ...interface{}) {}
func (r *require) True(t *testing.T, value bool, msgAndArgs ...interface{}) {}
func (r *require) NotNil(t *testing.T, object interface{}, msgAndArgs ...interface{}) {}

func (a *assert) NoError(t *testing.T, err error, msgAndArgs ...interface{}) {}
func (a *assert) Equal(t *testing.T, expected, actual interface{}, msgAndArgs ...interface{}) {}
func (a *assert) True(t *testing.T, value bool, msgAndArgs ...interface{}) {}

var Require = &require{}
var Assert = &assert{}

// Valid: Using testify require assertions
func TestValidUsingRequire(t *testing.T) {
	require := Require

	err := someFunction()
	require.NoError(t, err)

	result := getValue()
	require.Equal(t, 42, result)
	require.True(t, result > 0)
	require.NotNil(t, result)
}

// Valid: Using testify assert assertions
func TestValidUsingAssert(t *testing.T) {
	assert := Assert

	err := someFunction()
	assert.NoError(t, err)

	result := getValue()
	assert.Equal(t, 42, result)
	assert.True(t, result > 0)
}

// Invalid: Using t.Fatal
func TestInvalidUsingTFatal(t *testing.T) {
	err := someFunction()
	if err != nil {
		t.Fatal("error occurred") // want "t.Fatal usage is not allowed. Use semantic assertions with require or assert modules from testify package."
	}

	result := getValue()
	if result != 42 {
		t.Fatal("unexpected result") // want "t.Fatal usage is not allowed. Use semantic assertions with require or assert modules from testify package."
	}
}

// Valid: Other t methods are allowed
func TestValidOtherTMethods(t *testing.T) {
	// These are allowed
	t.Log("This is a log message")
	t.Logf("This is a formatted log: %d", 42)
	t.Error("This is an error but not Fatal")
	t.Errorf("This is a formatted error: %v", "test")
	t.Skip("Skipping test")
	t.Skipf("Skipping test: %s", "reason")
	t.SkipNow()
	t.Parallel()
	t.Helper()
}

// Invalid: Multiple t.Fatal calls
func TestMultipleTFatal(t *testing.T) {
	if someCondition() {
		t.Fatal("first fatal") // want "t.Fatal usage is not allowed. Use semantic assertions with require or assert modules from testify package."
	}

	if anotherCondition() {
		t.Fatal("second fatal") // want "t.Fatal usage is not allowed. Use semantic assertions with require or assert modules from testify package."
	}
}

// Valid: Different variable name (not t)
func TestValidDifferentVarName(t *testing.T) {
	type myTest struct{}
	myT := &myTest{}
	// This won't be caught since the variable isn't named 't'
	_ = myT
}

func someFunction() error {
	return nil
}

func getValue() int {
	return 42
}

func someCondition() bool {
	return false
}

func anotherCondition() bool {
	return false
}
