// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestSlackConvertTimeStamp(t *testing.T) {
	assert.EqualValues(t, SlackConvertTimeStamp("1469785419.000033"), 1469785419000)
}

func TestSlackConvertChannelName(t *testing.T) {
	for _, tc := range []struct {
		nameInput string
		idInput   string
		output    string
	}{
		{"test-channel", "C0G08DLQH", "test-channel"},
		{"_test_channel_", "C0G04DLQH", "test_channel"},
		{"__test", "C0G07DLQH", "test"},
		{"-t", "C0G06DLQH", "slack-channel-t"},
		{"a", "C0G05DLQH", "slack-channel-a"},
		{"случайный", "C0G05DLQD", "c0g05dlqd"},
	} {
		assert.Equal(t, SlackConvertChannelName(tc.nameInput, tc.idInput), tc.output, "nameInput = %v", tc.nameInput)
	}
}

func TestSlackConvertUserMentions(t *testing.T) {
	users := []SlackUser{
		{Id: "U00000A0A", Username: "firstuser"},
		{Id: "U00000B1B", Username: "seconduser"},
	}

	posts := map[string][]SlackPost{
		"test-channel": {
			{
				Text: "<!channel>: Hi guys.",
			},
			{
				Text: "Calling <!here|@here>.",
			},
			{
				Text: "Yo <!everyone>.",
			},
			{
				Text: "Regular user test <@U00000B1B|seconduser> and <@U00000A0A>.",
			},
		},
	}

	expectedPosts := map[string][]SlackPost{
		"test-channel": {
			{
				Text: "@channel: Hi guys.",
			},
			{
				Text: "Calling @here.",
			},
			{
				Text: "Yo @all.",
			},
			{
				Text: "Regular user test @seconduser and @firstuser.",
			},
		},
	}

	assert.Equal(t, expectedPosts, SlackConvertUserMentions(users, posts))
}

func TestSlackConvertChannelMentions(t *testing.T) {
	channels := []SlackChannel{
		{Id: "C000AA00A", Name: "one"},
		{Id: "C000BB11B", Name: "two"},
	}

	posts := map[string][]SlackPost{
		"test-channel": {
			{
				Text: "Go to <#C000AA00A>.",
			},
			{
				User: "U00000A0A",
				Text: "Try <#C000BB11B|two> for this.",
			},
		},
	}

	expectedPosts := map[string][]SlackPost{
		"test-channel": {
			{
				Text: "Go to ~one.",
			},
			{
				User: "U00000A0A",
				Text: "Try ~two for this.",
			},
		},
	}

	assert.Equal(t, expectedPosts, SlackConvertChannelMentions(channels, posts))
}

func TestSlackParseChannels(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-channels.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := SlackParseChannels(file, "O")
	require.NoError(t, err)
	assert.Equal(t, 6, len(channels))
}

func TestSlackParseDirectMessages(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-direct-messages.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := SlackParseChannels(file, "D")
	require.NoError(t, err)
	assert.Equal(t, 4, len(channels))
}

func TestSlackParsePrivateChannels(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-private-channels.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := SlackParseChannels(file, "P")
	require.NoError(t, err)
	assert.Equal(t, 1, len(channels))
}

func TestSlackParseGroupDirectMessages(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-group-direct-messages.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := SlackParseChannels(file, "G")
	require.NoError(t, err)
	assert.Equal(t, 3, len(channels))
}

func TestSlackParseUsers(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-users.json")
	require.NoError(t, err)
	defer file.Close()

	users, err := SlackParseUsers(file)
	require.NoError(t, err)
	assert.Equal(t, 11, len(users))
}

func TestSlackParsePosts(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-posts.json")
	require.NoError(t, err)
	defer file.Close()

	posts, err := SlackParsePosts(file)
	require.NoError(t, err)
	assert.Equal(t, 9, len(posts))
}

func TestSlackParseMultipleAttachments(t *testing.T) {
	file, err := os.Open("tests/slack-import-test-posts.json")
	require.NoError(t, err)
	defer file.Close()

	posts, err := SlackParsePosts(file)
	require.NoError(t, err)
	assert.Equal(t, 2, len(posts[8].Files))
}

func TestSlackSanitiseChannelProperties(t *testing.T) {
	c1 := model.Channel{
		DisplayName: "display-name",
		Name:        "name",
		Purpose:     "The channel purpose",
		Header:      "The channel header",
	}

	c1s := SlackSanitiseChannelProperties(c1)
	assert.Equal(t, c1, c1s)

	c2 := model.Channel{
		DisplayName: strings.Repeat("abcdefghij", 7),
		Name:        strings.Repeat("abcdefghij", 7),
		Purpose:     strings.Repeat("0123456789", 30),
		Header:      strings.Repeat("0123456789", 120),
	}

	c2s := SlackSanitiseChannelProperties(c2)
	assert.Equal(t, model.Channel{
		DisplayName: strings.Repeat("abcdefghij", 6) + "abcd",
		Name:        strings.Repeat("abcdefghij", 6) + "abcd",
		Purpose:     strings.Repeat("0123456789", 25),
		Header:      strings.Repeat("0123456789", 102) + "0123",
	}, c2s)
}

func TestSlackConvertPostsMarkup(t *testing.T) {
	input := make(map[string][]SlackPost)
	input["test"] = []SlackPost{
		{
			Text: "This message contains a link to <https://google.com|Google>.",
		},
		{
			Text: "This message contains a mailto link to <mailto:me@example.com|me@example.com> in it.",
		},
		{
			Text: "This message contains a *bold* word.",
		},
		{
			Text: "This is not a * bold * word.",
		},
		{
			Text: `There is *no bold word
in this*.`,
		},
		{
			Text: "*This* is not a*bold* word.*This* is a bold word, *and* this; *and* this too.",
		},
		{
			Text: "This message contains a ~strikethrough~ word.",
		},
		{
			Text: "This is not a ~ strikethrough ~ word.",
		},
		{
			Text: `There is ~no strikethrough word
in this~.`,
		},
		{
			Text: "~This~ is not a~strikethrough~ word.~This~ is a strikethrough word, ~and~ this; ~and~ this too.",
		},
		{
			Text: `This message contains multiple paragraphs blockquotes
&gt;&gt;&gt;first
second
third`,
		},
		{
			Text: `This message contains single paragraph blockquotes
&gt;something
&gt;another thing`,
		},
		{
			Text: "This message has no > block quote",
		},
	}

	expectedOutput := make(map[string][]SlackPost)
	expectedOutput["test"] = []SlackPost{
		{
			Text: "This message contains a link to [Google](https://google.com).",
		},
		{
			Text: "This message contains a mailto link to [me@example.com](mailto:me@example.com) in it.",
		},
		{
			Text: "This message contains a **bold** word.",
		},
		{
			Text: "This is not a * bold * word.",
		},
		{
			Text: `There is *no bold word
in this*.`,
		},
		{
			Text: "**This** is not a*bold* word.**This** is a bold word, **and** this; **and** this too.",
		},
		{
			Text: "This message contains a ~~strikethrough~~ word.",
		},
		{
			Text: "This is not a ~ strikethrough ~ word.",
		},
		{
			Text: `There is ~no strikethrough word
in this~.`,
		},
		{
			Text: "~~This~~ is not a~strikethrough~ word.~~This~~ is a strikethrough word, ~~and~~ this; ~~and~~ this too.",
		},
		{
			Text: `This message contains multiple paragraphs blockquotes
>first
>second
>third`,
		},
		{
			Text: `This message contains single paragraph blockquotes
>something
>another thing`,
		},
		{
			Text: "This message has no > block quote",
		},
	}

	assert.Equal(t, expectedOutput, SlackConvertPostsMarkup(input))
}
