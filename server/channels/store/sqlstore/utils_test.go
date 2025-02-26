// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMapStringsToQueryParams(t *testing.T) {
	t.Run("one item", func(t *testing.T) {
		input := []string{"apple"}

		keys, params := MapStringsToQueryParams(input, "Fruit")

		require.Len(t, params, 1, "returned incorrect params", params)
		require.Equal(t, "apple", params["Fruit0"], "returned incorrect params", params)
		require.Equal(t, "(:Fruit0)", keys, "returned incorrect query", keys)
	})

	t.Run("multiple items", func(t *testing.T) {
		input := []string{"carrot", "tomato", "potato"}

		keys, params := MapStringsToQueryParams(input, "Vegetable")

		require.Len(t, params, 3, "returned incorrect params", params)
		require.Equal(t, "carrot", params["Vegetable0"], "returned incorrect params", params)
		require.Equal(t, "tomato", params["Vegetable1"], "returned incorrect params", params)
		require.Equal(t, "potato", params["Vegetable2"], "returned incorrect params", params)
		require.Equal(t, "(:Vegetable0,:Vegetable1,:Vegetable2)", keys, "returned incorrect query", keys)
	})
}

var keys string
var params map[string]any

func BenchmarkMapStringsToQueryParams(b *testing.B) {
	b.Run("one item", func(b *testing.B) {
		input := []string{"apple"}
		for i := 0; i < b.N; i++ {
			keys, params = MapStringsToQueryParams(input, "Fruit")
		}
	})
	b.Run("multiple items", func(b *testing.B) {
		input := []string{"carrot", "tomato", "potato"}
		for i := 0; i < b.N; i++ {
			keys, params = MapStringsToQueryParams(input, "Vegetable")
		}
	})
}

func TestSanitizeSearchTerm(t *testing.T) {
	term := "test"
	result := sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, term)

	term = "%%%"
	expected := "\\%\\%\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "%\\%\\%"
	expected = "\\%\\%\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "%_test_%"
	expected = "\\%\\_test\\_\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "**test_%"
	expected = "test*_*%"
	result = sanitizeSearchTerm(term, "*")
	require.Equal(t, result, expected)
}

func TestRemoveNonAlphaNumericUnquotedTerms(t *testing.T) {
	const (
		sep           = " "
		chineseHello  = "你好"
		japaneseHello = "こんにちは"
	)
	tests := []struct {
		term string
		want string
		name string
	}{
		{term: "", want: "", name: "empty"},
		{term: "h", want: "h", name: "singleChar"},
		{term: "hello", want: "hello", name: "multiChar"},
		{term: `hel*lo "**" **& hello`, want: `hel*lo "**" hello`, name: "quoted_unquoted_english"},
		{term: japaneseHello + chineseHello, want: japaneseHello + chineseHello, name: "japanese_chinese"},
		{term: japaneseHello + ` "*" ` + chineseHello, want: japaneseHello + ` "*" ` + chineseHello, name: `quoted_japanese_and_chinese`},
		{term: japaneseHello + ` "*" &&* ` + chineseHello, want: japaneseHello + ` "*" ` + chineseHello, name: "quoted_unquoted_japanese_and_chinese"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := removeNonAlphaNumericUnquotedTerms(test.term, sep)
			require.Equal(t, test.want, got)
		})
	}
}

func TestMySQLJSONArgs(t *testing.T) {
	tests := []struct {
		props     map[string]string
		args      []any
		argString string
	}{
		{
			props: map[string]string{
				"desktop": "linux",
				"mobile":  "android",
				"notify":  "always",
			},
			args:      []any{"$.desktop", "linux", "$.mobile", "android", "$.notify", "always"},
			argString: "?, ?, ?, ?, ?, ?",
		},
		{
			props:     map[string]string{},
			args:      nil,
			argString: "",
		},
	}

	for _, test := range tests {
		args, argString := constructMySQLJSONArgs(test.props)
		assert.ElementsMatch(t, test.args, args)
		assert.Equal(t, test.argString, argString)
	}
}
