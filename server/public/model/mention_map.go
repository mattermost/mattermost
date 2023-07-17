// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/url"
)

type UserMentionMap map[string]string
type ChannelMentionMap map[string]string

const (
	userMentionsKey       = "user_mentions"
	userMentionsIdsKey    = "user_mentions_ids"
	channelMentionsKey    = "channel_mentions"
	channelMentionsIdsKey = "channel_mentions_ids"
)

func UserMentionMapFromURLValues(values url.Values) (UserMentionMap, error) {
	return mentionsFromURLValues(values, userMentionsKey, userMentionsIdsKey)
}

func (m UserMentionMap) ToURLValues() url.Values {
	return mentionsToURLValues(m, userMentionsKey, userMentionsIdsKey)
}

func ChannelMentionMapFromURLValues(values url.Values) (ChannelMentionMap, error) {
	return mentionsFromURLValues(values, channelMentionsKey, channelMentionsIdsKey)
}

func (m ChannelMentionMap) ToURLValues() url.Values {
	return mentionsToURLValues(m, channelMentionsKey, channelMentionsIdsKey)
}

func mentionsFromURLValues(values url.Values, mentionKey, idKey string) (map[string]string, error) {
	mentions, mentionsOk := values[mentionKey]
	ids, idsOk := values[idKey]

	if !mentionsOk && !idsOk {
		return map[string]string{}, nil
	}

	if !mentionsOk {
		return nil, fmt.Errorf("%s key not found", mentionKey)
	}

	if !idsOk {
		return nil, fmt.Errorf("%s key not found", idKey)
	}

	if len(mentions) != len(ids) {
		return nil, fmt.Errorf("keys %s and %s have different length", mentionKey, idKey)
	}

	mentionsMap := make(map[string]string)
	for i, mention := range mentions {
		id := ids[i]

		if oldId, ok := mentionsMap[mention]; ok && oldId != id {
			return nil, fmt.Errorf("key %s has two different values: %s and %s", mention, oldId, id)
		}

		mentionsMap[mention] = id
	}

	return mentionsMap, nil
}

func mentionsToURLValues(mentions map[string]string, mentionKey, idKey string) url.Values {
	values := url.Values{}

	for mention, id := range mentions {
		values.Add(mentionKey, mention)
		values.Add(idKey, id)
	}

	return values
}
