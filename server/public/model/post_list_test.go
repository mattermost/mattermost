// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPostListJson(t *testing.T) {
	pl := PostList{}
	p1 := &Post{Id: NewId(), Message: NewId()}
	pl.AddPost(p1)
	p2 := &Post{Id: NewId(), Message: NewId()}
	pl.AddPost(p2)

	pl.AddOrder(p1.Id)
	pl.AddOrder(p2.Id)

	js, err := pl.ToJSON()
	assert.NoError(t, err)

	var rpl PostList
	err = json.Unmarshal([]byte(js), &rpl)
	assert.NoError(t, err)

	assert.Equal(t, p1.Message, rpl.Posts[p1.Id].Message, "failed to serialize p1 message")
	assert.Equal(t, p2.Message, rpl.Posts[p2.Id].Message, "failed to serialize p2 message")
	assert.Equal(t, p2.Id, rpl.Order[1], "failed to serialize p2 Id")
}

func TestPostListExtend(t *testing.T) {
	p1 := &Post{Id: NewId(), Message: NewId()}
	p2 := &Post{Id: NewId(), Message: NewId()}
	p3 := &Post{Id: NewId(), Message: NewId()}

	l1 := PostList{}
	l1.AddPost(p1)
	l1.AddOrder(p1.Id)
	l1.AddPost(p2)
	l1.AddOrder(p2.Id)

	l2 := PostList{}
	l2.AddPost(p3)
	l2.AddOrder(p3.Id)

	l2.Extend(&l1)

	// should not changed l1
	assert.Len(t, l1.Posts, 2)
	assert.Len(t, l1.Order, 2)

	// should extend l2
	assert.Len(t, l2.Posts, 3)
	assert.Len(t, l2.Order, 3)

	// should extend the Order of l2 correctly
	assert.Equal(t, l2.Order[0], p3.Id)
	assert.Equal(t, l2.Order[1], p1.Id)
	assert.Equal(t, l2.Order[2], p2.Id)

	// extend l2 again
	l2.Extend(&l1)
	// extending l2 again should not changed l1
	assert.Len(t, l1.Posts, 2)
	assert.Len(t, l1.Order, 2)

	// extending l2 again should extend l2
	assert.Len(t, l2.Posts, 3)
	assert.Len(t, l2.Order, 3)

	// p3 could be last unread
	p4 := &Post{Id: NewId(), Message: NewId()}
	p5 := &Post{Id: NewId(), RootId: p1.Id, Message: NewId()}
	p6 := &Post{Id: NewId(), RootId: p1.Id, Message: NewId()}

	// Create before and after post list where p3 could be last unread

	// Order has 2 but Posts are 4 which includes additional 2 comments (p5 & p6) to parent post (p1)
	beforePostList := PostList{
		Order: []string{p1.Id, p2.Id},
		Posts: map[string]*Post{p1.Id: p1, p2.Id: p2, p5.Id: p5, p6.Id: p6},
	}

	// Order has 3 but Posts are 4 which includes 1 parent post (p1) of comments (p5 & p6)
	afterPostList := PostList{
		Order: []string{p4.Id, p5.Id, p6.Id},
		Posts: map[string]*Post{p1.Id: p1, p4.Id: p4, p5.Id: p5, p6.Id: p6},
	}

	beforePostList.Extend(&afterPostList)

	// should not changed afterPostList
	assert.Len(t, afterPostList.Posts, 4)
	assert.Len(t, afterPostList.Order, 3)

	// should extend beforePostList
	assert.Len(t, beforePostList.Posts, 5)
	assert.Len(t, beforePostList.Order, 5)

	// should extend the Order of beforePostList correctly
	assert.Equal(t, beforePostList.Order[0], p1.Id)
	assert.Equal(t, beforePostList.Order[1], p2.Id)
	assert.Equal(t, beforePostList.Order[2], p4.Id)
	assert.Equal(t, beforePostList.Order[3], p5.Id)
	assert.Equal(t, beforePostList.Order[4], p6.Id)
}

func TestPostListSortByCreateAt(t *testing.T) {
	pl := PostList{}
	p1 := &Post{Id: NewId(), Message: NewId(), CreateAt: 2}
	pl.AddPost(p1)
	p2 := &Post{Id: NewId(), Message: NewId(), CreateAt: 1}
	pl.AddPost(p2)
	p3 := &Post{Id: NewId(), Message: NewId(), CreateAt: 3}
	pl.AddPost(p3)

	pl.AddOrder(p1.Id)
	pl.AddOrder(p2.Id)
	pl.AddOrder(p3.Id)

	pl.SortByCreateAt()

	assert.EqualValues(t, pl.Order[0], p3.Id)
	assert.EqualValues(t, pl.Order[1], p1.Id)
	assert.EqualValues(t, pl.Order[2], p2.Id)
}

func TestPostListToSlice(t *testing.T) {
	pl := PostList{}
	p1 := &Post{Id: NewId(), Message: NewId(), CreateAt: 2}
	pl.AddPost(p1)
	p2 := &Post{Id: NewId(), Message: NewId(), CreateAt: 1}
	pl.AddPost(p2)
	p3 := &Post{Id: NewId(), Message: NewId(), CreateAt: 3}
	pl.AddPost(p3)

	pl.AddOrder(p1.Id)
	pl.AddOrder(p2.Id)
	pl.AddOrder(p3.Id)

	want := []*Post{p1, p2, p3}

	assert.Equal(t, want, pl.ToSlice())
}

func TestEncodePostsSinceCursor(t *testing.T) {
	t.Run("valid cursor with create_at", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: 1704067200000,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.NoError(t, err)
		assert.Equal(t, "create_at:1704067200000:abc123xyz789", encoded)
	})

	t.Run("valid cursor with update_at", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeUpdateAt,
			LastPostTimestamp: 1704070800000,
			LastPostID:        "xyz789abc123",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.NoError(t, err)
		assert.Equal(t, "update_at:1704070800000:xyz789abc123", encoded)
	})

	t.Run("empty TimeType defaults to create_at", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          "",
			LastPostTimestamp: 1704067200000,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.NoError(t, err)
		assert.Equal(t, "create_at:1704067200000:abc123xyz789", encoded)
	})

	t.Run("zero timestamp is valid", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: 0,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.NoError(t, err)
		assert.Equal(t, "create_at:0:abc123xyz789", encoded)
	})

	t.Run("invalid TimeType returns error", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          "invalid_type",
			LastPostTimestamp: 1704067200000,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid TimeType")
		assert.Equal(t, "", encoded)
	})

	t.Run("negative timestamp returns error", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: -1,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid timestamp")
		assert.Equal(t, "", encoded)
	})

	t.Run("empty LastPostID returns error", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: 1704067200000,
			LastPostID:        "",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid post ID")
		assert.Equal(t, "", encoded)
	})

	t.Run("large timestamp value", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: 9999999999999,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.NoError(t, err)
		assert.Equal(t, "create_at:9999999999999:abc123xyz789", encoded)
	})

	t.Run("post ID with special characters", func(t *testing.T) {
		cursor := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: 1704067200000,
			LastPostID:        "abc-123_xyz.789",
		}

		encoded, err := EncodePostsSinceCursor(cursor)
		assert.NoError(t, err)
		assert.Equal(t, "create_at:1704067200000:abc-123_xyz.789", encoded)
	})
}

func TestDecodePostsSinceCursor(t *testing.T) {
	t.Run("valid cursor with create_at", func(t *testing.T) {
		cursorStr := "create_at:1704067200000:abc123xyz789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.NoError(t, err)
		assert.Equal(t, TimeTypeCreateAt, cursor.TimeType)
		assert.Equal(t, int64(1704067200000), cursor.LastPostTimestamp)
		assert.Equal(t, "abc123xyz789", cursor.LastPostID)
	})

	t.Run("valid cursor with update_at", func(t *testing.T) {
		cursorStr := "update_at:1704070800000:xyz789abc123"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.NoError(t, err)
		assert.Equal(t, TimeTypeUpdateAt, cursor.TimeType)
		assert.Equal(t, int64(1704070800000), cursor.LastPostTimestamp)
		assert.Equal(t, "xyz789abc123", cursor.LastPostID)
	})

	t.Run("zero timestamp is valid", func(t *testing.T) {
		cursorStr := "create_at:0:abc123xyz789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.NoError(t, err)
		assert.Equal(t, TimeTypeCreateAt, cursor.TimeType)
		assert.Equal(t, int64(0), cursor.LastPostTimestamp)
		assert.Equal(t, "abc123xyz789", cursor.LastPostID)
	})

	t.Run("large timestamp value", func(t *testing.T) {
		cursorStr := "create_at:9999999999999:abc123xyz789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.NoError(t, err)
		assert.Equal(t, TimeTypeCreateAt, cursor.TimeType)
		assert.Equal(t, int64(9999999999999), cursor.LastPostTimestamp)
		assert.Equal(t, "abc123xyz789", cursor.LastPostID)
	})

	t.Run("post ID with special characters", func(t *testing.T) {
		cursorStr := "create_at:1704067200000:abc-123_xyz.789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.NoError(t, err)
		assert.Equal(t, TimeTypeCreateAt, cursor.TimeType)
		assert.Equal(t, int64(1704067200000), cursor.LastPostTimestamp)
		assert.Equal(t, "abc-123_xyz.789", cursor.LastPostID)
	})

	t.Run("malformed cursor with too few parts", func(t *testing.T) {
		cursorStr := "create_at:1704067200000"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid cursor format")
		assert.Contains(t, err.Error(), "got 2 parts")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("malformed cursor with too many parts", func(t *testing.T) {
		cursorStr := "create_at:1704067200000:abc123:extra"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid cursor format")
		assert.Contains(t, err.Error(), "got 4 parts")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("invalid TimeType", func(t *testing.T) {
		cursorStr := "invalid_type:1704067200000:abc123xyz789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid TimeType")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("non-numeric timestamp", func(t *testing.T) {
		cursorStr := "create_at:notanumber:abc123xyz789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid timestamp")
		assert.Contains(t, err.Error(), "failed to parse")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("negative timestamp", func(t *testing.T) {
		cursorStr := "create_at:-1:abc123xyz789"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid timestamp")
		assert.Contains(t, err.Error(), "must be >= 0")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("empty post ID", func(t *testing.T) {
		cursorStr := "create_at:1704067200000:"

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid post ID")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("empty string", func(t *testing.T) {
		cursorStr := ""

		cursor, err := DecodePostsSinceCursor(cursorStr)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid cursor format")
		assert.Equal(t, GetPostsSinceCursor{}, cursor)
	})

	t.Run("round-trip encoding and decoding with create_at", func(t *testing.T) {
		original := GetPostsSinceCursor{
			TimeType:          TimeTypeCreateAt,
			LastPostTimestamp: 1704067200000,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(original)
		assert.NoError(t, err)

		decoded, err := DecodePostsSinceCursor(encoded)
		assert.NoError(t, err)
		assert.Equal(t, original, decoded)
	})

	t.Run("round-trip encoding and decoding with update_at", func(t *testing.T) {
		original := GetPostsSinceCursor{
			TimeType:          TimeTypeUpdateAt,
			LastPostTimestamp: 1704070800000,
			LastPostID:        "xyz789abc123",
		}

		encoded, err := EncodePostsSinceCursor(original)
		assert.NoError(t, err)

		decoded, err := DecodePostsSinceCursor(encoded)
		assert.NoError(t, err)
		assert.Equal(t, original, decoded)
	})

	t.Run("round-trip with empty TimeType defaults to create_at", func(t *testing.T) {
		original := GetPostsSinceCursor{
			TimeType:          "",
			LastPostTimestamp: 1704067200000,
			LastPostID:        "abc123xyz789",
		}

		encoded, err := EncodePostsSinceCursor(original)
		assert.NoError(t, err)

		decoded, err := DecodePostsSinceCursor(encoded)
		assert.NoError(t, err)
		// TimeType should be normalized to "create_at"
		assert.Equal(t, TimeTypeCreateAt, decoded.TimeType)
		assert.Equal(t, original.LastPostTimestamp, decoded.LastPostTimestamp)
		assert.Equal(t, original.LastPostID, decoded.LastPostID)
	})
}
