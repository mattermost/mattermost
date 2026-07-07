// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCommandArgs_Auditable(t *testing.T) {
	t.Run("includes connection_id in auditable output", func(t *testing.T) {
		args := CommandArgs{
			UserId:       "user-id",
			ChannelId:    "channel-id",
			TeamId:       "team-id",
			RootId:       "root-id",
			ParentId:     "parent-id",
			TriggerId:    "trigger-id",
			ConnectionId: "connection-id-123",
			Command:      "/test command",
			SiteURL:      "http://localhost:8065",
		}

		auditable := args.Auditable()

		require.Equal(t, "user-id", auditable["user_id"])
		require.Equal(t, "channel-id", auditable["channel_id"])
		require.Equal(t, "team-id", auditable["team_id"])
		require.Equal(t, "root-id", auditable["root_id"])
		require.Equal(t, "parent-id", auditable["parent_id"])
		require.Equal(t, "trigger-id", auditable["trigger_id"])
		require.Equal(t, "connection-id-123", auditable["connection_id"])
		require.Equal(t, "/test command", auditable["command"])
		require.Equal(t, "http://localhost:8065", auditable["site_url"])
	})

	t.Run("includes empty connection_id when not set", func(t *testing.T) {
		args := CommandArgs{
			UserId:  "user-id",
			Command: "/test",
		}

		auditable := args.Auditable()

		require.Equal(t, "", auditable["connection_id"])
	})
}

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
