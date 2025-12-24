// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDraftIsValid(t *testing.T) {
	o := Draft{}
	maxDraftSize := 10000

	err := o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.CreateAt = GetMillis()
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.UpdateAt = GetMillis()
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.UserId = NewId()
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.ChannelId = NewId()
	o.RootId = "123"
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.RootId = ""

	o.Message = strings.Repeat("0", maxDraftSize+1)
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.Message = strings.Repeat("0", maxDraftSize)
	err = o.IsValid(maxDraftSize)
	assert.Nil(t, err)

	o.Message = "test"
	err = o.IsValid(maxDraftSize)
	assert.Nil(t, err)

	o.FileIds = StringArray{strings.Repeat("0", maxDraftSize+1)}
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)
}

func TestDraftPreSave(t *testing.T) {
	o := Draft{Message: "test"}
	o.PreSave()

	assert.NotEqual(t, 0, o.CreateAt)

	past := GetMillis() - 1
	o = Draft{Message: "test", CreateAt: past}
	o.PreSave()

	assert.LessOrEqual(t, o.CreateAt, past)
}

func TestDraftIsPageDraft(t *testing.T) {
	t.Run("channel draft without props", func(t *testing.T) {
		draft := &Draft{
			UserId:    NewId(),
			ChannelId: NewId(),
			RootId:    "",
			Message:   "test message",
		}
		draft.PreSave()
		assert.False(t, draft.IsPageDraft())
	})

	t.Run("channel draft with empty props", func(t *testing.T) {
		draft := &Draft{
			UserId:    NewId(),
			ChannelId: NewId(),
			RootId:    "",
			Message:   "test message",
			Props:     make(map[string]any),
		}
		assert.False(t, draft.IsPageDraft())
	})

	t.Run("page draft with title prop", func(t *testing.T) {
		draft := &Draft{
			UserId:    NewId(),
			ChannelId: NewId(),
			RootId:    NewId(),
			Message:   "test message",
		}
		draft.SetProps(map[string]any{
			"title": "Page Title",
		})
		assert.True(t, draft.IsPageDraft())
	})

	t.Run("page draft with page_id prop", func(t *testing.T) {
		draft := &Draft{
			UserId:    NewId(),
			ChannelId: NewId(),
			RootId:    NewId(),
			Message:   "test message",
		}
		draft.SetProps(map[string]any{
			PagePropsPageID: NewId(),
		})
		assert.True(t, draft.IsPageDraft())
	})

	t.Run("page draft with both title and page_id", func(t *testing.T) {
		draft := &Draft{
			UserId:    NewId(),
			ChannelId: NewId(),
			RootId:    NewId(),
			Message:   "test message",
		}
		draft.SetProps(map[string]any{
			"title":         "Page Title",
			PagePropsPageID: NewId(),
		})
		assert.True(t, draft.IsPageDraft())
	})
}
