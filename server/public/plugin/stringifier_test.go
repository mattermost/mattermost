// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
)

func TestStringify(t *testing.T) {
	t.Run("NilShouldReturnEmpty", func(t *testing.T) {
		strings := stringify(nil)
		assert.Empty(t, strings)
	})
	t.Run("EmptyShouldReturnEmpty", func(t *testing.T) {
		strings := stringify(make([]any, 0))
		assert.Empty(t, strings)
	})
	t.Run("PrimitivesAndCompositesShouldReturnCorrectValues", func(t *testing.T) {
		strings := stringify([]any{
			1234,
			3.14159265358979323846264338327950288419716939937510,
			true,
			"foo",
			nil,
			[]string{"foo", "bar"},
			map[string]int{"one": 1, "two": 2},
			&WithString{},
			&WithoutString{},
			&WithStringAndError{},
		})
		assert.Equal(t, []string{
			"1234",
			"3.141592653589793",
			"true",
			"foo",
			"<nil>",
			"[foo bar]",
			"map[one:1 two:2]",
			"string",
			"&{}",
			"error",
		}, strings)
	})
	t.Run("ErrorShouldReturnFormattedStack", func(t *testing.T) {
		strings := stringify([]any{
			errors.New("error"),
			errors.WithStack(errors.New("error")),
		})
		stackRegexp := "error\n.*plugin.TestStringify.func\\d+\n\t.*plugin/stringifier_test.go:\\d+\ntesting.tRunner\n\t.*testing.go:\\d+.*"
		assert.Len(t, strings, 2)
		assert.Regexp(t, stackRegexp, strings[0])
		assert.Regexp(t, stackRegexp, strings[1])
	})
}

type WithString struct {
}

func (*WithString) String() string {
	return "string"
}

type WithoutString struct {
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
	t.Run("NilShouldReturnNil", func(t *testing.T) {
		objects := toObjects(nil)
		assert.Nil(t, objects)
	})
	t.Run("EmptyShouldReturnEmpty", func(t *testing.T) {
		objects := toObjects(make([]string, 0))
		assert.Empty(t, objects)
	})
	t.Run("ShouldReturnSliceOfObjects", func(t *testing.T) {
		objects := toObjects([]string{"foo", "bar"})
		assert.Equal(t, []any{"foo", "bar"}, objects)
	})
}
