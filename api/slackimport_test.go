// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"os"
	"strings"
	"testing"
)

func TestSlackConvertTimeStamp(t *testing.T) {

	testTimeStamp := "1469785419.000033"

	result := SlackConvertTimeStamp(testTimeStamp)

	if result != 1469785419000 {
		t.Fatalf("Unexpected timestamp value %v returned.", result)
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
			t.Fatalf("Did not convert channel name correctly: %v", td.input)
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
				t.Fatalf("Converted post text not as expected: %v", post.Text)
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
				Text: "Go to ~one.",
			},
			{
				Text: "Try ~two for this.",
			},
		},
	}

	convertedPosts := SlackConvertChannelMentions(channels, posts)

	for channelName, channelPosts := range convertedPosts {
		for postIdx, post := range channelPosts {
			if post.Text != expectedPosts[channelName][postIdx].Text {
				t.Fatalf("Converted post text not as expected: %v", post.Text)
			}
		}
	}

}

func TestSlackParseChannels(t *testing.T) {
	file, err := os.Open("../tests/slack-import-test-channels.json")
	if err != nil {
		t.Fatalf("Failed to open data file: %v", err)
	}

	channels, err := SlackParseChannels(file)
	if err != nil {
		t.Fatalf("Error occurred parsing channels: %v", err)
	}

	if len(channels) != 6 {
		t.Fatalf("Unexpected number of channels: %v", len(channels))
	}
}

func TestSlackParseUsers(t *testing.T) {
	file, err := os.Open("../tests/slack-import-test-users.json")
	if err != nil {
		t.Fatalf("Failed to open data file: %v", err)
	}

	users, err := SlackParseUsers(file)
	if err != nil {
		t.Fatalf("Error occurred parsing users: %v", err)
	}

	if len(users) != 11 {
		t.Fatalf("Unexpected number of users: %v", len(users))
	}
}

func TestSlackParsePosts(t *testing.T) {
	file, err := os.Open("../tests/slack-import-test-posts.json")
	if err != nil {
		t.Fatalf("Failed to open data file: %v", err)
	}

	posts, err := SlackParsePosts(file)
	if err != nil {
		t.Fatalf("Error occurred parsing posts: %v", err)
	}

	if len(posts) != 8 {
		t.Fatalf("Unexpected number of posts: %v", len(posts))
	}
}

func TestSlackSanitiseChannelProperties(t *testing.T) {
	c1 := model.Channel{
		DisplayName: "display-name",
		Name:        "name",
		Purpose:     "The channel purpose",
		Header:      "The channel header",
	}

	c1s := SlackSanitiseChannelProperties(c1)
	if c1.DisplayName != c1s.DisplayName || c1.Name != c1s.Name || c1.Purpose != c1s.Purpose || c1.Header != c1s.Header {
		t.Fatalf("Unexpected alterations to the channel properties.")
	}

	c2 := model.Channel{
		DisplayName: strings.Repeat("abcdefghij", 7),
		Name:        strings.Repeat("abcdefghij", 7),
		Purpose:     strings.Repeat("0123456789", 30),
		Header:      strings.Repeat("0123456789", 120),
	}

	c2s := SlackSanitiseChannelProperties(c2)
	if c2s.DisplayName != strings.Repeat("abcdefghij", 6)+"abcd" {
		t.Fatalf("Unexpected alterations to the channel properties: %v", c2s.DisplayName)
	}

	if c2s.Name != strings.Repeat("abcdefghij", 6)+"abcd" {
		t.Fatalf("Unexpected alterations to the channel properties: %v", c2s.Name)
	}

	if c2s.Purpose != strings.Repeat("0123456789", 25) {
		t.Fatalf("Unexpected alterations to the channel properties: %v", c2s.Purpose)
	}

	if c2s.Header != strings.Repeat("0123456789", 102)+"0123" {
		t.Fatalf("Unexpected alterations to the channel properties: %v", c2s.Header)
	}
}
