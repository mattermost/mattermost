// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestSlackConvertTimeStamp(t *testing.T) {

	testTimeStamp := "1469785419.000033"

	result := SlackConvertTimeStamp(testTimeStamp)

	if result != 1469785419000 {
		t.Fatalf("Unexpected timestamp value %d returned.", result)
	}
}

func TestSlackConvertChannelName(t *testing.T) {
	var testData = []struct {
		input  string
		output string
	}{
		{"test-channel", "test-channel"},
		{"_test_channel_", "test_channel"},
		{"__test", "test"},
		{"-t", "slack-channel-t"},
		{"a", "slack-channel-a"},
	}

	for _, td := range testData {
		if td.output != SlackConvertChannelName(td.input) {
			t.Fatalf("Did not convert channel name correctly: %s", td.input)
		}
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

	convertedPosts := SlackConvertUserMentions(users, posts)

	for channelName, channelPosts := range convertedPosts {
		for postIdx, post := range channelPosts {
			if post.Text != expectedPosts[channelName][postIdx].Text {
				t.Fatalf("Converted post text not as expected: %s", post.Text)
			}
		}
	}
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
				Text: "Go to !one.",
			},
			{
				Text: "Try !two for this.",
			},
		},
	}

	convertedPosts := SlackConvertChannelMentions(channels, posts)

	for channelName, channelPosts := range convertedPosts {
		for postIdx, post := range channelPosts {
			if post.Text != expectedPosts[channelName][postIdx].Text {
				t.Fatalf("Converted post text not as expected: %s", post.Text)
			}
		}
	}

}
