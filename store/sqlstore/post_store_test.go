// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/stretchr/testify/require"
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/searchtest"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
)

func TestPostStore(t *testing.T) {
	StoreTestWithSqlSupplier(t, storetest.TestPostStore)
}

func TestSearchPostStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchPostStore)
}

func TestMysqlStopWords(t *testing.T) {
	t.Run("Should not remove part of a word containg stop words", func(t *testing.T) {
		cases := []string{"whereabouts", "wherein", "tothis", "thisorthat", "waswhen", "whowas", "inthe", "whowill", "thewww"}
		for _, term := range cases {
			got, err := removeMysqlStopWordsFromTerms(term)
			require.NoError(t, err)
			require.Equal(t, term, got)
		}
	})

	t.Run("Should remove all words from terms", func(t *testing.T) {
		cases := []string{"where about", "where in", "to this", "this or that", "was when", "who was", "in the", "who will", "the www"}
		for _, term := range cases {
			got, err := removeMysqlStopWordsFromTerms(term)
			require.NoError(t, err)
			require.Empty(t, got)
		}
	})

	t.Run("Should not remove part of a word containg stop words separated by hyphens", func(t *testing.T) {
		cases := []string{"where-about", "where-in", "to-this", "this-or-that", "was-when", "who-was", "in-the", "who-will", "the-www"}
		for _, term := range cases {
			got, err := removeMysqlStopWordsFromTerms(term)
			require.NoError(t, err)
			require.Equal(t, term, got)
		}
	})
}
