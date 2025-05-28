// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestLRU(t *testing.T) {
	l := NewLRU(&CacheOptions{
		Size:                   128,
		DefaultExpiry:          0,
		InvalidateClusterEvent: "",
	})

	for i := 0; i < 256; i++ {
		err := l.SetWithDefaultExpiry(fmt.Sprintf("%d", i), i)
		require.NoError(t, err)
	}

	lru, ok := l.(*LRU)
	require.True(t, ok)
	size := lru.len
	require.Equalf(t, size, 128, "bad len: %v", size)

	l.Scan(func(keys []string) error {
		for i, k := range keys {
			var v int
			err := l.Get(k, &v)
			require.NoError(t, err, "bad key: %v", k)
			require.Equalf(t, fmt.Sprintf("%d", v), k, "bad key: %v", k)
			require.Equalf(t, i+128, v, "bad value: %v", k)
		}
		return nil
	})

	for i := 0; i < 128; i++ {
		var v int
		err := l.Get(fmt.Sprintf("%d", i), &v)
		require.Equal(t, ErrKeyNotFound, err, "should be evicted %v: %v", i, err)
	}
	for i := 128; i < 256; i++ {
		var v int
		err := l.Get(fmt.Sprintf("%d", i), &v)
		require.NoError(t, err, "should not be evicted %v: %v", i, err)
	}
	var v1, v2 int
	var values = []any{&v1, &v2}
	errs := l.GetMulti([]string{"128", "129"}, values)
	for _, err := range errs {
		require.NoError(t, err)
	}
	err := l.RemoveMulti([]string{"128", "129"})
	require.NoError(t, err)
	errs = l.GetMulti([]string{"128", "129"}, values)
	for i, err := range errs {
		require.Equal(t, ErrKeyNotFound, err, "should be deleted %v: %v", i, err)
	}

	for i := 128; i < 192; i++ {
		l.Remove(fmt.Sprintf("%d", i))
		var v int
		err = l.Get(fmt.Sprintf("%d", i), &v)
		require.Equal(t, ErrKeyNotFound, err, "should be deleted %v: %v", i, err)
	}

	var v int
	err = l.Get("192", &v) // expect 192 to be last key in l.Keys()
	require.NoError(t, err, "should exist")
	require.Equalf(t, 192, v, "bad value: %v", v)

	l.Scan(func(keys []string) error {
		for i, k := range keys {
			require.Falsef(t, i < 63 && k != fmt.Sprintf("%d", i+193), "out of order key: %v", k)
			require.Falsef(t, i == 63 && k != "192", "out of order key: %v", k)
		}
		return nil
	})

	l.Purge()
	size = lru.len
	require.Equalf(t, size, 0, "bad len: %v", size)
	err = l.Get("200", &v)
	require.Equal(t, err, ErrKeyNotFound, "should contain nothing")

	err = l.SetWithDefaultExpiry("201", 301)
	require.NoError(t, err)
	err = l.Get("201", &v)
	require.NoError(t, err)
	require.Equal(t, 301, v)
}

func TestLRUExpire(t *testing.T) {
	l := NewLRU(&CacheOptions{
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
	require.NoError(t, err2, "should exist")
	require.Equal(t, 3, r2)
}

func TestLRUMarshalUnMarshal(t *testing.T) {
	l := NewLRU(&CacheOptions{
		Size:                   1,
		DefaultExpiry:          0,
		InvalidateClusterEvent: "",
	})

	value1 := map[string]any{
		"key1": 1,
		"key2": "value2",
	}
	err := l.SetWithDefaultExpiry("test", value1)

	require.NoError(t, err)

	var value2 map[string]any
	err = l.Get("test", &value2)
	require.NoError(t, err)
	assert.EqualValues(t, 1, value2["key1"])

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
		OriginalId:    "OriginalId",
		Message:       "OriginalId",
		MessageSource: "MessageSource",
		Type:          "Type",
		Props: map[string]any{
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
	err = l.SetWithDefaultExpiry("post", post.Clone())
	require.NoError(t, err)

	var p model.Post
	err = l.Get("post", &p)
	require.NoError(t, err)
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

	err = l.SetWithDefaultExpiry("session", session)
	require.NoError(t, err)
	var s = &model.Session{}
	err = l.Get("session", s)

	require.NoError(t, err)
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

	err = l.SetWithDefaultExpiry("user", user)
	require.NoError(t, err)

	var u model.User
	err = l.Get("user", &u)
	require.NoError(t, err)
	// msgp returns an empty map instead of a nil map.
	// This does not make an actual difference in terms of functionality.
	u.Timezone = nil
	require.Equal(t, user, &u)

	tt := make(model.UserMap)
	tt["1"] = &u
	err = l.SetWithDefaultExpiry("mm", tt)
	require.NoError(t, err)

	var out model.UserMap
	err = l.Get("mm", &out)
	require.NoError(t, err)
	out["1"].Timezone = nil
	require.Equal(t, tt, out)
}

func BenchmarkLRU(b *testing.B) {
	value1 := "simplestring"

	b.Run("simple=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", value1)
			require.NoError(b, err)

			var val string
			err = l2.Get("test", &val)
			require.NoError(b, err)
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
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", value2)
			require.NoError(b, err)

			var val obj
			err = l2.Get("test", &val)
			require.NoError(b, err)
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
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", user)
			require.NoError(b, err)

			var val model.User
			err = l2.Get("test", &val)
			require.NoError(b, err)
		}
	})

	uMap := map[string]*model.User{
		"id1": {
			Id:       "id1",
			CreateAt: 1111,
			UpdateAt: 1112,
			Username: "user1",
			Password: "pass",
		},
		"id2": {
			Id:       "id2",
			CreateAt: 1113,
			UpdateAt: 1114,
			Username: "user2",
			Password: "pass2",
		},
	}

	b.Run("UserMap=new", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", model.UserMap(uMap))
			require.NoError(b, err)

			var val map[string]*model.User
			err = l2.Get("test", &val)
			require.NoError(b, err)
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
		OriginalId:    "OriginalId",
		Message:       "OriginalId",
		MessageSource: "MessageSource",
		Type:          "Type",
		Props: map[string]any{
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
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", post)
			require.NoError(b, err)

			var val model.Post
			err = l2.Get("test", &val)
			require.NoError(b, err)
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
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", status)
			require.NoError(b, err)

			var val *model.Status
			err = l2.Get("test", &val)
			require.NoError(b, err)
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
			l2 := NewLRU(&CacheOptions{
				Size:                   1,
				DefaultExpiry:          0,
				InvalidateClusterEvent: "",
			})
			err := l2.SetWithDefaultExpiry("test", &session)
			require.NoError(b, err)

			var val *model.Session
			err = l2.Get("test", &val)
			require.NoError(b, err)
		}
	})
}

func TestLRURace(t *testing.T) {
	l2 := NewLRU(&CacheOptions{
		Size:                   1,
		DefaultExpiry:          0,
		InvalidateClusterEvent: "",
	})
	var wg sync.WaitGroup
	l2.SetWithDefaultExpiry("test", "value1")

	wg.Add(2)

	go func() {
		defer wg.Done()
		value1 := "simplestring"
		err := l2.SetWithDefaultExpiry("test", value1)
		require.NoError(t, err)
	}()

	go func() {
		defer wg.Done()

		var val string
		err := l2.Get("test", &val)
		require.NoError(t, err)
	}()

	wg.Wait()
}
