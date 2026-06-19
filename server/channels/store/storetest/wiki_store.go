// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// buildWikiCreateInputs mirrors app.prepareWikiCreateInputs for storetest usage.
// The store.Create signature now takes pre-validated structs; tests previously
// relied on the store doing this construction internally.
func buildWikiCreateInputs(wiki *model.Wiki, creatorId string) (*model.Channel, *model.ChannelMember, *model.Draft) {
	backingChannel := &model.Channel{
		TeamId:      wiki.TeamId,
		Type:        model.ChannelTypeWiki,
		DisplayName: strings.TrimSpace(wiki.Title),
		Name:        "wiki-" + model.NewId()[:20],
		Header:      wiki.Description,
		CreatorId:   creatorId,
	}
	backingChannel.PreSave()

	wiki.ChannelId = backingChannel.Id
	wiki.CreatorId = creatorId
	wiki.PreSave()

	if creatorId == "" {
		return backingChannel, nil, nil
	}

	creatorMember := &model.ChannelMember{
		ChannelId:   backingChannel.Id,
		UserId:      creatorId,
		SchemeUser:  true,
		SchemeAdmin: true,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	creatorMember.PreSave()

	now := model.GetMillis()
	pageId := model.NewId()
	defaultDraft := &model.Draft{
		CreateAt:  now,
		UpdateAt:  now,
		Message:   model.EmptyTipTapJSON,
		RootId:    pageId,
		ChannelId: wiki.Id,
		UserId:    creatorId,
		FileIds:   model.StringArray{},
		Props: model.StringInterface{
			"title":   model.DefaultPageTitle,
			"page_id": pageId,
		},
		Priority: model.StringInterface{},
	}
	return backingChannel, creatorMember, defaultDraft
}

func TestWikiStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveWiki", func(t *testing.T) { testSaveWiki(t, rctx, ss) })
	t.Run("GetWiki", func(t *testing.T) { testGetWiki(t, rctx, ss) })
	t.Run("GetForChannel", func(t *testing.T) { testGetForChannel(t, rctx, ss) })
	t.Run("UpdateWiki", func(t *testing.T) { testUpdateWiki(t, rctx, ss) })
	t.Run("DeleteWiki", func(t *testing.T) { testDeleteWiki(t, rctx, ss) })
	t.Run("MovePageToWiki", func(t *testing.T) { testMovePageToWiki(t, rctx, ss, s) })
	t.Run("Create", func(t *testing.T) { testCreate(t, rctx, ss) })
	t.Run("DeleteWikiCascade", func(t *testing.T) { testDeleteWikiCascade(t, rctx, ss, s) })
	t.Run("GetLinkedToChannel", func(t *testing.T) { testGetLinkedToChannel(t, rctx, ss, s) })
	t.Run("GetByChannelId", func(t *testing.T) { testGetByChannelId(t, rctx, ss) })
	t.Run("GetForTeam", func(t *testing.T) { testGetForTeam(t, rctx, ss) })
	t.Run("GetForUser", func(t *testing.T) { testGetForUser(t, rctx, ss) })

	t.Cleanup(func() {
		typesSQL := pagePostTypesSQL()
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM PropertyValues WHERE TargetType = '"+model.PropertyValueTargetTypePage+"' AND TargetID IN (SELECT Id FROM Posts WHERE Type IN (%s))", typesSQL))
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM Posts WHERE Type IN (%s)", typesSQL))
		// Clean up wikis, channel member links, and channels created by wiki tests
		_, _ = s.GetMaster().Exec("TRUNCATE ChannelMemberLinks CASCADE")
		_, _ = s.GetMaster().Exec("TRUNCATE Wikis CASCADE")
		_, _ = s.GetMaster().Exec("TRUNCATE Channels CASCADE")
	})
}

func testSaveWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId:   channel.Id,
		TeamId:      team.Id,
		CreatorId:   model.NewId(),
		Title:       "Test Wiki",
		Description: "Test wiki description",
	}

	t.Run("save wiki successfully", func(t *testing.T) {
		savedWiki, err := ss.Wiki().Save(wiki)
		require.NoError(t, err)
		require.NotEmpty(t, savedWiki.Id)
		assert.Equal(t, wiki.ChannelId, savedWiki.ChannelId)
		assert.Equal(t, wiki.Title, savedWiki.Title)
		assert.Equal(t, wiki.Description, savedWiki.Description)
		assert.NotZero(t, savedWiki.CreateAt)
		assert.NotZero(t, savedWiki.UpdateAt)
		assert.Zero(t, savedWiki.DeleteAt)
	})
}

func testGetWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		TeamId:    team.Id,
		CreatorId: model.NewId(),
		Title:     "Test Wiki",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	t.Run("get existing wiki", func(t *testing.T) {
		retrieved, getErr := ss.Wiki().Get(wiki.Id)
		require.NoError(t, getErr)
		assert.Equal(t, wiki.Id, retrieved.Id)
		assert.Equal(t, wiki.ChannelId, retrieved.ChannelId)
		assert.Equal(t, wiki.Title, retrieved.Title)
	})

	t.Run("get non-existent wiki", func(t *testing.T) {
		_, getErr := ss.Wiki().Get(model.NewId())
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("get deleted wiki", func(t *testing.T) {
		deletedChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Deleted Wiki Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		deletedChannel, nErr = ss.Channel().Save(rctx, deletedChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, deletedChannel.Id) }()

		deletedWiki := &model.Wiki{
			ChannelId: deletedChannel.Id,
			TeamId:    team.Id,
			CreatorId: model.NewId(),
			Title:     "Deleted Wiki",
		}
		deletedWiki, err = ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)

		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		_, err = ss.Wiki().Get(deletedWiki.Id)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testGetForChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel1 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel 1",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel1, nErr := ss.Channel().Save(rctx, channel1, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel1.Id) }()

	channel2 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel 2",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel2, nErr = ss.Channel().Save(rctx, channel2, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel2.Id) }()

	creatorId := model.NewId()
	wiki1 := &model.Wiki{
		ChannelId: channel1.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Wiki 1",
	}
	_, err = ss.Wiki().Save(wiki1)
	require.NoError(t, err)

	deletedWiki := &model.Wiki{
		ChannelId: channel2.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Deleted Wiki",
	}
	deletedWiki, err = ss.Wiki().Save(deletedWiki)
	require.NoError(t, err)
	err = ss.Wiki().Delete(deletedWiki.Id, false)
	require.NoError(t, err)

	t.Run("get wikis for channel excluding deleted", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForChannel(channel1.Id, false)
		require.NoError(t, err)
		assert.Len(t, wikis, 1)
		assert.Zero(t, wikis[0].DeleteAt)
	})

	t.Run("deleted wiki excluded when includeDeleted is false", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForChannel(channel2.Id, false)
		require.NoError(t, err)
		assert.Empty(t, wikis)
	})

	t.Run("get wikis for channel including deleted", func(t *testing.T) {
		wikis, getErr := ss.Wiki().GetForChannel(channel2.Id, true)
		require.NoError(t, getErr)
		assert.Len(t, wikis, 1)
	})

	t.Run("get wikis for non-existent channel", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForChannel(model.NewId(), false)
		require.NoError(t, err)
		assert.Empty(t, wikis)
	})
}

func testUpdateWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		TeamId:    team.Id,
		CreatorId: model.NewId(),
		Title:     "Original Title",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	t.Run("update wiki successfully", func(t *testing.T) {
		originalUpdateAt := wiki.UpdateAt

		time.Sleep(2 * time.Millisecond)

		wiki.Title = "Updated Title"
		wiki.Description = "Updated description"

		updated, updateErr := ss.Wiki().Update(wiki)
		require.NoError(t, updateErr)
		assert.Equal(t, wiki.Id, updated.Id)
		assert.Equal(t, "Updated Title", updated.Title)
		assert.Equal(t, "Updated description", updated.Description)
		assert.Greater(t, updated.UpdateAt, originalUpdateAt)
	})

	t.Run("update non-existent wiki", func(t *testing.T) {
		nonExistent := &model.Wiki{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			TeamId:    team.Id,
			CreatorId: model.NewId(),
			Title:     "Non-existent",
		}
		_, updateErr := ss.Wiki().Update(nonExistent)
		assert.Error(t, updateErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, updateErr, &nfErr)
	})

	t.Run("update deleted wiki", func(t *testing.T) {
		deletedChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Deleted Wiki Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		deletedChannel, nErr = ss.Channel().Save(rctx, deletedChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, deletedChannel.Id) }()

		deletedWiki := &model.Wiki{
			ChannelId: deletedChannel.Id,
			TeamId:    team.Id,
			CreatorId: model.NewId(),
			Title:     "To be deleted",
		}
		deletedWiki, err = ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)

		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		deletedWiki.Title = "Should not update"
		_, err = ss.Wiki().Update(deletedWiki)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testDeleteWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	t.Run("soft delete wiki", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: channel.Id,
			TeamId:    team.Id,
			CreatorId: model.NewId(),
			Title:     "To be soft deleted",
		}
		wiki, saveErr := ss.Wiki().Save(wiki)
		require.NoError(t, saveErr)

		deleteErr := ss.Wiki().Delete(wiki.Id, false)
		require.NoError(t, deleteErr)

		_, getErr := ss.Wiki().Get(wiki.Id)
		assert.Error(t, getErr)

		wikis, listErr := ss.Wiki().GetForChannel(channel.Id, true)
		require.NoError(t, listErr)
		found := false
		for _, w := range wikis {
			if w.Id == wiki.Id {
				found = true
				assert.NotZero(t, w.DeleteAt)
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("permanent delete wiki", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: channel.Id,
			TeamId:    team.Id,
			CreatorId: model.NewId(),
			Title:     "To be permanently deleted",
		}
		wiki, saveErr := ss.Wiki().Save(wiki)
		require.NoError(t, saveErr)

		deleteErr := ss.Wiki().Delete(wiki.Id, true)
		require.NoError(t, deleteErr)

		_, getErr := ss.Wiki().Get(wiki.Id)
		assert.Error(t, getErr)

		wikis, listErr := ss.Wiki().GetForChannel(channel.Id, true)
		require.NoError(t, listErr)
		for _, w := range wikis {
			assert.NotEqual(t, wiki.Id, w.Id)
		}
	})

	t.Run("delete non-existent wiki", func(t *testing.T) {
		err := ss.Wiki().Delete(model.NewId(), false)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testMovePageToWiki(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	user := &model.User{
		Email:    "test@example.com",
		Username: model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	// Source wiki with its own dedicated backing channel.
	sourceWikiModel := &model.Wiki{
		TeamId:    team.Id,
		CreatorId: user.Id,
		Title:     "Source Wiki",
	}
	sourceBackingChannel, sourceCreatorMember, sourceDraft := buildWikiCreateInputs(sourceWikiModel, user.Id)
	sourceWiki, err := ss.Wiki().Create(rctx, sourceWikiModel, sourceBackingChannel, sourceCreatorMember, sourceDraft)
	require.NoError(t, err)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, sourceWiki.ChannelId) }()

	// Target wiki with its own dedicated backing channel.
	targetWikiModel := &model.Wiki{
		TeamId:    team.Id,
		CreatorId: user.Id,
		Title:     "Target Wiki",
	}
	targetBackingChannel, targetCreatorMember, targetDraft := buildWikiCreateInputs(targetWikiModel, user.Id)
	targetWiki, err := ss.Wiki().Create(rctx, targetWikiModel, targetBackingChannel, targetCreatorMember, targetDraft)
	require.NoError(t, err)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, targetWiki.ChannelId) }()

	t.Run("move single page without children", func(t *testing.T) {
		page := testInsertPage(s, sourceWiki.ChannelId, sourceWiki.Id, user.Id, "", "Root Page")

		err := ss.Wiki().MovePageToWiki(page.Id, targetWiki.Id, targetWiki.ChannelId, nil)
		require.NoError(t, err)

		moved, fetchErr := ss.Page().GetPage(rctx, page.Id, false)
		require.NoError(t, fetchErr)
		assert.Equal(t, targetWiki.Id, moved.WikiId)
		assert.Equal(t, targetWiki.ChannelId, moved.ChannelId)
		assert.Equal(t, "", moved.ParentId)
	})

	t.Run("move page with entire subtree", func(t *testing.T) {
		parent := testInsertPage(s, sourceWiki.ChannelId, sourceWiki.Id, user.Id, "", "Parent Page")
		child1 := testInsertPage(s, sourceWiki.ChannelId, sourceWiki.Id, user.Id, parent.Id, "Child 1")
		child2 := testInsertPage(s, sourceWiki.ChannelId, sourceWiki.Id, user.Id, parent.Id, "Child 2")
		grandchild := testInsertPage(s, sourceWiki.ChannelId, sourceWiki.Id, user.Id, child1.Id, "Grandchild")

		err := ss.Wiki().MovePageToWiki(parent.Id, targetWiki.Id, targetWiki.ChannelId, nil)
		require.NoError(t, err)

		for _, id := range []string{parent.Id, child1.Id, child2.Id, grandchild.Id} {
			moved, fetchErr := ss.Page().GetPage(rctx, id, false)
			require.NoError(t, fetchErr, "id=%s", id)
			assert.Equal(t, targetWiki.Id, moved.WikiId, "WikiId mismatch for id=%s", id)
			assert.Equal(t, targetWiki.ChannelId, moved.ChannelId, "ChannelId mismatch for id=%s", id)
		}

		// Subtree parent relation must not have changed.
		movedChild1, _ := ss.Page().GetPage(rctx, child1.Id, false)
		assert.Equal(t, parent.Id, movedChild1.ParentId)
		movedGrandchild, _ := ss.Page().GetPage(rctx, grandchild.Id, false)
		assert.Equal(t, child1.Id, movedGrandchild.ParentId)
	})

	t.Run("version snapshots follow the move", func(t *testing.T) {
		page := testInsertPage(s, sourceWiki.ChannelId, sourceWiki.Id, user.Id, "", "Versioned Page")
		// Insert a version snapshot row (OriginalId = page.Id, DeleteAt > 0).
		snapshotID := model.NewId()
		now := model.GetMillis()
		_, execErr := s.GetMaster().Exec(
			`INSERT INTO Pages
			  (Id, WikiId, ChannelId, ParentId, Type, Title, Body, SearchText,
			   UserId, LastModifiedBy, SortOrder,
			   CreateAt, UpdateAt, DeleteAt, EditAt, OriginalId,
			   HasEffectiveViewRestriction, HasLocalEditRestriction,
			   ReparentedParentOnDelete, ReparentedChildrenOnDelete)
			 VALUES
			  ($1,$2,$3,$4,$5,$6,'',' ',$7,$7,0,$8,$8,$9,0,$10,false,false,NULL,NULL)`,
			snapshotID, sourceWiki.Id, sourceWiki.ChannelId, "", model.PageTypePage,
			"Versioned Page (snapshot)", user.Id, now, now, page.Id,
		)
		require.NoError(t, execErr)

		err := ss.Wiki().MovePageToWiki(page.Id, targetWiki.Id, targetWiki.ChannelId, nil)
		require.NoError(t, err)

		// Snapshot must now point at the target wiki/channel.
		type wikiChannelRow struct {
			WikiId    string `db:"wikiid"`
			ChannelId string `db:"channelid"`
		}
		var snapshotRows []wikiChannelRow
		rowErr := s.GetMaster().Select(&snapshotRows,
			`SELECT WikiId, ChannelId FROM Pages WHERE Id = $1`, snapshotID)
		require.NoError(t, rowErr)
		require.Len(t, snapshotRows, 1)
		assert.Equal(t, targetWiki.Id, snapshotRows[0].WikiId)
		assert.Equal(t, targetWiki.ChannelId, snapshotRows[0].ChannelId)
	})

	t.Run("move non-existent page", func(t *testing.T) {
		err := ss.Wiki().MovePageToWiki(model.NewId(), targetWiki.Id, targetWiki.ChannelId, nil)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testCreate(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	user := &model.User{
		Email:    "test@example.com",
		Username: model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	t.Run("creates wiki with backing channel and default draft", func(t *testing.T) {
		wiki := &model.Wiki{
			TeamId:      team.Id,
			CreatorId:   user.Id,
			Title:       "Test Wiki",
			Description: "Test wiki description",
		}
		backingChannel, creatorMember, defaultDraft := buildWikiCreateInputs(wiki, user.Id)

		savedWiki, createErr := ss.Wiki().Create(rctx, wiki, backingChannel, creatorMember, defaultDraft)
		require.NoError(t, createErr)
		require.NotEmpty(t, savedWiki.Id)
		require.NotEmpty(t, savedWiki.ChannelId)
		assert.Equal(t, wiki.Title, savedWiki.Title)
		assert.Equal(t, wiki.Description, savedWiki.Description)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, savedWiki.ChannelId) }()

		// Backing channel must be ChannelTypeWiki
		backingChannel, chErr := ss.Channel().GetWikiBackingChannel(savedWiki.ChannelId)
		require.NoError(t, chErr)
		assert.Equal(t, model.ChannelTypeWiki, backingChannel.Type)

		// Creator must be a channel admin member
		member, memberErr := ss.Channel().GetMember(rctx, savedWiki.ChannelId, user.Id)
		require.NoError(t, memberErr)
		assert.True(t, member.SchemeAdmin)

		// Default page draft must exist
		pageDrafts, draftsErr := ss.Draft().GetPageDraftsForUser(user.Id, savedWiki.Id, 0, 200)
		require.NoError(t, draftsErr)
		require.Len(t, pageDrafts, 1)
		assert.Equal(t, user.Id, pageDrafts[0].UserId)
		assert.JSONEq(t, `{"type":"doc","content":[]}`, pageDrafts[0].Message)
	})

	t.Run("creates wiki without draft when creatorId is empty", func(t *testing.T) {
		wiki := &model.Wiki{
			TeamId: team.Id,
			Title:  "No-Creator Wiki",
		}
		backingChannel, _, _ := buildWikiCreateInputs(wiki, "")

		savedWiki, createErr := ss.Wiki().Create(rctx, wiki, backingChannel, nil, nil)
		require.NoError(t, createErr)
		require.NotEmpty(t, savedWiki.Id)
		require.NotEmpty(t, savedWiki.ChannelId)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, savedWiki.ChannelId) }()

		backingChannel, chErr := ss.Channel().GetWikiBackingChannel(savedWiki.ChannelId)
		require.NoError(t, chErr)
		assert.Equal(t, model.ChannelTypeWiki, backingChannel.Type)
	})
}

func testDeleteWikiCascade(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	user := &model.User{
		Email:    "test@example.com",
		Username: model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	makeWiki := func(title string) *model.Wiki {
		wikiModel := &model.Wiki{
			TeamId:      team.Id,
			CreatorId:   user.Id,
			Title:       title,
			Description: title + " description",
		}
		backingChannel, creatorMember, defaultDraft := buildWikiCreateInputs(wikiModel, user.Id)
		w, wikiErr := ss.Wiki().Create(rctx, wikiModel, backingChannel, creatorMember, defaultDraft)
		require.NoError(t, wikiErr)
		t.Cleanup(func() { _ = ss.Channel().PermanentDelete(rctx, w.ChannelId) })
		return w
	}

	t.Run("soft-deletes pages and their drafts", func(t *testing.T) {
		wiki := makeWiki("Cascade Test Wiki")

		page1 := testInsertPage(s, wiki.ChannelId, wiki.Id, user.Id, "", "Page 1")
		page2 := testInsertPage(s, wiki.ChannelId, wiki.Id, user.Id, "", "Page 2")

		// Create a page draft for page1.
		_, draftErr := ss.Draft().UpsertPageDraftContent(page1.Id, user.Id, wiki.Id,
			`{"type":"doc","content":[]}`, 0)
		require.NoError(t, draftErr)

		err := ss.Wiki().DeleteWikiCascade(wiki.Id)
		require.NoError(t, err)

		// Pages must be soft-deleted.
		p1, fetchErr := ss.Page().GetPage(rctx, page1.Id, false)
		assert.Nil(t, p1)
		assert.Error(t, fetchErr)

		p2, fetchErr := ss.Page().GetPage(rctx, page2.Id, false)
		assert.Nil(t, p2)
		assert.Error(t, fetchErr)

		// Wiki must be soft-deleted.
		fetchedWiki, wikiErr := ss.Wiki().Get(wiki.Id)
		assert.Nil(t, fetchedWiki)
		assert.Error(t, wikiErr)

		// Page drafts must be gone.
		pageDrafts, draftsErr := ss.Draft().GetPageDraftsForUser(user.Id, wiki.Id, 0, 200)
		require.NoError(t, draftsErr)
		assert.Len(t, pageDrafts, 0)
	})

	t.Run("purges version snapshots", func(t *testing.T) {
		wiki := makeWiki("Snapshot Cascade Wiki")

		page := testInsertPage(s, wiki.ChannelId, wiki.Id, user.Id, "", "Snapshotted Page")
		// Insert a snapshot row (OriginalId = page.Id, DeleteAt > 0).
		snapshotID := model.NewId()
		now := model.GetMillis()
		_, execErr := s.GetMaster().Exec(
			`INSERT INTO Pages
			  (Id, WikiId, ChannelId, ParentId, Type, Title, Body, SearchText,
			   UserId, LastModifiedBy, SortOrder,
			   CreateAt, UpdateAt, DeleteAt, EditAt, OriginalId,
			   HasEffectiveViewRestriction, HasLocalEditRestriction,
			   ReparentedParentOnDelete, ReparentedChildrenOnDelete)
			 VALUES
			  ($1,$2,$3,$4,$5,$6,'',' ',$7,$7,0,$8,$8,$9,0,$10,false,false,NULL,NULL)`,
			snapshotID, wiki.Id, wiki.ChannelId, "", model.PageTypePage,
			"Snapshotted Page (v1)", user.Id, now, now, page.Id,
		)
		require.NoError(t, execErr)

		err := ss.Wiki().DeleteWikiCascade(wiki.Id)
		require.NoError(t, err)

		// Snapshot row must be gone (hard-deleted in step 4).
		var snapshotCount []int
		cntErr := s.GetMaster().Select(&snapshotCount,
			`SELECT COUNT(*) FROM Pages WHERE Id = $1`, snapshotID)
		require.NoError(t, cntErr)
		require.Len(t, snapshotCount, 1)
		assert.Equal(t, 0, snapshotCount[0], "snapshot row should be hard-deleted")
	})

	t.Run("purges snapshots of pre-deleted pages", func(t *testing.T) {
		wiki := makeWiki("Pre-Deleted Cascade Wiki")

		// Insert a page that was individually soft-deleted before the wiki-delete.
		page := testInsertPage(s, wiki.ChannelId, wiki.Id, user.Id, "", "Pre-Deleted Page")
		_, _ = s.GetMaster().Exec(`UPDATE Pages SET DeleteAt = $1 WHERE Id = $2`, model.GetMillis(), page.Id)

		// Insert a snapshot for that pre-deleted page.
		snapshotID := model.NewId()
		now := model.GetMillis()
		_, execErr := s.GetMaster().Exec(
			`INSERT INTO Pages
			  (Id, WikiId, ChannelId, ParentId, Type, Title, Body, SearchText,
			   UserId, LastModifiedBy, SortOrder,
			   CreateAt, UpdateAt, DeleteAt, EditAt, OriginalId,
			   HasEffectiveViewRestriction, HasLocalEditRestriction,
			   ReparentedParentOnDelete, ReparentedChildrenOnDelete)
			 VALUES
			  ($1,$2,$3,$4,$5,$6,'',' ',$7,$7,0,$8,$8,$9,0,$10,false,false,NULL,NULL)`,
			snapshotID, wiki.Id, wiki.ChannelId, "", model.PageTypePage,
			"Pre-Deleted Page (v1)", user.Id, now, now, page.Id,
		)
		require.NoError(t, execErr)

		err := ss.Wiki().DeleteWikiCascade(wiki.Id)
		require.NoError(t, err)

		// Snapshot must be hard-deleted even though the page was pre-soft-deleted.
		var countPreDeleted []int
		cntErr2 := s.GetMaster().Select(&countPreDeleted,
			`SELECT COUNT(*) FROM Pages WHERE Id = $1`, snapshotID)
		require.NoError(t, cntErr2)
		require.Len(t, countPreDeleted, 1)
		assert.Equal(t, 0, countPreDeleted[0], "snapshot of pre-deleted page should be hard-deleted")
	})

	t.Run("returns not found for non-existent wiki", func(t *testing.T) {
		err := ss.Wiki().DeleteWikiCascade(model.NewId())
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testGetLinkedToChannel(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	sourceChannel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Source Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	sourceChannel, nErr := ss.Channel().Save(rctx, sourceChannel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, sourceChannel.Id) }()

	wikiChannel1 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Wiki Channel 1",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	wikiChannel1, nErr = ss.Channel().Save(rctx, wikiChannel1, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, wikiChannel1.Id) }()

	wikiChannel2 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Wiki Channel 2",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	wikiChannel2, nErr = ss.Channel().Save(rctx, wikiChannel2, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, wikiChannel2.Id) }()

	creatorId := model.NewId()

	wiki1 := &model.Wiki{
		ChannelId: wikiChannel1.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Wiki Alpha",
		SortOrder: 200,
	}
	wiki1, err = ss.Wiki().Save(wiki1)
	require.NoError(t, err)

	wiki2 := &model.Wiki{
		ChannelId: wikiChannel2.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Wiki Beta",
		SortOrder: 100,
	}
	wiki2, err = ss.Wiki().Save(wiki2)
	require.NoError(t, err)

	t.Run("returns wikis linked via ChannelMemberLinks", func(t *testing.T) {
		link1 := &model.ChannelMemberLink{
			SourceId: sourceChannel.Id,

			DestinationId: wikiChannel1.Id,
			CreatorId:     creatorId,
		}
		_, err := ss.ChannelMemberLink().Save(link1)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM ChannelMemberLinks WHERE SourceId = $1 AND DestinationId = $2", sourceChannel.Id, wikiChannel1.Id)
		}()

		link2 := &model.ChannelMemberLink{
			SourceId: sourceChannel.Id,

			DestinationId: wikiChannel2.Id,
			CreatorId:     creatorId,
		}
		_, err = ss.ChannelMemberLink().Save(link2)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM ChannelMemberLinks WHERE SourceId = $1 AND DestinationId = $2", sourceChannel.Id, wikiChannel2.Id)
		}()

		wikis, err := ss.Wiki().GetLinkedToChannel(sourceChannel.Id)
		require.NoError(t, err)
		require.Len(t, wikis, 2)
		assert.Equal(t, wiki2.Id, wikis[0].Id, "wiki2 should be first due to lower SortOrder")
		assert.Equal(t, wiki1.Id, wikis[1].Id, "wiki1 should be second due to higher SortOrder")
	})

	t.Run("returns empty for channel with no links", func(t *testing.T) {
		unlinkedChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Unlinked Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		unlinkedChannel, nErr := ss.Channel().Save(rctx, unlinkedChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, unlinkedChannel.Id) }()

		wikis, err := ss.Wiki().GetLinkedToChannel(unlinkedChannel.Id)
		require.NoError(t, err)
		assert.Empty(t, wikis)
	})

	t.Run("respects SortOrder ordering", func(t *testing.T) {
		sortChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Sort Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		sortChannel, nErr := ss.Channel().Save(rctx, sortChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, sortChannel.Id) }()

		linkHigh := &model.ChannelMemberLink{
			SourceId: sortChannel.Id,

			DestinationId: wikiChannel1.Id,
			CreatorId:     creatorId,
		}
		_, err := ss.ChannelMemberLink().Save(linkHigh)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM ChannelMemberLinks WHERE SourceId = $1 AND DestinationId = $2", sortChannel.Id, wikiChannel1.Id)
		}()

		linkLow := &model.ChannelMemberLink{
			SourceId: sortChannel.Id,

			DestinationId: wikiChannel2.Id,
			CreatorId:     creatorId,
		}
		_, err = ss.ChannelMemberLink().Save(linkLow)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM ChannelMemberLinks WHERE SourceId = $1 AND DestinationId = $2", sortChannel.Id, wikiChannel2.Id)
		}()

		wikis, err := ss.Wiki().GetLinkedToChannel(sortChannel.Id)
		require.NoError(t, err)
		require.Len(t, wikis, 2)
		assert.Equal(t, wiki2.Id, wikis[0].Id, "lower SortOrder should come first")
		assert.Equal(t, wiki1.Id, wikis[1].Id, "higher SortOrder should come second")
	})

	t.Run("excludes deleted wikis", func(t *testing.T) {
		deletedWikiChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Deleted Wiki Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		deletedWikiChannel, nErr := ss.Channel().Save(rctx, deletedWikiChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, deletedWikiChannel.Id) }()

		deletedWiki := &model.Wiki{
			ChannelId: deletedWikiChannel.Id,
			TeamId:    team.Id,
			CreatorId: creatorId,
			Title:     "Deleted Wiki",
		}
		deletedWiki, err := ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)
		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		delChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Del Source",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		delChannel, nErr = ss.Channel().Save(rctx, delChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, delChannel.Id) }()

		link := &model.ChannelMemberLink{
			SourceId: delChannel.Id,

			DestinationId: deletedWikiChannel.Id,
			CreatorId:     creatorId,
		}
		_, err = ss.ChannelMemberLink().Save(link)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM ChannelMemberLinks WHERE SourceId = $1 AND DestinationId = $2", delChannel.Id, deletedWikiChannel.Id)
		}()

		wikis, err := ss.Wiki().GetLinkedToChannel(delChannel.Id)
		require.NoError(t, err)
		assert.Empty(t, wikis)
	})

	t.Run("invalid channel ID returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetLinkedToChannel("invalid-id")
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})
}

func testGetByChannelId(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		TeamId:    team.Id,
		CreatorId: model.NewId(),
		Title:     "Test Wiki",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	t.Run("returns wiki for its backing channel", func(t *testing.T) {
		retrieved, err := ss.Wiki().GetByChannelId(channel.Id)
		require.NoError(t, err)
		assert.Equal(t, wiki.Id, retrieved.Id)
		assert.Equal(t, channel.Id, retrieved.ChannelId)
		assert.Equal(t, wiki.Title, retrieved.Title)
	})

	t.Run("returns ErrNotFound for non-existent channel", func(t *testing.T) {
		_, err := ss.Wiki().GetByChannelId(model.NewId())
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("excludes deleted wikis", func(t *testing.T) {
		deletedChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Deleted Wiki Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		deletedChannel, nErr := ss.Channel().Save(rctx, deletedChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, deletedChannel.Id) }()

		deletedWiki := &model.Wiki{
			ChannelId: deletedChannel.Id,
			TeamId:    team.Id,
			CreatorId: model.NewId(),
			Title:     "Deleted Wiki",
		}
		deletedWiki, err := ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)
		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		_, err = ss.Wiki().GetByChannelId(deletedChannel.Id)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("invalid channel ID returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetByChannelId("invalid-id")
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})
}

func testGetForTeam(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	creatorId := model.NewId()

	channel1 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel 1",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel1, nErr := ss.Channel().Save(rctx, channel1, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel1.Id) }()

	channel2 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel 2",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel2, nErr = ss.Channel().Save(rctx, channel2, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel2.Id) }()

	channel3 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel 3",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel3, nErr = ss.Channel().Save(rctx, channel3, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel3.Id) }()

	wiki1 := &model.Wiki{
		ChannelId: channel1.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Alpha Wiki",
	}
	_, err = ss.Wiki().Save(wiki1)
	require.NoError(t, err)

	wiki2 := &model.Wiki{
		ChannelId: channel2.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Beta Wiki",
	}
	_, err = ss.Wiki().Save(wiki2)
	require.NoError(t, err)

	wiki3 := &model.Wiki{
		ChannelId: channel3.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Gamma Wiki",
	}
	_, err = ss.Wiki().Save(wiki3)
	require.NoError(t, err)

	t.Run("returns all wikis for a team", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForTeam(team.Id, 0, 100)
		require.NoError(t, err)
		require.Len(t, wikis, 3)
	})

	t.Run("ordered by Title ASC", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForTeam(team.Id, 0, 100)
		require.NoError(t, err)
		require.Len(t, wikis, 3)
		assert.Equal(t, "Alpha Wiki", wikis[0].Title)
		assert.Equal(t, "Beta Wiki", wikis[1].Title)
		assert.Equal(t, "Gamma Wiki", wikis[2].Title)
	})

	t.Run("paginated correctly", func(t *testing.T) {
		page0, err := ss.Wiki().GetForTeam(team.Id, 0, 2)
		require.NoError(t, err)
		require.Len(t, page0, 2)
		assert.Equal(t, "Alpha Wiki", page0[0].Title)
		assert.Equal(t, "Beta Wiki", page0[1].Title)

		page1, err := ss.Wiki().GetForTeam(team.Id, 1, 2)
		require.NoError(t, err)
		require.Len(t, page1, 1)
		assert.Equal(t, "Gamma Wiki", page1[0].Title)
	})

	t.Run("excludes deleted wikis", func(t *testing.T) {
		deletedChannel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Deleted Wiki Channel",
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		deletedChannel, nErr := ss.Channel().Save(rctx, deletedChannel, 100)
		require.NoError(t, nErr)
		defer func() { _ = ss.Channel().PermanentDelete(rctx, deletedChannel.Id) }()

		deletedWiki := &model.Wiki{
			ChannelId: deletedChannel.Id,
			TeamId:    team.Id,
			CreatorId: creatorId,
			Title:     "Deleted Wiki",
		}
		deletedWiki, err := ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)
		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		wikis, err := ss.Wiki().GetForTeam(team.Id, 0, 100)
		require.NoError(t, err)
		for _, w := range wikis {
			assert.NotEqual(t, deletedWiki.Id, w.Id)
		}
	})

	t.Run("invalid team ID returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetForTeam("invalid-id", 0, 10)
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("invalid pagination returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetForTeam(team.Id, -1, 10)
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)

		_, err = ss.Wiki().GetForTeam(team.Id, 0, 0)
		assert.Error(t, err)
		assert.ErrorAs(t, err, &iiErr)

		_, err = ss.Wiki().GetForTeam(team.Id, 0, -1)
		assert.Error(t, err)
		assert.ErrorAs(t, err, &iiErr)
	})
}

func testGetForUser(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewRandomTeamName(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	user := &model.User{
		Email:    "testwikiuser@example.com",
		Username: "testwikiuser" + model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	otherUser := &model.User{
		Email:    "otherwikiuser@example.com",
		Username: "otherwikiuser" + model.NewId(),
	}
	otherUser, err = ss.User().Save(rctx, otherUser)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, otherUser.Id) }()

	creatorId := model.NewId()

	channel1 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel 1",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel1, nErr := ss.Channel().Save(rctx, channel1, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel1.Id) }()

	channel2 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel 2",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel2, nErr = ss.Channel().Save(rctx, channel2, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel2.Id) }()

	channel3 := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel 3",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel3, nErr = ss.Channel().Save(rctx, channel3, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel3.Id) }()

	wiki1 := &model.Wiki{
		ChannelId: channel1.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Alpha Wiki",
	}
	wiki1, err = ss.Wiki().Save(wiki1)
	require.NoError(t, err)

	wiki2 := &model.Wiki{
		ChannelId: channel2.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Beta Wiki",
	}
	wiki2, err = ss.Wiki().Save(wiki2)
	require.NoError(t, err)

	wiki3 := &model.Wiki{
		ChannelId: channel3.Id,
		TeamId:    team.Id,
		CreatorId: creatorId,
		Title:     "Gamma Wiki",
	}
	wiki3, err = ss.Wiki().Save(wiki3)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   channel1.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	t.Run("returns wikis where user is a channel member", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForUser(user.Id, team.Id, 0, 100)
		require.NoError(t, err)
		require.Len(t, wikis, 2)

		wikiIds := make(map[string]bool)
		for _, w := range wikis {
			wikiIds[w.Id] = true
		}
		assert.True(t, wikiIds[wiki1.Id])
		assert.True(t, wikiIds[wiki2.Id])
	})

	t.Run("excludes wikis where user has no membership", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForUser(user.Id, team.Id, 0, 100)
		require.NoError(t, err)
		for _, w := range wikis {
			assert.NotEqual(t, wiki3.Id, w.Id)
		}
	})

	t.Run("includes synthetic members with SourceId set", func(t *testing.T) {
		_, err := ss.Channel().SaveMember(rctx, &model.ChannelMember{
			ChannelId:   channel3.Id,
			UserId:      otherUser.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SourceId:    model.NewId(),
		})
		require.NoError(t, err)

		wikis, err := ss.Wiki().GetForUser(otherUser.Id, team.Id, 0, 100)
		require.NoError(t, err)
		found := false
		for _, w := range wikis {
			if w.Id == wiki3.Id {
				found = true
				break
			}
		}
		assert.True(t, found, "synthetic member should have access to wiki3")
	})

	t.Run("paginated and ordered by Title ASC", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForUser(user.Id, team.Id, 0, 1)
		require.NoError(t, err)
		require.Len(t, wikis, 1)
		assert.Equal(t, "Alpha Wiki", wikis[0].Title)

		wikis, err = ss.Wiki().GetForUser(user.Id, team.Id, 1, 1)
		require.NoError(t, err)
		require.Len(t, wikis, 1)
		assert.Equal(t, "Beta Wiki", wikis[0].Title)
	})

	t.Run("invalid user ID returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetForUser("invalid-id", team.Id, 0, 10)
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("invalid team ID returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetForUser(user.Id, "invalid-id", 0, 10)
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("invalid pagination returns error", func(t *testing.T) {
		_, err := ss.Wiki().GetForUser(user.Id, team.Id, -1, 10)
		assert.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)

		_, err = ss.Wiki().GetForUser(user.Id, team.Id, 0, 0)
		assert.Error(t, err)
		assert.ErrorAs(t, err, &iiErr)
	})
}
