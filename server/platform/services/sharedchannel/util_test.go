// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func Test_mungUsername(t *testing.T) {
	type args struct {
		username   string
		remotename string
		suffix     string
		maxLen     int
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{"everything empty", args{username: "", remotename: "", suffix: "", maxLen: 64}, ":"},

		{"no trunc, no suffix", args{username: "bart", remotename: "example.com", suffix: "", maxLen: 64}, "bart:example.com"},
		{"no trunc, suffix", args{username: "bart", remotename: "example.com", suffix: "2", maxLen: 64}, "bart-2:example.com"},

		{"trunc remote, no suffix", args{username: "bart", remotename: "example1234567890.com", suffix: "", maxLen: 24}, "bart:example123456789..."},
		{"trunc remote, suffix", args{username: "bart", remotename: "example1234567890.com", suffix: "2", maxLen: 24}, "bart-2:example1234567..."},

		{"trunc both, no suffix", args{username: R(24, "A"), remotename: R(24, "B"), suffix: "", maxLen: 24}, "AAAAAAAAA...:BBBBBBBB..."},
		{"trunc both, suffix", args{username: R(24, "A"), remotename: R(24, "B"), suffix: "10", maxLen: 24}, "AAAAAA-10...:BBBBBBBB..."},

		{"trunc user, no suffix", args{username: R(40, "A"), remotename: "abc", suffix: "", maxLen: 24}, "AAAAAAAAAAAAAAAAA...:abc"},
		{"trunc user, suffix", args{username: R(40, "A"), remotename: "abc", suffix: "11", maxLen: 24}, "AAAAAAAAAAAAAA-11...:abc"},

		{"trunc user, remote, no suffix", args{username: R(40, "A"), remotename: "abcdefghijk", suffix: "", maxLen: 24}, "AAAAAAAAA...:abcdefghijk"},
		{"trunc user, remote, suffix", args{username: R(40, "A"), remotename: "abcdefghijk", suffix: "19", maxLen: 24}, "AAAAAA-19...:abcdefghijk"},

		{"short user, long remote, no suffix", args{username: "bart", remotename: R(40, "B"), suffix: "", maxLen: 24}, "bart:BBBBBBBBBBBBBBBB..."},
		{"long user, short remote, no suffix", args{username: R(40, "A"), remotename: "abc.com", suffix: "", maxLen: 24}, "AAAAAAAAAAAAA...:abc.com"},

		{"short user, long remote, suffix", args{username: "bart", remotename: R(40, "B"), suffix: "12", maxLen: 24}, "bart-12:BBBBBBBBBBBBB..."},
		{"long user, short remote, suffix", args{username: R(40, "A"), remotename: "abc.com", suffix: "12", maxLen: 24}, "AAAAAAAAAA-12...:abc.com"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := mungUsername(tt.args.username, tt.args.remotename, tt.args.suffix, tt.args.maxLen); got != tt.want {
				t.Errorf("mungUsername() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_mungUsernameFuzz(t *testing.T) {
	// ensure no index out of bounds panic for any combination
	for i := 0; i < 70; i++ {
		for j := 0; j < 70; j++ {
			for k := 0; k < 3; k++ {
				username := R(i, "A")
				remotename := R(j, "B")
				suffix := R(k, "1")

				result := mungUsername(username, remotename, suffix, 64)
				require.LessOrEqual(t, len(result), 64)
			}
		}
	}
}

func Test_fixMention(t *testing.T) {
	tests := []struct {
		name       string
		post       *model.Post
		mentionMap model.UserMentionMap
		user       *model.User
		expected   string
	}{
		{
			name:       "nil post",
			post:       nil,
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "",
		},
		{
			name:       "empty mentionMap",
			post:       &model.Post{Message: "hello @user:remote"},
			mentionMap: model.UserMentionMap{},
			user:       &model.User{Id: "userid"},
			expected:   "hello @user:remote",
		},
		{
			name:       "no RemoteUsername prop",
			post:       &model.Post{Message: "hello @user:remote"},
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "hello @user:remote",
		},
		{
			name:       "simple mention",
			post:       &model.Post{Message: "hello @user:remote"},
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "hello @realuser",
		},
		{
			name:       "mention at start",
			post:       &model.Post{Message: "@user:remote hello"},
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "@realuser hello",
		},
		{
			name:       "mention at end",
			post:       &model.Post{Message: "hello @user:remote"},
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "hello @realuser",
		},
		{
			name:       "multiple mentions of same user",
			post:       &model.Post{Message: "hello @user:remote and @user:remote again"},
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "hello @realuser and @realuser again",
		},
		{
			name:       "multiple different mentions",
			post:       &model.Post{Message: "hello @user:remote and @other:remote"},
			mentionMap: model.UserMentionMap{"user:remote": "userid", "other:remote": "otherid"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "hello @realuser and @other:remote",
		},
		{
			name:       "mention without colon",
			post:       &model.Post{Message: "hello @user"},
			mentionMap: model.UserMentionMap{"user": "userid"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "hello @user",
		},
		{
			name:       "mention different user id",
			post:       &model.Post{Message: "hello @user:remote"},
			mentionMap: model.UserMentionMap{"user:remote": "different"},
			user:       &model.User{Id: "userid", Props: model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"}},
			expected:   "hello @user:remote",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fixMention(tt.post, tt.mentionMap, tt.user)
			if tt.post != nil {
				require.Equal(t, tt.expected, tt.post.Message)
			}
		})
	}
}

func Test_removeMention(t *testing.T) {
	tests := []struct {
		name       string
		post       *model.Post
		mentionMap model.UserMentionMap
		user       *model.User
		expected   string
	}{
		{
			name:       "nil post",
			post:       nil,
			mentionMap: model.UserMentionMap{"user": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "",
		},
		{
			name:       "empty mentionMap",
			post:       &model.Post{Message: "hello @user"},
			mentionMap: model.UserMentionMap{},
			user:       &model.User{Id: "userid"},
			expected:   "hello @user",
		},
		{
			name:       "simple mention",
			post:       &model.Post{Message: "hello @user"},
			mentionMap: model.UserMentionMap{"user": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "hello user",
		},
		{
			name:       "mention at start",
			post:       &model.Post{Message: "@user hello"},
			mentionMap: model.UserMentionMap{"user": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "user hello",
		},
		{
			name:       "mention at end",
			post:       &model.Post{Message: "hello @user"},
			mentionMap: model.UserMentionMap{"user": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "hello user",
		},
		{
			name:       "multiple mentions of same user",
			post:       &model.Post{Message: "hello @user and @user again"},
			mentionMap: model.UserMentionMap{"user": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "hello user and user again",
		},
		{
			name:       "multiple different mentions",
			post:       &model.Post{Message: "hello @user and @other"},
			mentionMap: model.UserMentionMap{"user": "userid", "other": "otherid"},
			user:       &model.User{Id: "userid"},
			expected:   "hello user and @other",
		},
		{
			name:       "mention with colon",
			post:       &model.Post{Message: "hello @user:remote"},
			mentionMap: model.UserMentionMap{"user:remote": "userid"},
			user:       &model.User{Id: "userid"},
			expected:   "hello user:remote",
		},
		{
			name:       "mention different user id",
			post:       &model.Post{Message: "hello @user"},
			mentionMap: model.UserMentionMap{"user": "different"},
			user:       &model.User{Id: "userid"},
			expected:   "hello @user",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			removeMention(tt.post, tt.mentionMap, tt.user)
			if tt.post != nil {
				require.Equal(t, tt.expected, tt.post.Message)
			}
		})
	}
}

// R returns a string with the specified string repeated `count` times.
func R(count int, s string) string {
	return strings.Repeat(s, count)
}
