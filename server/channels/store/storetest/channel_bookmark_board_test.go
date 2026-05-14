// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func testBoardBookmarkSaveAndGet(t *testing.T, _ request.CTX, ss store.Store, s SqlStore) {
	t.Helper()

	channelID := model.NewId()
	userID := model.NewId()
	boardChannelID := model.NewId()
	linkPath := "/team/boards/" + boardChannelID

	bookmark := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Engineering Roadmap",
		LinkUrl:     linkPath,
		Type:        model.ChannelBookmarkBoard,
		TargetId:    boardChannelID,
	}

	saved, err := ss.ChannelBookmark().Save(bookmark, true)
	require.NoError(t, err)
	require.NotNil(t, saved)
	assert.Equal(t, model.ChannelBookmarkBoard, saved.Type)
	assert.Equal(t, boardChannelID, saved.TargetId)
	assert.Equal(t, linkPath, saved.LinkUrl)

	loaded, err := ss.ChannelBookmark().Get(saved.Id, false)
	require.NoError(t, err)
	assert.Equal(t, model.ChannelBookmarkBoard, loaded.Type)
	assert.Equal(t, boardChannelID, loaded.TargetId)
	assert.Equal(t, linkPath, loaded.LinkUrl)

	if s.DriverName() != model.DatabaseDriverPostgres {
		return
	}

	linkBookmark := &model.ChannelBookmark{
		ChannelId:   channelID,
		OwnerId:     userID,
		DisplayName: "Plain link",
		LinkUrl:     "https://example.com",
		Type:        model.ChannelBookmarkLink,
	}
	linkSaved, err := ss.ChannelBookmark().Save(linkBookmark, true)
	require.NoError(t, err)

	sentinel := model.NewId()
	var count int
	err = s.GetMaster().Get(&count,
		"SELECT COUNT(*) FROM channelbookmarks WHERE id = ? AND targetid = ?",
		linkSaved.Id, sentinel)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "NULL targetid must not match a concrete target id lookup")
}
