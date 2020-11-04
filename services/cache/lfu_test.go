// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const wait = 10 * time.Millisecond

func TestLFU(t *testing.T) {
	l := NewLFU(&LFUOptions{
		Size:                   128,
		DefaultExpiry:          0,
		InvalidateClusterEvent: "",
	})

	len, _ := l.Len()
	assert.Equal(t, 0, len, "length should be 0 after cache is initialized.")

	err := l.Set("key", "value")
	require.Nil(t, err)

	time.Sleep(wait)

	var v string
	err = l.Get("key", &v)
	require.Nil(t, err, "should exist")
	require.Equalf(t, "value", v, "bad value: %v", v)

	len, err = l.Len()
	require.Nil(t, err)
	assert.Equal(t, 1, len, "length should be 1 after item is added to the cache.")

	l.Remove("key")
	err = l.Get("key", &v)
	require.EqualError(t, err, "key not found")

	keys, er := l.Keys()
	require.Nil(t, er)
	require.Len(t, keys, 0, "length should be 0 after only key is removed")

	err = l.Set("key", "value")
	require.Nil(t, err)

	time.Sleep(wait)

	keys, err = l.Keys()
	require.Nil(t, err)
	require.Len(t, keys, 1, "length should be 1 after adding new key")
	require.Equal(t, []string{"key"}, keys, "keys should be of slice \"{\"keys\"}\"")

	_ = l.Purge()

	len, _ = l.Len()
	assert.Equal(t, 0, len, "length should be 0 after cache is purged.")
}

func TestLFUExpire(t *testing.T) {
	l := NewLFU(&LFUOptions{
		Size:                   128,
		DefaultExpiry:          1 * time.Second,
		InvalidateClusterEvent: "",
	})

	l.SetWithDefaultExpiry("1", 1)
	l.SetWithExpiry("3", 3, 0*time.Second)

	time.Sleep(time.Second * 2)

	var r1 int
	err := l.Get("1", &r1)
	require.Equal(t, err, ErrKeyNotFound, "should not exist")

	var r2 int
	err2 := l.Get("3", &r2)
	require.Nil(t, err2, "should exist")
	require.Equal(t, 3, r2)
}

func TestLFUMarshalUnMarshal(t *testing.T) {
	l := NewLFU(&LFUOptions{
		Size:                   1,
		DefaultExpiry:          0,
		InvalidateClusterEvent: "",
	})

	value1 := map[string]interface{}{
		"key1": 1,
		"key2": "value2",
	}

	err := l.Set("test", value1)
	require.Nil(t, err)

	time.Sleep(wait)

	var value2 map[string]interface{}
	err = l.Get("test", &value2)
	require.Nil(t, err)

	v1, ok := value2["key1"].(int64)
	require.True(t, ok, "unable to cast value")
	assert.Equal(t, int64(1), v1)

	v2, ok := value2["key2"].(string)
	require.True(t, ok, "unable to cast value")
	assert.Equal(t, "value2", v2)

	post := model.Post{
		Id:            "id",
		CreateAt:      11111,
		UpdateAt:      11111,
		DeleteAt:      11111,
		EditAt:        111111,
		IsPinned:      true,
		UserId:        "UserId",
		ChannelId:     "ChannelId",
		RootId:        "RootId",
		ParentId:      "ParentId",
		OriginalId:    "OriginalId",
		Message:       "OriginalId",
		MessageSource: "MessageSource",
		Type:          "Type",
		Props: map[string]interface{}{
			"key": "val",
		},
		Hashtags:      "Hashtags",
		Filenames:     []string{"item1", "item2"},
		FileIds:       []string{"item1", "item2"},
		PendingPostId: "PendingPostId",
		HasReactions:  true,
		ReplyCount:    11111,
		Metadata: &model.PostMetadata{
			Embeds: []*model.PostEmbed{
				{
					Type: "Type",
					URL:  "URL",
					Data: "some data",
				},
				{
					Type: "Type 2",
					URL:  "URL 2",
					Data: "some data 2",
				},
			},
			Emojis: []*model.Emoji{
				{
					Id:   "id",
					Name: "name",
				},
			},
			Files: nil,
			Images: map[string]*model.PostImage{
				"key": {
					Width:      1,
					Height:     1,
					Format:     "format",
					FrameCount: 1,
				},
				"key2": {
					Width:      999,
					Height:     888,
					Format:     "format 2",
					FrameCount: 1000,
				},
			},
			Reactions: []*model.Reaction{
				{
					UserId:    "user_id",
					PostId:    "post_id",
					EmojiName: "emoji_name",
					CreateAt:  111,
				},
			},
		},
	}
	err = l.Set("post", post.Clone())
	require.Nil(t, err)
	time.Sleep(wait)
	var p model.Post
	err = l.Get("post", &p)
	require.Nil(t, err)
	require.Equal(t, post.Clone(), p.Clone())

	session := &model.Session{
		Id:             "ty7ia14yuty5bmpt8wmz6da1fw",
		Token:          "79c3iq6nzpycmkkawudanqhg5c",
		CreateAt:       1595445296960,
		ExpiresAt:      1598296496960,
		LastActivityAt: 1595445296960,
		UserId:         "rpgh1q5ra38y9xjn9z8fjctezr",
		Roles:          "system_admin system_user",
		IsOAuth:        false,
		ExpiredNotify:  false,
		Props: map[string]string{
			"csrf":     "33zb7h7rk3rfffztojn5pxbkxe",
			"isMobile": "false",
			"isSaml":   "false",
			"is_guest": "false",
			"os":       "",
			"platform": "Windows",
		},
	}

	err = l.Set("session", session)
	require.Nil(t, err)
	time.Sleep(wait)
	var s *model.Session
	err = l.Get("session", &s)
	require.Nil(t, err)
	require.Equal(t, session, s)

	user := &model.User{
		Id:             "id",
		CreateAt:       11111,
		UpdateAt:       11111,
		DeleteAt:       11111,
		Username:       "username",
		Password:       "password",
		AuthService:    "AuthService",
		AuthData:       nil,
		Email:          "Email",
		EmailVerified:  true,
		Nickname:       "Nickname",
		FirstName:      "FirstName",
		LastName:       "LastName",
		Position:       "Position",
		Roles:          "Roles",
		AllowMarketing: true,
		Props: map[string]string{
			"key0": "value0",
		},
		NotifyProps: map[string]string{
			"key0": "value0",
		},
		LastPasswordUpdate:     111111,
		LastPictureUpdate:      111111,
		FailedAttempts:         111111,
		Locale:                 "Locale",
		MfaActive:              true,
		MfaSecret:              "MfaSecret",
		LastActivityAt:         111111,
		IsBot:                  true,
		TermsOfServiceId:       "TermsOfServiceId",
		TermsOfServiceCreateAt: 111111,
	}

	err = l.Set("user", user)
	require.Nil(t, err)
	time.Sleep(wait)
	var u *model.User
	err = l.Get("user", &u)
	require.Nil(t, err)
	// msgp returns an empty map instead of a nil map.
	// This does not make an actual difference in terms of functionality.
	u.Timezone = nil
	require.Equal(t, user, u)
}

func BenchmarkLFU(b *testing.B) {

	value1 := "simplestring"

	b.Run("simple=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLFU(&LFUOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.Set("test", value1)
			require.Nil(b, err)
			time.Sleep(wait)
			var val string
			err = l2.Get("test", &val)
			require.Nil(b, err)
		}
	})

	type obj struct {
		Field1 int
		Field2 string
		Field3 struct {
			Field4 int
			Field5 string
		}
		Field6 map[string]string
	}

	value2 := obj{
		1,
		"field2",
		struct {
			Field4 int
			Field5 string
		}{
			6,
			"field5 is a looooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong string",
		},
		map[string]string{
			"key0": "value0",
			"key1": "value value1",
			"key2": "value value value2",
			"key3": "value value value value3",
			"key4": "value value value value value4",
			"key5": "value value value value value value5",
			"key6": "value value value value value value value6",
			"key7": "value value value value value value value value7",
			"key8": "value value value value value value value value value8",
			"key9": "value value value value value value value value value value9",
		},
	}

	b.Run("complex=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLFU(&LFUOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.Set("test", value2)
			require.Nil(b, err)
			time.Sleep(wait)
			var val obj
			err = l2.Get("test", &val)
			require.Nil(b, err)
		}
	})

	user := &model.User{
		Id:             "id",
		CreateAt:       11111,
		UpdateAt:       11111,
		DeleteAt:       11111,
		Username:       "username",
		Password:       "password",
		AuthService:    "AuthService",
		AuthData:       nil,
		Email:          "Email",
		EmailVerified:  true,
		Nickname:       "Nickname",
		FirstName:      "FirstName",
		LastName:       "LastName",
		Position:       "Position",
		Roles:          "Roles",
		AllowMarketing: true,
		Props: map[string]string{
			"key0": "value0",
			"key1": "value value1",
			"key2": "value value value2",
			"key3": "value value value value3",
			"key4": "value value value value value4",
			"key5": "value value value value value value5",
			"key6": "value value value value value value value6",
			"key7": "value value value value value value value value7",
			"key8": "value value value value value value value value value8",
			"key9": "value value value value value value value value value value9",
		},
		NotifyProps: map[string]string{
			"key0": "value0",
			"key1": "value value1",
			"key2": "value value value2",
			"key3": "value value value value3",
			"key4": "value value value value value4",
			"key5": "value value value value value value5",
			"key6": "value value value value value value value6",
			"key7": "value value value value value value value value7",
			"key8": "value value value value value value value value value8",
			"key9": "value value value value value value value value value value9",
		},
		LastPasswordUpdate: 111111,
		LastPictureUpdate:  111111,
		FailedAttempts:     111111,
		Locale:             "Locale",
		Timezone: map[string]string{
			"key0": "value0",
			"key1": "value value1",
			"key2": "value value value2",
			"key3": "value value value value3",
			"key4": "value value value value value4",
			"key5": "value value value value value value5",
			"key6": "value value value value value value value6",
			"key7": "value value value value value value value value7",
			"key8": "value value value value value value value value value8",
			"key9": "value value value value value value value value value value9",
		},
		MfaActive:              true,
		MfaSecret:              "MfaSecret",
		LastActivityAt:         111111,
		IsBot:                  true,
		BotDescription:         "field5 is a looooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong string",
		BotLastIconUpdate:      111111,
		TermsOfServiceId:       "TermsOfServiceId",
		TermsOfServiceCreateAt: 111111,
	}

	b.Run("User=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLFU(&LFUOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.Set("test", user)
			require.Nil(b, err)
			time.Sleep(wait)
			var val model.User
			err = l2.Get("test", &val)
			require.Nil(b, err)
		}
	})

	post := &model.Post{
		Id:            "id",
		CreateAt:      11111,
		UpdateAt:      11111,
		DeleteAt:      11111,
		EditAt:        111111,
		IsPinned:      true,
		UserId:        "UserId",
		ChannelId:     "ChannelId",
		RootId:        "RootId",
		ParentId:      "ParentId",
		OriginalId:    "OriginalId",
		Message:       "OriginalId",
		MessageSource: "MessageSource",
		Type:          "Type",
		Props: map[string]interface{}{
			"key": "val",
		},
		Hashtags:      "Hashtags",
		Filenames:     []string{"item1", "item2"},
		FileIds:       []string{"item1", "item2"},
		PendingPostId: "PendingPostId",
		HasReactions:  true,

		// Transient data populated before sending a post to the client
		ReplyCount: 11111,
		Metadata: &model.PostMetadata{
			Embeds: []*model.PostEmbed{
				{
					Type: "Type",
					URL:  "URL",
					Data: "some data",
				},
				{
					Type: "Type 2",
					URL:  "URL 2",
					Data: "some data 2",
				},
			},
			Emojis: []*model.Emoji{
				{
					Id:   "id",
					Name: "name",
				},
			},
			Files: nil,
			Images: map[string]*model.PostImage{
				"key": {
					Width:      1,
					Height:     1,
					Format:     "format",
					FrameCount: 1,
				},
				"key2": {
					Width:      999,
					Height:     888,
					Format:     "format 2",
					FrameCount: 1000,
				},
			},
			Reactions: []*model.Reaction{},
		},
	}

	b.Run("Post=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLFU(&LFUOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.Set("test", post)
			require.Nil(b, err)
			time.Sleep(wait)
			var val model.Post
			err = l2.Get("test", &val)
			require.Nil(b, err)
		}
	})

	status := model.Status{
		UserId:         "UserId",
		Status:         "Status",
		Manual:         true,
		LastActivityAt: 111111,
		ActiveChannel:  "ActiveChannel",
	}

	b.Run("Status=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLFU(&LFUOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.Set("test", status)
			require.Nil(b, err)
			time.Sleep(wait)
			var val *model.Status
			err = l2.Get("test", &val)
			require.Nil(b, err)
		}
	})

	session := model.Session{
		Id:             "ty7ia14yuty5bmpt8wmz6da1fw",
		Token:          "79c3iq6nzpycmkkawudanqhg5c",
		CreateAt:       1595445296960,
		ExpiresAt:      1598296496960,
		LastActivityAt: 1595445296960,
		UserId:         "rpgh1q5ra38y9xjn9z8fjctezr",
		Roles:          "system_admin system_user",
		IsOAuth:        false,
		ExpiredNotify:  false,
		Props: map[string]string{
			"csrf":     "33zb7h7rk3rfffztojn5pxbkxe",
			"isMobile": "false",
			"isSaml":   "false",
			"is_guest": "false",
			"os":       "",
			"platform": "Windows",
		},
	}

	b.Run("Session=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLFU(&LFUOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.Set("test", &session)
			require.Nil(b, err)
			time.Sleep(wait)
			var val *model.Session
			err = l2.Get("test", &val)
			require.Nil(b, err)
		}
	})
}
