// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jsonutils_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/utils/jsonutils"
)

func TestHumanizeJsonError(t *testing.T) {
	t.Parallel()

	type testType struct{}

	testCases := []struct {
		Description string
		Data        []byte
		Err         error
		ExpectedErr string
	}{
		{
			"nil error",
			[]byte{},
			nil,
			"",
		},
		{
			"non-special error",
			[]byte{},
			errors.New("test"),
			"test",
		},
		{
			"syntax error, offset -1, before start of string",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: -1,
			},
			"invalid offset -1: ",
		},
		{
			"syntax error, offset 0, start of string",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 0,
			},
			"parsing error at line 1, character 1: ",
		},
		{
			"syntax error, offset 5, end of line 1",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 5,
			},
			"parsing error at line 1, character 6: ",
		},
		{
			"syntax error, offset 6, new line at end end of line 1",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 6,
			},
			"parsing error at line 1, character 7: ",
		},
		{
			"syntax error, offset 7, start of line 2",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 7,
			},
			"parsing error at line 2, character 1: ",
		},
		{
			"syntax error, offset 12, end of line 2",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 12,
			},
			"parsing error at line 2, character 6: ",
		},
		{
			"syntax error, offset 13, newline at end of line 2",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 13,
			},
			"parsing error at line 2, character 7: ",
		},
		{
			"syntax error, offset 17, middle of line 3",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 17,
			},
			"parsing error at line 3, character 4: ",
		},
		{
			"syntax error, offset 19, end of string",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 19,
			},
			"parsing error at line 3, character 6: ",
		},
		{
			"syntax error, offset 20, offset = length of string",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 20,
			},
			"parsing error at line 3, character 7: ",
		},
		{
			"syntax error, offset 21, offset = length of string, after newline",
			[]byte("line 1\nline 2\nline 3\n"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 21,
			},
			"parsing error at line 4, character 1: ",
		},
		{
			"syntax error, offset 21, offset > length of string",
			[]byte("line 1\nline 2\nline 3"),
			&json.SyntaxError{
				// msg can't be set
				Offset: 21,
			},
			"invalid offset 21: ",
		},
		{
			"unmarshal type error, offset 0, start of string",
			[]byte("line 1\nline 2\nline 3"),
			&json.UnmarshalTypeError{
				Value:  "bool",
				Type:   reflect.TypeOf(testType{}),
				Offset: 0,
				Struct: "struct",
				Field:  "field",
			},
			"parsing error at line 1, character 1: json: cannot unmarshal bool into Go struct field struct.field of type jsonutils_test.testType",
		},
		{
			"unmarshal type error, offset 17, middle of line 3",
			[]byte("line 1\nline 2\nline 3"),
			&json.UnmarshalTypeError{
				Value:  "bool",
				Type:   reflect.TypeOf(testType{}),
				Offset: 17,
				Struct: "struct",
				Field:  "field",
			},
			"parsing error at line 3, character 4: json: cannot unmarshal bool into Go struct field struct.field of type jsonutils_test.testType",
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			actual := jsonutils.HumanizeJsonError(testCase.Data, testCase.Err)
			if testCase.ExpectedErr == "" {
				assert.NoError(t, actual)
			} else {
				assert.EqualError(t, actual, testCase.ExpectedErr)
			}
		})
	}
}
