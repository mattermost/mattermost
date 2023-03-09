// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserMentionMapFromURLValues(t *testing.T) {
	fixture := []struct {
		values   url.Values
		expected UserMentionMap
		error    bool
	}{
		{
			url.Values{},
			UserMentionMap{},
			false,
		},
		{
			url.Values{
				userMentionsKey:    []string{},
				userMentionsIdsKey: []string{},
			},
			UserMentionMap{},
			false,
		},
		{
			url.Values{
				userMentionsKey:    []string{"one", "two", "three"},
				userMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
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
				userMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				userMentionsKey: []string{"one", "two", "three"},
				"wrongKey":      []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				userMentionsKey:    []string{"one", "two"},
				userMentionsIdsKey: []string{"justone"},
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
			require.Equal(t, actualMap, data.expected)
		}
	}
}

func TestUserMentionMap_ToURLValues(t *testing.T) {
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
				userMentionsKey:    []string{"user"},
				userMentionsIdsKey: []string{"id"},
			},
		},
		{
			UserMentionMap{"one": "id1", "two": "id2", "three": "id3"},
			url.Values{
				userMentionsKey:    []string{"one", "two", "three"},
				userMentionsIdsKey: []string{"id1", "id2", "id3"},
			},
		},
	}

	for _, data := range fixture {
		actualValues := data.mentionMap.ToURLValues()

		// require.EqualValues does not work here directly on the url.Values, as
		// the slices in the map values may be in different order; what we need to
		// check is that the pairs are preserved, which can be checked converting
		// back to a map with FromURLValues. We check that the test is well-formed
		// by converting back the expected url.Values too.
		require.Len(t, actualValues, len(data.expected))

		actualMentionMap, actualErr := UserMentionMapFromURLValues(actualValues)
		expectedMentionMap, expectedErr := UserMentionMapFromURLValues(data.expected)

		require.Equal(t, actualErr, expectedErr)
		require.Equal(t, actualMentionMap, expectedMentionMap)
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
			ChannelMentionMap{},
			false,
		},
		{
			url.Values{
				channelMentionsKey:    []string{},
				channelMentionsIdsKey: []string{},
			},
			ChannelMentionMap{},
			false,
		},
		{
			url.Values{
				channelMentionsKey:    []string{"one", "two", "three"},
				channelMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
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
				channelMentionsIdsKey: []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				channelMentionsKey: []string{"one", "two", "three"},
				"wrongKey":         []string{"oneId", "twoId", "threeId"},
			},
			nil,
			true,
		},
		{
			url.Values{
				channelMentionsKey:    []string{"one", "two"},
				channelMentionsIdsKey: []string{"justone"},
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
			require.Equal(t, actualMap, data.expected)
		}
	}
}

func TestChannelMentionMap_ToURLValues(t *testing.T) {
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
				channelMentionsKey:    []string{"user"},
				channelMentionsIdsKey: []string{"id"},
			},
		},
		{
			ChannelMentionMap{"one": "id1", "two": "id2", "three": "id3"},
			url.Values{
				channelMentionsKey:    []string{"one", "two", "three"},
				channelMentionsIdsKey: []string{"id1", "id2", "id3"},
			},
		},
	}

	for _, data := range fixture {
		actualValues := data.mentionMap.ToURLValues()

		// require.EqualValues does not work here directly on the url.Values, as
		// the slices in the map values may be in different order; what we need to
		// check is that the pairs are preserved, which can be checked converting
		// back to a map with FromURLValues. We check that the test is well-formed
		// by converting back the expected url.Values too.
		require.Len(t, actualValues, len(data.expected))

		actualMentionMap, actualErr := ChannelMentionMapFromURLValues(actualValues)
		expectedMentionMap, expectedErr := ChannelMentionMapFromURLValues(data.expected)

		require.Equal(t, actualErr, expectedErr)
		require.Equal(t, actualMentionMap, expectedMentionMap)
	}
}
