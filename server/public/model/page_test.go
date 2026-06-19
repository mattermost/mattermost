// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func validPage() *Page {
	return &Page{
		Id:        NewId(),
		WikiId:    NewId(),
		ChannelId: NewId(),
		Type:      PageTypePage,
		UserId:    NewId(),
		CreateAt:  GetMillis(),
		UpdateAt:  GetMillis(),
	}
}

func TestPageIsValid(t *testing.T) {
	t.Run("a fully-populated page is valid", func(t *testing.T) {
		require.Nil(t, validPage().IsValid())
	})

	t.Run("page_folder is a valid type", func(t *testing.T) {
		p := validPage()
		p.Type = PageTypeFolder
		require.Nil(t, p.IsValid())
	})

	cases := []struct {
		name   string
		mutate func(*Page)
	}{
		{"empty id", func(p *Page) { p.Id = "" }},
		{"empty user id", func(p *Page) { p.UserId = "" }},
		{"zero create_at", func(p *Page) { p.CreateAt = 0 }},
		{"zero update_at", func(p *Page) { p.UpdateAt = 0 }},
		{"unknown type", func(p *Page) { p.Type = "post" }},
		{"title too long", func(p *Page) { p.Title = strings.Repeat("x", PageTitleMaxRunes+1) }},
		{"invalid parent id", func(p *Page) { p.ParentId = "not-an-id" }},
		{"parent is self", func(p *Page) { p.ParentId = p.Id }},
		{"invalid original id", func(p *Page) { p.OriginalId = "not-an-id" }},
		{"invalid wiki id when set", func(p *Page) { p.WikiId = "not-an-id" }},
		{"invalid channel id when set", func(p *Page) { p.ChannelId = "not-an-id" }},
	}
	for _, c := range cases {
		t.Run(c.name+" is invalid", func(t *testing.T) {
			p := validPage()
			c.mutate(p)
			require.NotNil(t, p.IsValid())
		})
	}

	t.Run("empty WikiId/ChannelId are tolerated (server-set after decode)", func(t *testing.T) {
		p := validPage()
		p.WikiId = ""
		p.ChannelId = ""
		require.Nil(t, p.IsValid(), "empty FK/cache must pass — they are set server-side, not by the client body")
	})

	t.Run("a title exactly at the limit is valid", func(t *testing.T) {
		p := validPage()
		p.Title = strings.Repeat("x", PageTitleMaxRunes)
		require.Nil(t, p.IsValid())
	})
}

func TestPagePreSave(t *testing.T) {
	t.Run("stamps id, default type, and timestamps", func(t *testing.T) {
		p := &Page{UserId: NewId(), Title: "  hello  "}
		p.PreSave()

		require.True(t, IsValidId(p.Id))
		require.Equal(t, PageTypePage, p.Type)
		require.NotZero(t, p.CreateAt)
		require.Equal(t, p.CreateAt, p.UpdateAt)
		require.Equal(t, "hello", p.Title, "title is trimmed")
	})

	t.Run("preserves an explicit id and type", func(t *testing.T) {
		id := NewId()
		p := &Page{Id: id, Type: PageTypeFolder, UserId: NewId()}
		p.PreSave()
		require.Equal(t, id, p.Id)
		require.Equal(t, PageTypeFolder, p.Type)
	})
}

func TestPagePreUpdate(t *testing.T) {
	created := GetMillis() - 1000
	p := &Page{CreateAt: created, UpdateAt: created, Title: "  edited  ", Body: "body"}
	p.PreUpdate()

	require.Greater(t, p.UpdateAt, created, "UpdateAt advances")
	require.Equal(t, created, p.CreateAt, "CreateAt is not modified")
	require.Equal(t, "edited", p.Title, "Title is trimmed")
}

func TestPageSanitizeInput(t *testing.T) {
	p := &Page{
		WikiId:                      NewId(),
		ChannelId:                   NewId(),
		DeleteAt:                    100,
		EditAt:                      200,
		OriginalId:                  NewId(),
		LastModifiedBy:              NewId(),
		SortOrder:                   5,
		HasEffectiveViewRestriction: true,
		HasLocalEditRestriction:     true,
		Title:                       "kept",
		Body:                        "kept",
	}
	p.SanitizeInput()

	require.Empty(t, p.WikiId)
	require.Empty(t, p.ChannelId)
	require.Zero(t, p.DeleteAt)
	require.Zero(t, p.EditAt)
	require.Empty(t, p.OriginalId)
	require.Empty(t, p.LastModifiedBy)
	require.Zero(t, p.SortOrder)
	require.False(t, p.HasEffectiveViewRestriction)
	require.False(t, p.HasLocalEditRestriction)
	// client-supplied content is untouched
	require.Equal(t, "kept", p.Title)
	require.Equal(t, "kept", p.Body)
}

func TestPageClone(t *testing.T) {
	parent := NewId()
	p := &Page{
		Id:                       NewId(),
		PendingFileIds:           StringArray{NewId()},
		Properties:               map[string]any{"status": "done"},
		ReparentedParentOnDelete: &parent,
	}
	clone := p.Clone()

	// mutating the clone's slice/map/pointer must not affect the original
	clone.PendingFileIds[0] = "changed"
	clone.Properties["status"] = "draft"
	*clone.ReparentedParentOnDelete = "other"

	require.NotEqual(t, "changed", p.PendingFileIds[0])
	require.Equal(t, "done", p.Properties["status"])
	require.Equal(t, parent, *p.ReparentedParentOnDelete)
}
