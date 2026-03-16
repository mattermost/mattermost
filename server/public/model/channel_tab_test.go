// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelTabIsValid(t *testing.T) {
	testCases := []struct {
		Description     string
		Tab        *ChannelTab
		ExpectedIsValid bool
	}{
		{
			"nil bookmark",
			&ChannelTab{},
			false,
		},
		{
			"bookmark without create at timestamp",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   "",
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    0,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark without update at timestamp",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   "",
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    0,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with missing channel id",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   "",
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with invalid channel id",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   "invalid",
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with missing owner id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     "",
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with invalid user id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     "invalid",
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with missing displayname",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with missing type",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        "",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark with invalid type",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        "invalid",
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark of type link with missing link url",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark of type link with invalid link url",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "invalid",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark of type link with valid link url",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "https://mattermost.com",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			true,
		},
		{
			"bookmark of type link with empty image url",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "https://mattermost.com",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			true,
		},
		{
			"bookmark of type link with invalid image url",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "https://mattermost.com",
				ImageUrl:    "invalid",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark of type link with valid image url",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "https://mattermost.com",
				ImageUrl:    "https://mattermost.com/some-image-without-extension", // we don't care if the URL is an actual image as the client should handle the error
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			true,
		},
		{
			"bookmark of type file with missing file id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabFile,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark of type file with invalid file id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      "invalid",
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabFile,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			false,
		},
		{
			"bookmark of type file with valid file id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      NewId(),
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabFile,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
			},
			true,
		},
		{
			"bookmark of type file with invalid original id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      NewId(),
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabFile,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
				OriginalId:  "invalid",
			},
			false,
		},
		{
			"bookmark of type file with invalid parent id",
			&ChannelTab{
				Id:          NewId(),
				ChannelId:   NewId(),
				OwnerId:     NewId(),
				FileId:      NewId(),
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabFile,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    4,
				ParentId:    "invalid",
			},
			false,
		},
		{
			"bookmark of type link with a file Id attached",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   NewId(),
				FileId:      NewId(),
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "http://somelink",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"bookmark of type file with a url",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   NewId(),
				FileId:      NewId(),
				DisplayName: "display name",
				SortOrder:   0,
				LinkUrl:     "http://somelink",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabFile,
				CreateAt:    2,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"bookmark with long display name > limit",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   NewId(),
				FileId:      "",
				DisplayName: strings.Repeat("1", 65),
				SortOrder:   0,
				LinkUrl:     "http://somelink",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    3,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"bookmark with long display name < limit",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   NewId(),
				FileId:      "",
				DisplayName: strings.Repeat("1", 64),
				SortOrder:   0,
				LinkUrl:     "http://somelink",
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    3,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			true,
		},

		{
			"bookmark with link url > limit",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   NewId(),
				FileId:      "",
				DisplayName: "not last test",
				SortOrder:   0,
				LinkUrl:     "http://somelink?" + strings.Repeat("h", 1024),
				ImageUrl:    "",
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    3,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
		{
			"bookmark with image url > limit",
			&ChannelTab{
				Id:          NewId(),
				OwnerId:     NewId(),
				ChannelId:   NewId(),
				FileId:      "",
				DisplayName: "last test",
				SortOrder:   0,
				LinkUrl:     "",
				ImageUrl:    "http://somelink?" + strings.Repeat("h", 1024),
				Emoji:       "",
				Type:        ChannelTabLink,
				CreateAt:    3,
				UpdateAt:    3,
				DeleteAt:    0,
			},
			false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			if testCase.ExpectedIsValid {
				require.Nil(t, testCase.Tab.IsValid())
			} else {
				require.NotNil(t, testCase.Tab.IsValid())
			}
		})
	}
}

func TestChannelTabPreSave(t *testing.T) {
	bookmark := &ChannelTab{
		Id:          NewId(),
		ChannelId:   NewId(),
		OwnerId:     NewId(),
		DisplayName: "display name",
		SortOrder:   0,
		LinkUrl:     "https://mattermost.com",
		Type:        ChannelTabLink,
		DeleteAt:    0,
	}

	originalTab := &ChannelTab{
		Id:          bookmark.Id,
		ChannelId:   bookmark.ChannelId,
		OwnerId:     bookmark.OwnerId,
		DisplayName: bookmark.DisplayName,
		SortOrder:   bookmark.SortOrder,
		LinkUrl:     bookmark.LinkUrl,
		Type:        bookmark.Type,
		DeleteAt:    bookmark.DeleteAt,
	}

	bookmark.PreSave()
	assert.NotEqual(t, 0, bookmark.CreateAt)
	assert.NotEqual(t, 0, bookmark.UpdateAt)

	originalTab.CreateAt = bookmark.CreateAt
	originalTab.UpdateAt = bookmark.UpdateAt
	assert.Equal(t, originalTab, bookmark)
}

func TestChannelTabPreUpdate(t *testing.T) {
	bookmark := &ChannelTab{
		Id:          NewId(),
		ChannelId:   NewId(),
		OwnerId:     NewId(),
		DisplayName: "display name",
		SortOrder:   0,
		LinkUrl:     "https://mattermost.com",
		Type:        ChannelTabLink,
		CreateAt:    2,
		DeleteAt:    0,
	}

	originalTab := &ChannelTab{
		Id:          bookmark.Id,
		ChannelId:   bookmark.ChannelId,
		OwnerId:     bookmark.OwnerId,
		DisplayName: bookmark.DisplayName,
		SortOrder:   bookmark.SortOrder,
		LinkUrl:     bookmark.LinkUrl,
		Type:        bookmark.Type,
		DeleteAt:    bookmark.DeleteAt,
	}

	bookmark.PreSave()
	assert.NotEqual(t, 0, bookmark.UpdateAt)

	originalTab.CreateAt = bookmark.CreateAt
	originalTab.UpdateAt = bookmark.UpdateAt
	assert.Equal(t, originalTab, bookmark)

	bookmark.PreUpdate()
	assert.Greater(t, bookmark.UpdateAt, originalTab.UpdateAt)
}

func TestToTabWithFileInfo(t *testing.T) {
	testCases := []struct {
		name          string
		bookmark      *ChannelTab
		fileInfo      *FileInfo
		expectedEmoji string
	}{
		{
			name: "emoji with colons",
			bookmark: &ChannelTab{
				Id:          NewId(),
				DisplayName: "test bookmark",
				Emoji:       ":smile:",
				Type:        ChannelTabLink,
			},
			fileInfo:      nil,
			expectedEmoji: "smile",
		},
		{
			name: "emoji without colons",
			bookmark: &ChannelTab{
				Id:          NewId(),
				DisplayName: "test bookmark",
				Emoji:       "smile",
				Type:        ChannelTabLink,
			},
			fileInfo:      nil,
			expectedEmoji: "smile",
		},
		{
			name: "empty emoji",
			bookmark: &ChannelTab{
				Id:          NewId(),
				DisplayName: "test bookmark",
				Emoji:       "",
				Type:        ChannelTabLink,
			},
			fileInfo:      nil,
			expectedEmoji: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.bookmark.ToTabWithFileInfo(tc.fileInfo)
			assert.Equal(t, tc.expectedEmoji, result.Emoji)
		})
	}
}

func TestChannelTabPatch(t *testing.T) {
	p := &ChannelTabPatch{
		DisplayName: NewPointer(NewId()),
		SortOrder:   NewPointer(int64(1)),
		LinkUrl:     NewPointer(NewId()),
	}

	b := ChannelTab{
		Id:          NewId(),
		DisplayName: NewId(),
		Type:        ChannelTabLink, // should not update
		LinkUrl:     NewId(),
	}
	b.Patch(p)

	require.Empty(t, b.FileId)
	require.Equal(t, *p.DisplayName, b.DisplayName)
	require.Equal(t, *p.SortOrder, b.SortOrder)
	require.Equal(t, *p.LinkUrl, b.LinkUrl)
	require.Equal(t, ChannelTabLink, b.Type)
}
