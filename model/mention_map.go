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
	UserMentionsKey       = "user_mentions"
	UserMentionsIdsKey    = "user_mentions_ids"
	ChannelMentionsKey    = "channel_mentions"
	ChannelMentionsIdsKey = "channel_mentions_ids"
)

func UserMentionMapFromURLValues(values url.Values) (UserMentionMap, error) {
	return mentionsFromURLValues(values, UserMentionsKey, UserMentionsIdsKey)
}

func (m UserMentionMap) ToURLValues() url.Values {
	return mentionsToURLValues(m, UserMentionsKey, UserMentionsIdsKey)
}
func ChannelMentionMapFromURLValues(values url.Values) (ChannelMentionMap, error) {
	return mentionsFromURLValues(values, ChannelMentionsKey, ChannelMentionsIdsKey)
}

func (m ChannelMentionMap) ToURLValues() url.Values {
	return mentionsToURLValues(m, ChannelMentionsKey, ChannelMentionsIdsKey)
}

func mentionsFromURLValues(values url.Values, mentionKey, idKey string) (map[string]string, error) {
	mentions, ok := values[mentionKey]
	if !ok {
		return nil, fmt.Errorf("%s key not found", mentionKey)
	}

	ids, ok := values[idKey]
	if !ok {
		return nil, fmt.Errorf("%s key not found", idKey)
	}

	if len(mentions) != len(ids) {
		return nil, fmt.Errorf("keys %s and %s have different length", mentionKey, idKey)
	}

	mentionsMap := make(map[string]string)
	for i, mention := range mentions {
		mentionsMap[mention] = ids[i]
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
