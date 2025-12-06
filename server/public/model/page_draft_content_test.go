// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPageDraftContentPreSave(t *testing.T) {
	t.Run("sets CreateAt and UpdateAt on new draft", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:  NewId(),
			WikiId:  NewId(),
			DraftId: "draft-1",
			Title:   "Test Draft",
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		pd.PreSave()

		require.Greater(t, pd.CreateAt, int64(0))
		require.Equal(t, pd.CreateAt, pd.UpdateAt)
	})

	t.Run("updates UpdateAt on existing draft", func(t *testing.T) {
		originalCreateAt := GetMillis()
		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   NewId(),
			DraftId:  "draft-1",
			Title:    "Test Draft",
			CreateAt: originalCreateAt,
			UpdateAt: originalCreateAt,
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		pd.PreSave()

		require.Equal(t, originalCreateAt, pd.CreateAt)
		require.GreaterOrEqual(t, pd.UpdateAt, originalCreateAt)
	})

	t.Run("sanitizes unicode in title", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:  NewId(),
			WikiId:  NewId(),
			DraftId: "draft-1",
			Title:   "Test\u202ADraft\u202BTitle",
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		pd.PreSave()

		require.Equal(t, "TestDraftTitle", pd.Title, "BIDI characters should be stripped from title")
	})
}

func TestPageDraftContentIsValid(t *testing.T) {
	t.Run("valid draft content", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   NewId(),
			DraftId:  "draft-1",
			Title:    "Test Draft",
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.Nil(t, err)
	})

	t.Run("invalid UserId", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:   "invalid",
			WikiId:   NewId(),
			DraftId:  "draft-1",
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_draft_content.is_valid.user_id.app_error", err.Id)
	})

	t.Run("invalid WikiId", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   "invalid",
			DraftId:  "draft-1",
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_draft_content.is_valid.wiki_id.app_error", err.Id)
	})

	t.Run("empty DraftId", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   NewId(),
			DraftId:  "",
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_draft_content.is_valid.draft_id.app_error", err.Id)
	})

	t.Run("missing CreateAt", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   NewId(),
			DraftId:  "draft-1",
			CreateAt: 0,
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_draft_content.is_valid.create_at.app_error", err.Id)
	})

	t.Run("missing UpdateAt", func(t *testing.T) {
		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   NewId(),
			DraftId:  "draft-1",
			CreateAt: GetMillis(),
			UpdateAt: 0,
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_draft_content.is_valid.update_at.app_error", err.Id)
	})

	t.Run("title exceeds max length", func(t *testing.T) {
		longTitle := make([]byte, MaxPageTitleLength+1)
		for i := range longTitle {
			longTitle[i] = 'a'
		}

		pd := &PageDraftContent{
			UserId:   NewId(),
			WikiId:   NewId(),
			DraftId:  "draft-1",
			Title:    string(longTitle),
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
			Content: TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}

		err := pd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.page_draft_content.is_valid.title_too_long.app_error", err.Id)
	})
}
