// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestChannelMemberLinkStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveChannelMemberLink", func(t *testing.T) { testSaveChannelMemberLink(t, rctx, ss) })
	t.Run("GetChannelMemberLink", func(t *testing.T) { testGetChannelMemberLink(t, rctx, ss) })
	t.Run("GetBySource", func(t *testing.T) { testGetBySource(t, rctx, ss) })
	t.Run("GetByDestination", func(t *testing.T) { testGetByDestination(t, rctx, ss) })
	t.Run("DeleteChannelMemberLink", func(t *testing.T) { testDeleteChannelMemberLink(t, rctx, ss) })
	t.Run("DeleteByDestination", func(t *testing.T) { testDeleteByDestination(t, rctx, ss) })
	t.Run("SaveAndPropagateMembers", func(t *testing.T) { testSaveAndPropagateMembers(t, rctx, ss, s) })
	t.Run("DeleteAndCleanupMembers", func(t *testing.T) { testDeleteAndCleanupMembers(t, rctx, ss, s) })

	t.Cleanup(func() {
		_, _ = s.GetMaster().Exec("DELETE FROM ChannelMemberLinks")
	})
}

func testSaveChannelMemberLink(t *testing.T, rctx request.CTX, ss store.Store) {
	sourceID := model.NewId()
	destinationID := model.NewId()

	t.Run("save valid link", func(t *testing.T) {
		link := &model.ChannelMemberLink{
			SourceId:      sourceID,
			DestinationId: destinationID,
			CreatorId:     model.NewId(),
		}

		saved, err := ss.ChannelMemberLink().Save(link)
		require.NoError(t, err)
		require.NotNil(t, saved)
		assert.Equal(t, sourceID, saved.SourceId)
		assert.Equal(t, destinationID, saved.DestinationId)
		assert.Equal(t, link.CreatorId, saved.CreatorId)
		assert.NotZero(t, saved.CreateAt)
	})

	t.Run("save duplicate", func(t *testing.T) {
		link := &model.ChannelMemberLink{
			SourceId:      sourceID,
			DestinationId: destinationID,
		}

		_, err := ss.ChannelMemberLink().Save(link)
		assert.Error(t, err)
	})

	t.Run("save invalid source_id", func(t *testing.T) {
		link := &model.ChannelMemberLink{
			SourceId:      "invalid",
			DestinationId: model.NewId(),
		}

		_, err := ss.ChannelMemberLink().Save(link)
		assert.Error(t, err)
	})

	t.Run("save invalid destination_id", func(t *testing.T) {
		link := &model.ChannelMemberLink{
			SourceId:      model.NewId(),
			DestinationId: "invalid",
		}

		_, err := ss.ChannelMemberLink().Save(link)
		assert.Error(t, err)
	})

	t.Run("save self-link", func(t *testing.T) {
		selfID := model.NewId()
		link := &model.ChannelMemberLink{
			SourceId:      selfID,
			DestinationId: selfID,
		}

		_, err := ss.ChannelMemberLink().Save(link)
		assert.Error(t, err)
	})
}

func testGetChannelMemberLink(t *testing.T, rctx request.CTX, ss store.Store) {
	sourceID := model.NewId()
	destinationID := model.NewId()
	creatorID := model.NewId()

	link := &model.ChannelMemberLink{
		SourceId:      sourceID,
		DestinationId: destinationID,
		CreatorId:     creatorID,
	}
	_, err := ss.ChannelMemberLink().Save(link)
	require.NoError(t, err)

	t.Run("get existing", func(t *testing.T) {
		retrieved, getErr := ss.ChannelMemberLink().Get(sourceID, destinationID)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
		assert.Equal(t, sourceID, retrieved.SourceId)
		assert.Equal(t, destinationID, retrieved.DestinationId)
		assert.Equal(t, creatorID, retrieved.CreatorId)
		assert.NotZero(t, retrieved.CreateAt)
	})

	t.Run("get non-existent", func(t *testing.T) {
		_, getErr := ss.ChannelMemberLink().Get(model.NewId(), model.NewId())
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})
}

func testGetBySource(t *testing.T, rctx request.CTX, ss store.Store) {
	sourceID := model.NewId()

	dest1 := model.NewId()
	dest2 := model.NewId()
	dest3 := model.NewId()

	creatorId := model.NewId()
	link1 := &model.ChannelMemberLink{
		SourceId:      sourceID,
		DestinationId: dest1,
		CreatorId:     creatorId,
	}
	_, err := ss.ChannelMemberLink().Save(link1)
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)

	link2 := &model.ChannelMemberLink{
		SourceId:      sourceID,
		DestinationId: dest2,
		CreatorId:     creatorId,
	}
	_, err = ss.ChannelMemberLink().Save(link2)
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)

	link3 := &model.ChannelMemberLink{
		SourceId:      sourceID,
		DestinationId: dest3,
		CreatorId:     creatorId,
	}
	_, err = ss.ChannelMemberLink().Save(link3)
	require.NoError(t, err)

	t.Run("returns all 3 ordered by CreateAt", func(t *testing.T) {
		links, getErr := ss.ChannelMemberLink().GetBySource(sourceID)
		require.NoError(t, getErr)
		require.Len(t, links, 3)

		assert.Equal(t, dest1, links[0].DestinationId)
		assert.Equal(t, dest2, links[1].DestinationId)
		assert.Equal(t, dest3, links[2].DestinationId)
	})

	t.Run("no links returns empty slice", func(t *testing.T) {
		links, getErr := ss.ChannelMemberLink().GetBySource(model.NewId())
		require.NoError(t, getErr)
		assert.Empty(t, links)
	})
}

func testGetByDestination(t *testing.T, rctx request.CTX, ss store.Store) {
	destinationID := model.NewId()
	creatorId := model.NewId()

	src1 := model.NewId()
	src2 := model.NewId()
	src3 := model.NewId()

	link1 := &model.ChannelMemberLink{
		SourceId:      src1,
		DestinationId: destinationID,
		CreatorId:     creatorId,
	}
	_, err := ss.ChannelMemberLink().Save(link1)
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)

	link2 := &model.ChannelMemberLink{
		SourceId:      src2,
		DestinationId: destinationID,
		CreatorId:     creatorId,
	}
	_, err = ss.ChannelMemberLink().Save(link2)
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)

	link3 := &model.ChannelMemberLink{
		SourceId:      src3,
		DestinationId: destinationID,
		CreatorId:     creatorId,
	}
	_, err = ss.ChannelMemberLink().Save(link3)
	require.NoError(t, err)

	t.Run("returns all 3 ordered by CreateAt", func(t *testing.T) {
		links, getErr := ss.ChannelMemberLink().GetByDestination(destinationID)
		require.NoError(t, getErr)
		require.Len(t, links, 3)

		assert.Equal(t, src1, links[0].SourceId)
		assert.Equal(t, src2, links[1].SourceId)
		assert.Equal(t, src3, links[2].SourceId)
	})

	t.Run("no links returns empty slice", func(t *testing.T) {
		links, getErr := ss.ChannelMemberLink().GetByDestination(model.NewId())
		require.NoError(t, getErr)
		assert.Empty(t, links)
	})
}

func testDeleteChannelMemberLink(t *testing.T, rctx request.CTX, ss store.Store) {
	sourceID := model.NewId()
	destinationID := model.NewId()

	link := &model.ChannelMemberLink{
		SourceId:      sourceID,
		DestinationId: destinationID,
		CreatorId:     model.NewId(),
	}
	_, err := ss.ChannelMemberLink().Save(link)
	require.NoError(t, err)

	t.Run("delete existing", func(t *testing.T) {
		deleteErr := ss.ChannelMemberLink().Delete(sourceID, destinationID)
		require.NoError(t, deleteErr)

		_, getErr := ss.ChannelMemberLink().Get(sourceID, destinationID)
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("delete non-existent", func(t *testing.T) {
		deleteErr := ss.ChannelMemberLink().Delete(model.NewId(), model.NewId())
		assert.Error(t, deleteErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, deleteErr, &nfErr)
	})
}

func testDeleteByDestination(t *testing.T, rctx request.CTX, ss store.Store) {
	destinationID := model.NewId()

	for range 3 {
		link := &model.ChannelMemberLink{
			SourceId:      model.NewId(),
			DestinationId: destinationID,
			CreatorId:     model.NewId(),
		}
		_, err := ss.ChannelMemberLink().Save(link)
		require.NoError(t, err)
	}

	t.Run("multiple links to same dest all deleted", func(t *testing.T) {
		links, getErr := ss.ChannelMemberLink().GetByDestination(destinationID)
		require.NoError(t, getErr)
		require.Len(t, links, 3)

		deleteErr := ss.ChannelMemberLink().DeleteByDestination(destinationID)
		require.NoError(t, deleteErr)

		links, getErr = ss.ChannelMemberLink().GetByDestination(destinationID)
		require.NoError(t, getErr)
		assert.Empty(t, links)
	})

	t.Run("no matching links no error", func(t *testing.T) {
		deleteErr := ss.ChannelMemberLink().DeleteByDestination(model.NewId())
		assert.NoError(t, deleteErr)
	})
}

// createChannelForLinkTest creates a team and channel for use in link propagation tests.
func createChannelForLinkTest(t *testing.T, rctx request.CTX, ss store.Store, teamID string) *model.Channel {
	t.Helper()
	ch := &model.Channel{
		TeamId:      teamID,
		DisplayName: "Link Test Channel " + model.NewId(),
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	ch, err := ss.Channel().Save(rctx, ch, 100)
	require.NoError(t, err)
	return ch
}

// createUserForLinkTest creates a user for use in link propagation tests.
func createUserForLinkTest(t *testing.T, rctx request.CTX, ss store.Store) *model.User {
	t.Helper()
	u := &model.User{
		Email:    MakeEmail(),
		Nickname: model.NewId(),
	}
	u, err := ss.User().Save(rctx, u)
	require.NoError(t, err)
	return u
}

// addChannelMemberForLinkTest adds a user to a channel as a direct member (no SourceId).
func addChannelMemberForLinkTest(t *testing.T, rctx request.CTX, ss store.Store, channelID, userID string) {
	t.Helper()
	cm := &model.ChannelMember{
		ChannelId:   channelID,
		UserId:      userID,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, err := ss.Channel().SaveMember(rctx, cm)
	require.NoError(t, err)
}

func testSaveAndPropagateMembers(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		DisplayName: "Link Propagation Team",
		Name:        model.NewId(),
		Email:       "linktest@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	creatorID := model.NewId()

	t.Run("propagates members from source to destination", func(t *testing.T) {
		sourceChannel := createChannelForLinkTest(t, rctx, ss, team.Id)
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)

		user1 := createUserForLinkTest(t, rctx, ss)
		user2 := createUserForLinkTest(t, rctx, ss)
		addChannelMemberForLinkTest(t, rctx, ss, sourceChannel.Id, user1.Id)
		addChannelMemberForLinkTest(t, rctx, ss, sourceChannel.Id, user2.Id)

		link := &model.ChannelMemberLink{
			SourceId:      sourceChannel.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}

		saved, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link, sourceChannel.Id, false)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)
		assert.Equal(t, sourceChannel.Id, saved.SourceId)
		assert.Equal(t, destChannel.Id, saved.DestinationId)

		// Verify the link was saved
		retrieved, getErr := ss.ChannelMemberLink().Get(sourceChannel.Id, destChannel.Id)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)

		// Verify both users were propagated to destination with SourceId set
		m1, mErr := ss.Channel().GetMember(rctx, destChannel.Id, user1.Id)
		require.NoError(t, mErr)
		assert.Equal(t, sourceChannel.Id, m1.SourceId)

		m2, mErr := ss.Channel().GetMember(rctx, destChannel.Id, user2.Id)
		require.NoError(t, mErr)
		assert.Equal(t, sourceChannel.Id, m2.SourceId)
	})

	t.Run("does not duplicate members already in destination", func(t *testing.T) {
		sourceChannel := createChannelForLinkTest(t, rctx, ss, team.Id)
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)

		user1 := createUserForLinkTest(t, rctx, ss)
		addChannelMemberForLinkTest(t, rctx, ss, sourceChannel.Id, user1.Id)
		addChannelMemberForLinkTest(t, rctx, ss, destChannel.Id, user1.Id)

		link := &model.ChannelMemberLink{
			SourceId:      sourceChannel.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}

		saved, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link, sourceChannel.Id, false)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)

		// User1 should still be a direct member (SourceId empty), not overwritten
		m1, mErr := ss.Channel().GetMember(rctx, destChannel.Id, user1.Id)
		require.NoError(t, mErr)
		assert.Empty(t, m1.SourceId)
	})

	t.Run("empty source channel saves link but propagates no members", func(t *testing.T) {
		sourceChannel := createChannelForLinkTest(t, rctx, ss, team.Id)
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)

		link := &model.ChannelMemberLink{
			SourceId:      sourceChannel.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}

		saved, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link, sourceChannel.Id, false)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)

		// Link should be saved
		retrieved, getErr := ss.ChannelMemberLink().Get(sourceChannel.Id, destChannel.Id)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
	})

	t.Run("invalid sourceChannelId returns error", func(t *testing.T) {
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)
		sourceID := model.NewId()

		link := &model.ChannelMemberLink{
			SourceId:      sourceID,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}

		_, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link, "invalid", false)
		assert.Error(t, saveErr)
		var inputErr *store.ErrInvalidInput
		assert.ErrorAs(t, saveErr, &inputErr)
	})
}

func testDeleteAndCleanupMembers(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		DisplayName: "Link Cleanup Team",
		Name:        model.NewId(),
		Email:       "cleanup@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	creatorID := model.NewId()

	t.Run("deletes link and removes synthetic members", func(t *testing.T) {
		sourceChannel := createChannelForLinkTest(t, rctx, ss, team.Id)
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)

		user1 := createUserForLinkTest(t, rctx, ss)
		user2 := createUserForLinkTest(t, rctx, ss)
		addChannelMemberForLinkTest(t, rctx, ss, sourceChannel.Id, user1.Id)
		addChannelMemberForLinkTest(t, rctx, ss, sourceChannel.Id, user2.Id)

		link := &model.ChannelMemberLink{
			SourceId:      sourceChannel.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}
		_, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link, sourceChannel.Id, false)
		require.NoError(t, saveErr)

		// Verify synthetic members exist
		_, mErr := ss.Channel().GetMember(rctx, destChannel.Id, user1.Id)
		require.NoError(t, mErr)
		_, mErr = ss.Channel().GetMember(rctx, destChannel.Id, user2.Id)
		require.NoError(t, mErr)

		// Delete the link and cleanup
		deleteErr := ss.ChannelMemberLink().DeleteAndCleanupMembers(rctx, sourceChannel.Id, destChannel.Id)
		require.NoError(t, deleteErr)

		// Link should be gone
		_, getErr := ss.ChannelMemberLink().Get(sourceChannel.Id, destChannel.Id)
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)

		// Synthetic members should be removed
		_, mErr = ss.Channel().GetMember(rctx, destChannel.Id, user1.Id)
		assert.Error(t, mErr)
		_, mErr = ss.Channel().GetMember(rctx, destChannel.Id, user2.Id)
		assert.Error(t, mErr)
	})

	t.Run("direct members of destination are not removed", func(t *testing.T) {
		sourceChannel := createChannelForLinkTest(t, rctx, ss, team.Id)
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)

		user1 := createUserForLinkTest(t, rctx, ss)
		syntheticUser := createUserForLinkTest(t, rctx, ss)

		// user1 is a direct member of destination (added before link)
		addChannelMemberForLinkTest(t, rctx, ss, destChannel.Id, user1.Id)

		// syntheticUser is a member of source and will be propagated
		addChannelMemberForLinkTest(t, rctx, ss, sourceChannel.Id, syntheticUser.Id)

		link := &model.ChannelMemberLink{
			SourceId:      sourceChannel.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}
		_, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link, sourceChannel.Id, false)
		require.NoError(t, saveErr)

		// Delete link and cleanup
		deleteErr := ss.ChannelMemberLink().DeleteAndCleanupMembers(rctx, sourceChannel.Id, destChannel.Id)
		require.NoError(t, deleteErr)

		// Direct member should still be present
		m1, mErr := ss.Channel().GetMember(rctx, destChannel.Id, user1.Id)
		require.NoError(t, mErr)
		assert.Empty(t, m1.SourceId)

		// Synthetic member should be removed
		_, mErr = ss.Channel().GetMember(rctx, destChannel.Id, syntheticUser.Id)
		assert.Error(t, mErr)
	})

	t.Run("members linked from multiple sources are not removed", func(t *testing.T) {
		source1 := createChannelForLinkTest(t, rctx, ss, team.Id)
		source2 := createChannelForLinkTest(t, rctx, ss, team.Id)
		destChannel := createChannelForLinkTest(t, rctx, ss, team.Id)

		sharedUser := createUserForLinkTest(t, rctx, ss)

		// sharedUser is a direct member of both source channels
		addChannelMemberForLinkTest(t, rctx, ss, source1.Id, sharedUser.Id)
		addChannelMemberForLinkTest(t, rctx, ss, source2.Id, sharedUser.Id)

		// Link source1 -> dest (propagates sharedUser with SourceId=source1)
		link1 := &model.ChannelMemberLink{
			SourceId:      source1.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}
		_, saveErr := ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link1, source1.Id, false)
		require.NoError(t, saveErr)

		// Link source2 -> dest (sharedUser already in dest, not duplicated)
		link2 := &model.ChannelMemberLink{
			SourceId:      source2.Id,
			DestinationId: destChannel.Id,
			CreatorId:     creatorID,
		}
		_, saveErr = ss.ChannelMemberLink().SaveAndPropagateMembers(rctx, link2, source2.Id, false)
		require.NoError(t, saveErr)

		// Verify sharedUser is in dest with SourceId=source1 (first link that propagated)
		m, mErr := ss.Channel().GetMember(rctx, destChannel.Id, sharedUser.Id)
		require.NoError(t, mErr)
		assert.Equal(t, source1.Id, m.SourceId)

		// Delete link1 (source1 -> dest)
		deleteErr := ss.ChannelMemberLink().DeleteAndCleanupMembers(rctx, source1.Id, destChannel.Id)
		require.NoError(t, deleteErr)

		// sharedUser should still be in dest because source2 link still exists
		m, mErr = ss.Channel().GetMember(rctx, destChannel.Id, sharedUser.Id)
		require.NoError(t, mErr)
		assert.Equal(t, source2.Id, m.SourceId)
	})

	t.Run("non-existent link returns not found error", func(t *testing.T) {
		deleteErr := ss.ChannelMemberLink().DeleteAndCleanupMembers(rctx, model.NewId(), model.NewId())
		assert.Error(t, deleteErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, deleteErr, &nfErr)
	})
}
