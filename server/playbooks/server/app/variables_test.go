// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseVariablesAndValues(t *testing.T) {
	t.Run("Simple", func(t *testing.T) {
		res := parseVariablesAndValues(`
			$bar=one
			$five=star
		`)
		require.Equal(t, 2, len(res))
		require.Equal(t, "one", res["$bar"])
		require.Equal(t, "star", res["$five"])
	})

	t.Run("Variable Names: Match only lower case, upper case and underscore", func(t *testing.T) {
		res := parseVariablesAndValues(`
		 	This is a summary. This part of the summary will not be matched.
			My variables are:
			$a-to-z=NoMatch
			$a space=NoMatch
			$1_one=Match
			$a_2_z=Match
		`)
		require.Equal(t, 2, len(res))
		require.Equal(t, "Match", res["$1_one"])
		require.Equal(t, "Match", res["$a_2_z"])
	})

	t.Run("Variable Values", func(t *testing.T) {
		res := parseVariablesAndValues(`
		 	This is a summary. This part of the summary will not be matched.
			My variables are:
			$1_one=This is a match
			$a_2_z=This-is-also-a-match
			$version=v7.1.1
			$BRANCH=release/v7.1.1
		`)
		require.Equal(t, 4, len(res))
		require.Equal(t, "This is a match", res["$1_one"])
		require.Equal(t, "This-is-also-a-match", res["$a_2_z"])
		require.Equal(t, "v7.1.1", res["$version"])
		require.Equal(t, "release/v7.1.1", res["$BRANCH"])
	})
}

func TestParseVariables(t *testing.T) {
	t.Run("Simple", func(t *testing.T) {
		res := parseVariables(`/agenda queue $topic-$DATE`)
		require.Equal(t, []string{"$topic", "$DATE"}, res)
	})

	t.Run("Variable Names: Match only lower case, upper case and underscore", func(t *testing.T) {
		res := parseVariables(`/echo $a-to-$z extra $1_one$a_2_z`)
		require.Equal(t, []string{"$a", "$z", "$1_one", "$a_2_z"}, res)
	})
}
