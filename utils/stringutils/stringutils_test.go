package stringutils

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestStringifyNilShouldReturnEmpty(t *testing.T) {
	// given
	var objects []interface{}
	// when
	strings := Stringify(objects)
	// then
	assert.Empty(t, strings)
}

func TestStringifyEmptyShouldReturnEmpty(t *testing.T) {
	// given
	objects := make([]interface{}, 0, 0)
	// when
	strings := Stringify(objects)
	// then
	assert.Empty(t, strings)
}

type WithString struct {
}

func (*WithString) String() string {
	return "string"
}

type WithError struct {
}

func (*WithError) Error() string {
	return "error"
}

type WithStringAndError struct {
}

func (*WithStringAndError) String() string {
	return "string"
}

func (*WithStringAndError) Error() string {
	return "error"
}

func TestStringifyShouldReturnCorrectValues(t *testing.T) {
	// given
	objectMap := map[string]int{"one": 1, "two": 2}
	objectString := &WithString{}
	objectError := &WithError{}
	objectStringAndError := &WithStringAndError{}
	objects := []interface{}{"foo", "bar", nil, objectMap, objectString, objectError, objectStringAndError}
	// when
	strings := Stringify(objects)
	// then
	assert.Equal(t, []string{"foo", "bar", "", "map[one:1 two:2]", "string", "error", "string"}, strings)
}

func TestToObjectsNilShouldReturnNil(t *testing.T) {
	// given
	var strings []string
	// when
	objects := ToObjects(strings)
	// then
	assert.Nil(t, objects)
}

func TestToObjectsEmptyShouldReturnEmpty(t *testing.T) {
	// given
	strings := make([]string, 0, 0)
	// when
	objects := ToObjects(strings)
	// then
	assert.Empty(t, objects)
}

func TestToObjectsShouldReturnSliceOfObjects(t *testing.T) {
	// given
	strings := []string{"foo", "bar"}
	// when
	objects := ToObjects(strings)
	// then
	assert.Equal(t, []interface{}{"foo", "bar"}, objects)
}
