// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestNormalizeCache(t *testing.T) {
	t.Parallel()

	day := 24 * 60 * 60
	cases := []struct {
		name    string
		mode    string
		ttl     int
		want    string
		wantTTL time.Duration
		wantErr bool
	}{
		{name: "empty is none", mode: "", ttl: 30, want: model.EntityCacheNone},
		{name: "none ignores a ttl", mode: model.EntityCacheNone, ttl: 30, want: model.EntityCacheNone},
		{name: "shared zero ttl uses the default", mode: model.EntityCacheShared, ttl: 0, want: model.EntityCacheShared, wantTTL: defaultCacheTTL},
		{name: "user keeps its ttl", mode: model.EntityCacheUser, ttl: 60, want: model.EntityCacheUser, wantTTL: 60 * time.Second},
		{name: "shared accepts the maximum ttl", mode: model.EntityCacheShared, ttl: day, want: model.EntityCacheShared, wantTTL: time.Duration(day) * time.Second},
		{name: "unknown mode", mode: "session", wantErr: true},
		{name: "negative ttl", mode: model.EntityCacheUser, ttl: -1, wantErr: true},
		{name: "ttl past a day", mode: model.EntityCacheShared, ttl: day + 1, wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			mode, ttl, err := normalizeCache(tc.mode, tc.ttl)
			if tc.wantErr {
				require.Error(t, err)
				require.Empty(t, mode)
				require.Zero(t, ttl)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, mode)
			require.Equal(t, tc.wantTTL, ttl)
		})
	}
}

func TestCardCacheKey(t *testing.T) {
	t.Parallel()

	shared, ok := CardCacheKey("com.example:card", model.EntityCacheShared, "com.example:mark", "MARK-1", "user-a", "post-1", 10)
	require.True(t, ok)
	sameReader, ok := CardCacheKey("com.example:card", model.EntityCacheShared, "com.example:mark", "MARK-1", "user-b", "post-1", 10)
	require.True(t, ok)
	require.Equal(t, shared, sameReader, "a shared card ignores the reader")

	otherValue, _ := CardCacheKey("com.example:card", model.EntityCacheShared, "com.example:mark", "MARK-2", "user-a", "post-1", 10)
	otherType, _ := CardCacheKey("com.example:card", model.EntityCacheShared, "com.example:other", "MARK-1", "user-a", "post-1", 10)
	otherProvider, _ := CardCacheKey("com.example:other", model.EntityCacheShared, "com.example:mark", "MARK-1", "user-a", "post-1", 10)
	otherPost, _ := CardCacheKey("com.example:card", model.EntityCacheShared, "com.example:mark", "MARK-1", "user-a", "post-2", 10)
	otherTime, _ := CardCacheKey("com.example:card", model.EntityCacheShared, "com.example:mark", "MARK-1", "user-a", "post-1", 11)
	require.NotEqual(t, shared, otherValue)
	require.NotEqual(t, shared, otherType)
	require.NotEqual(t, shared, otherProvider)
	require.NotEqual(t, shared, otherPost)
	require.NotEqual(t, shared, otherTime)

	mine, ok := CardCacheKey("com.example:card", model.EntityCacheUser, "com.example:mark", "MARK-1", "user-a", "post-1", 10)
	require.True(t, ok)
	theirs, ok := CardCacheKey("com.example:card", model.EntityCacheUser, "com.example:mark", "MARK-1", "user-b", "post-1", 10)
	require.True(t, ok)
	require.NotEqual(t, mine, theirs)
	require.NotEqual(t, shared, mine)

	_, ok = CardCacheKey("com.example:card", model.EntityCacheUser, "com.example:mark", "MARK-1", "", "post-1", 10)
	require.False(t, ok)
	_, ok = CardCacheKey("com.example:card", model.EntityCacheNone, "com.example:mark", "MARK-1", "user-a", "post-1", 10)
	require.False(t, ok)
	_, ok = CardCacheKey("com.example:card", "", "com.example:mark", "MARK-1", "user-a", "post-1", 10)
	require.False(t, ok)
	_, ok = CardCacheKey("com.example:card", "session", "com.example:mark", "MARK-1", "user-a", "post-1", 10)
	require.False(t, ok)
}
