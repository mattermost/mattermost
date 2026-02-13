// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWikiIsValid(t *testing.T) {
	testCases := []struct {
		Description     string
		Wiki            *Wiki
		ExpectedIsValid bool
	}{
		{
			"nil wiki",
			&Wiki{},
			false,
		},
		{
			"wiki without create at timestamp",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    0,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki without update at timestamp",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    0,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with missing channel id",
			&Wiki{
				Id:          NewId(),
				ChannelId:   "",
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with invalid channel id",
			&Wiki{
				Id:          NewId(),
				ChannelId:   "invalid",
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with missing title",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "",
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with title exceeding max length",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       strings.Repeat("a", 129),
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with title at max length",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       strings.Repeat("a", 128),
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			true,
		},
		{
			"wiki with description exceeding max length",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: strings.Repeat("a", 1025),
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with description at max length",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: strings.Repeat("a", 1024),
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			true,
		},
		{
			"wiki with icon exceeding max length",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        strings.Repeat("a", 257),
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"wiki with icon at max length",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        strings.Repeat("a", 256),
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			true,
		},
		{
			"valid wiki with all fields",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: "Test description",
				Icon:        ":book:",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			true,
		},
		{
			"valid wiki with minimal fields",
			&Wiki{
				Id:        NewId(),
				ChannelId: NewId(),
				Title:     "Test Wiki",
				CreateAt:  2,
				UpdateAt:  3,
				DeleteAt:  0,
			},
			true,
		},
		{
			"valid wiki with empty optional fields",
			&Wiki{
				Id:          NewId(),
				ChannelId:   NewId(),
				Title:       "Test Wiki",
				Description: "",
				Icon:        "",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			if testCase.ExpectedIsValid {
				require.Nil(t, testCase.Wiki.IsValid())
			} else {
				require.NotNil(t, testCase.Wiki.IsValid())
			}
		})
	}
}

func TestWikiPreSave(t *testing.T) {
	wiki := &Wiki{
		ChannelId:   NewId(),
		Title:       "Test Wiki",
		Description: "Test description",
		Icon:        ":book:",
		DeleteAt:    0,
	}

	originalWiki := &Wiki{
		ChannelId:   wiki.ChannelId,
		Title:       wiki.Title,
		Description: wiki.Description,
		Icon:        wiki.Icon,
		DeleteAt:    wiki.DeleteAt,
	}

	wiki.PreSave()
	assert.NotEmpty(t, wiki.Id)
	assert.NotEqual(t, 0, wiki.CreateAt)
	assert.NotEqual(t, 0, wiki.UpdateAt)
	assert.Equal(t, wiki.CreateAt, wiki.UpdateAt)

	originalWiki.Id = wiki.Id
	originalWiki.CreateAt = wiki.CreateAt
	originalWiki.UpdateAt = wiki.UpdateAt
	originalWiki.SortOrder = wiki.SortOrder
	assert.Equal(t, originalWiki, wiki)
}

func TestWikiPreUpdate(t *testing.T) {
	wiki := &Wiki{
		Id:          NewId(),
		ChannelId:   NewId(),
		Title:       "Test Wiki",
		Description: "Test description",
		Icon:        ":book:",
		CreateAt:    2,
		UpdateAt:    2,
		DeleteAt:    0,
	}

	originalCreateAt := wiki.CreateAt
	originalUpdateAt := wiki.UpdateAt

	wiki.PreUpdate()
	assert.Greater(t, wiki.UpdateAt, originalUpdateAt)
	assert.Equal(t, originalCreateAt, wiki.CreateAt)
}

func TestWikiJSON(t *testing.T) {
	wiki := &Wiki{
		Id:          NewId(),
		ChannelId:   NewId(),
		Title:       "Test Wiki",
		Description: "Test description",
		Icon:        ":book:",
		CreateAt:    GetMillis(),
		UpdateAt:    GetMillis(),
		DeleteAt:    0,
	}

	t.Run("ToJSON and WikiFromJSON round trip", func(t *testing.T) {
		jsonBytes, err := wiki.ToJSON()
		require.Nil(t, err)
		require.NotEmpty(t, jsonBytes)

		decoded, err := WikiFromJSON(jsonBytes)
		require.Nil(t, err)
		require.Equal(t, wiki, decoded)
	})

	t.Run("WikiFromJSON with invalid JSON", func(t *testing.T) {
		_, err := WikiFromJSON([]byte("invalid json"))
		require.NotNil(t, err)
	})
}
