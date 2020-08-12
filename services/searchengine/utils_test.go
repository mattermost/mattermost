// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestElasticsearchGetSuggestionsSplitBy(t *testing.T) {
	testCases := []struct {
		Name     string
		Term     string
		SplitStr string ``
		Expected []string
	}{
		{
			Name:     "Single string",
			Term:     "string",
			SplitStr: " ",
			Expected: []string{"string"},
		},
		{
			Name:     "String with spaces",
			Term:     "String with spaces",
			SplitStr: " ",
			Expected: []string{"string with spaces", "with spaces", "spaces"},
		},
		{
			Name:     "Username split by a dot",
			Term:     "name.surname",
			SplitStr: ".",
			Expected: []string{"name.surname", ".surname", "surname"},
		},
		{
			Name:     "String split by several dashes",
			Term:     "one-two-three",
			SplitStr: "-",
			Expected: []string{"one-two-three", "-two-three", "two-three", "-three", "three"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			res := GetSuggestionInputsSplitBy(tc.Term, tc.SplitStr)
			assert.ElementsMatch(t, res, tc.Expected)
		})
	}
}

func TestElasticsearchGetSuggestionsSplitByMultiple(t *testing.T) {
	r1 := GetSuggestionInputsSplitByMultiple("String with user.name", []string{" ", "."})
	expectedR1 := []string{"string with user.name", "with user.name", "user.name", ".name", "name"}
	assert.ElementsMatch(t, r1, expectedR1)
}
