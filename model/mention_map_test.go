// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func requireEqualValuesMaps(t *testing.T, one, two map[string][]string) {
	if len(one) != len(two) {
		require.FailNow(t, "Map lengths differ")
	}

	for oneKey, oneValue := range one {
		twoValue, ok := two[oneKey]
		if !ok {
			require.FailNowf(t, "Key %s is present in %v but not in %v", oneKey, one, two)
		}

		require.ElementsMatch(t, oneValue, twoValue)
	}
}
func requireEqualMentionMaps(t *testing.T, one, two map[string]string) {
	if len(one) != len(two) {
		require.FailNow(t, "Map lengths differ")
	}

	for oneKey, oneValue := range one {
		twoValue, ok := two[oneKey]
		if !ok {
			require.FailNowf(t, "Key %s is present in %v but not in %v", oneKey, one, two)
		}

		require.Equal(t, oneValue, twoValue)
	}
}

func TestUserMentionMapFromURLValues(t *testing.T) {
	fixture := []struct {
		values   url.Values
		expected UserMentionMap
		error    bool
	}{
		{
			url.Values{},
			nil,
			true,
		},
		{
			url.Values{
				UserMentionsKey:    []string{},
				UserMentionsIdsKey: []string{},
			},
			UserMentionMap{},
			false,
		},
		{
			url.Values{
				UserMentionsKey:    []string{"one", "two", "three"},
				UserMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
			},
			UserMentionMap{
				"one":   "oneId",
				"two":   "twoId",
				"three": "threeId",
			},
			false,
		},
		{
			url.Values{
				"wrongKey":         []string{"one", "two", "three"},
				UserMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				UserMentionsKey: []string{"one", "two", "three"},
				"wrongKey":      []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				UserMentionsKey:    []string{"one", "two"},
				UserMentionsIdsKey: []string{"justone"},
			},
			nil,
			true,
		},
	}

	for _, data := range fixture {
		actualMap, actualError := UserMentionMapFromURLValues(data.values)
		if data.error {
			require.Error(t, actualError)
			require.Nil(t, actualMap)
		} else {
			require.NoError(t, actualError)
			requireEqualMentionMaps(t, actualMap, data.expected)
		}
	}
}

func TestUserMentionMapToURLValues(t *testing.T) {
	fixture := []struct {
		mentionMap UserMentionMap
		expected   url.Values
	}{
		{
			UserMentionMap{},
			url.Values{},
		},
		{
			UserMentionMap{"user": "id"},
			url.Values{
				UserMentionsKey:    []string{"user"},
				UserMentionsIdsKey: []string{"id"},
			},
		},
		{
			UserMentionMap{"one": "id1", "two": "id2", "three": "id3"},
			url.Values{
				UserMentionsKey:    []string{"one", "two", "three"},
				UserMentionsIdsKey: []string{"id1", "id2", "id3"},
			},
		},
	}

	for _, data := range fixture {
		actualValues := data.mentionMap.ToURLValues()
		requireEqualValuesMaps(t, actualValues, data.expected)
	}
}

func TestChannelMentionMapFromURLValues(t *testing.T) {
	fixture := []struct {
		values   url.Values
		expected ChannelMentionMap
		error    bool
	}{
		{
			url.Values{},
			nil,
			true,
		},
		{
			url.Values{
				ChannelMentionsKey:    []string{},
				ChannelMentionsIdsKey: []string{},
			},
			ChannelMentionMap{},
			false,
		},
		{
			url.Values{
				ChannelMentionsKey:    []string{"one", "two", "three"},
				ChannelMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
			},
			ChannelMentionMap{
				"one":   "oneId",
				"two":   "twoId",
				"three": "threeId",
			},
			false,
		},
		{
			url.Values{
				"wrongKey":            []string{"one", "two", "three"},
				ChannelMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				ChannelMentionsKey: []string{"one", "two", "three"},
				"wrongKey":         []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				ChannelMentionsKey:    []string{"one", "two"},
				ChannelMentionsIdsKey: []string{"justone"},
			},
			nil,
			true,
		},
	}

	for _, data := range fixture {
		actualMap, actualError := ChannelMentionMapFromURLValues(data.values)
		if data.error {
			require.Error(t, actualError)
			require.Nil(t, actualMap)
		} else {
			require.NoError(t, actualError)
			requireEqualMentionMaps(t, actualMap, data.expected)
		}
	}
}

func TestChannelMentionMapToURLValues(t *testing.T) {
	fixture := []struct {
		mentionMap ChannelMentionMap
		expected   url.Values
	}{
		{
			ChannelMentionMap{},
			url.Values{},
		},
		{
			ChannelMentionMap{"user": "id"},
			url.Values{
				ChannelMentionsKey:    []string{"user"},
				ChannelMentionsIdsKey: []string{"id"},
			},
		},
		{
			ChannelMentionMap{"one": "id1", "two": "id2", "three": "id3"},
			url.Values{
				ChannelMentionsKey:    []string{"one", "two", "three"},
				ChannelMentionsIdsKey: []string{"id1", "id2", "id3"},
			},
		},
	}

	for _, data := range fixture {
		actualValues := data.mentionMap.ToURLValues()
		requireEqualValuesMaps(t, actualValues, data.expected)
	}
}
