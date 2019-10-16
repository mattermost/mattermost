// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestStringify(t *testing.T) {
	cases := []struct {
		name     string
		objects  []interface{}
		strings  []string
	}{
		{
			name:     "NilShouldReturnEmpty",
			objects:  nil,
			strings:  make([]string, 0, 0),
		},
		{
			name:     "EmptyShouldReturnEmpty",
			objects:  make([]interface{}, 0, 0),
			strings:  make([]string, 0, 0),
		},
		{
			name:     "ShouldReturnCorrectValues",
			objects:  []interface{}{"foo", "bar", nil, map[string]int{"one": 1, "two": 2},
				&WithString{}, &WithError{}, &WithStringAndError{}},
			strings:  []string{"foo", "bar", "", "map[one:1 two:2]", "string", "error", "string"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			strings := stringify(c.objects)
			assert.Equal(t, c.strings, strings)
		})
	}

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

func TestToObjects(t *testing.T) {
	cases := []struct {
		name     string
		objects  []interface{}
		strings  []string
	}{
		{
			name:     "NilShouldReturnNil",
			strings:  nil,
			objects:  nil,
		},
		{
			name:     "EmptyShouldReturnEmpty",
			strings:  make([]string, 0, 0),
			objects:  make([]interface{}, 0, 0),
		},
		{
			name:     "ShouldReturnSliceOfObjects",
			strings:  []string{"foo", "bar"},
			objects:  []interface{}{"foo", "bar"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			objects := toObjects(c.strings)
			assert.Equal(t, c.objects, objects)
		})
	}

}
