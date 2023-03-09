// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCommandArgs_AddUserMention(t *testing.T) {
	fixture := []struct {
		args     CommandArgs
		mentions map[string]string
		expected CommandArgs
	}{
		{
			CommandArgs{},
			map[string]string{"one": "1"},
			CommandArgs{
				UserMentions: map[string]string{"one": "1"},
			},
		},
		{
			CommandArgs{
				ChannelMentions: map[string]string{"channel": "1"},
			},
			map[string]string{"one": "1"},
			CommandArgs{
				UserMentions:    map[string]string{"one": "1"},
				ChannelMentions: map[string]string{"channel": "1"},
			},
		},
		{
			CommandArgs{
				UserMentions: map[string]string{"one": "1"},
			},
			map[string]string{"one": "1"},
			CommandArgs{
				UserMentions: map[string]string{"one": "1"},
			},
		},
		{
			CommandArgs{},
			map[string]string{"one": "1", "two": "2", "three": "3"},
			CommandArgs{
				UserMentions: map[string]string{"one": "1", "two": "2", "three": "3"},
			},
		},
	}

	for _, data := range fixture {
		for name, id := range data.mentions {
			data.args.AddUserMention(name, id)
		}
		require.Equal(t, data.args, data.expected)
	}
}

func TestCommandArgs_AddChannelMention(t *testing.T) {
	fixture := []struct {
		args     CommandArgs
		mentions map[string]string
		expected CommandArgs
	}{
		{
			CommandArgs{},
			map[string]string{"one": "1"},
			CommandArgs{
				ChannelMentions: map[string]string{"one": "1"},
			},
		},
		{
			CommandArgs{
				UserMentions: map[string]string{"user": "1"},
			},
			map[string]string{"one": "1"},
			CommandArgs{
				ChannelMentions: map[string]string{"one": "1"},
				UserMentions:    map[string]string{"user": "1"},
			},
		},
		{
			CommandArgs{
				ChannelMentions: map[string]string{"one": "1"},
			},
			map[string]string{"one": "1"},
			CommandArgs{
				ChannelMentions: map[string]string{"one": "1"},
			},
		},
		{
			CommandArgs{},
			map[string]string{"one": "1", "two": "2", "three": "3"},
			CommandArgs{
				ChannelMentions: map[string]string{"one": "1", "two": "2", "three": "3"},
			},
		},
	}

	for _, data := range fixture {
		for name, id := range data.mentions {
			data.args.AddChannelMention(name, id)
		}
		require.Equal(t, data.args, data.expected)
	}
}
