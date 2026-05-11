// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"encoding/json"
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

func getPagePropertyIDs(t *testing.T, ss store.Store) (groupID string, fieldID string) {
	group, err := ss.PropertyGroup().Register(&model.PropertyGroup{Name: "pages"})
	require.NoError(t, err)
	require.NotNil(t, group)

	// Create wiki field if it doesn't exist
	field, err := ss.PropertyField().GetFieldByName(context.Background(), group.ID, "", "wiki")
	if err != nil {
		// Field doesn't exist, create it
		field, err = ss.PropertyField().Create(&model.PropertyField{
			GroupID: group.ID,
			Name:    "wiki",
			Type:    model.PropertyFieldTypeText,
			Attrs:   map[string]any{},
		})
		require.NoError(t, err)
		require.NotNil(t, field)
	}

	return group.ID, field.ID
}

func TestWikiStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveWiki", func(t *testing.T) { testSaveWiki(t, rctx, ss) })
	t.Run("GetWiki", func(t *testing.T) { testGetWiki(t, rctx, ss) })
	t.Run("GetForChannel", func(t *testing.T) { testGetForChannel(t, rctx, ss) })
	t.Run("UpdateWiki", func(t *testing.T) { testUpdateWiki(t, rctx, ss) })
	t.Run("DeleteWiki", func(t *testing.T) { testDeleteWiki(t, rctx, ss) })
	t.Run("GetPages", func(t *testing.T) { testGetPages(t, rctx, ss) })
	t.Run("MovePageToWiki", func(t *testing.T) { testMovePageToWiki(t, rctx, ss) })
	t.Run("Create", func(t *testing.T) { testCreate(t, rctx, ss) })
	t.Run("DeleteAllPagesForWiki", func(t *testing.T) { testDeleteAllPagesForWiki(t, rctx, ss) })
	t.Run("GetAbandonedPages", func(t *testing.T) { testGetAbandonedPages(t, rctx, ss) })
	t.Run("GetLinkedToChannel", func(t *testing.T) { testGetLinkedToChannel(t, rctx, ss, s) })
	t.Run("GetByChannelId", func(t *testing.T) { testGetByChannelId(t, rctx, ss) })
	t.Run("GetForTeam", func(t *testing.T) { testGetForTeam(t, rctx, ss) })
	t.Run("GetForUser", func(t *testing.T) { testGetForUser(t, rctx, ss) })

	t.Cleanup(func() {
		typesSQL := pagePostTypesSQL()
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM PropertyValues WHERE TargetType = 'post' AND TargetID IN (SELECT Id FROM Posts WHERE Type IN (%s))", typesSQL))
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM Posts WHERE Type IN (%s)", typesSQL))
		// Clean up wikis, channel member links, and channels created by wiki tests
		_, _ = s.GetMaster().Exec("TRUNCATE WikiLinks CASCADE")
		_, _ = s.GetMaster().Exec("TRUNCATE Wikis CASCADE")
		_, _ = s.GetMaster().Exec("TRUNCATE Channels CASCADE")
	})
}

func testSaveWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
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
		Name:        model.NewId(),
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
		Name:        model.NewId(),
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
		Name:        model.NewId(),
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
		Name:        model.NewId(),
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

func testGetPages(t *testing.T, rctx request.CTX, ss store.Store) {
	groupID, fieldID := getPagePropertyIDs(t, ss)

	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
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

	user := &model.User{
		Email:    "test@example.com",
		Username: "testuser" + model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		TeamId:    team.Id,
		CreatorId: user.Id,
		Title:     "Test Wiki",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	page1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Page 1",
		Type:      model.PostTypePage,
	}
	page1, err = ss.Post().Save(rctx, page1)
	require.NoError(t, err)

	page2 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Page 2",
		Type:      model.PostTypePage,
	}
	page2, err = ss.Post().Save(rctx, page2)
	require.NoError(t, err)

	regularPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Regular post",
		Type:      "",
	}
	_, err = ss.Post().Save(rctx, regularPost)
	require.NoError(t, err)

	value1 := model.NewId()
	value1JSON := []byte(`"` + value1 + `"`)
	prop1 := &model.PropertyValue{
		TargetType: "post",
		TargetID:   page1.Id,
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      value1JSON,
	}
	_, err = ss.PropertyValue().Create(prop1)
	require.NoError(t, err)

	value2 := wiki.Id
	value2JSON := []byte(`"` + value2 + `"`)
	prop2 := &model.PropertyValue{
		TargetType: "post",
		TargetID:   page2.Id,
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      value2JSON,
	}
	_, err = ss.PropertyValue().Create(prop2)
	require.NoError(t, err)

	t.Run("get pages for wiki", func(t *testing.T) {
		pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 100)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 1)
		assert.Equal(t, page2.Id, pages[0].Id)
	})

	t.Run("get pages with pagination", func(t *testing.T) {
		page3 := &model.Post{
			ChannelId: channel.Id,
			UserId:    user.Id,
			Message:   "Page 3",
			Type:      model.PostTypePage,
		}
		page3, saveErr := ss.Post().Save(rctx, page3)
		require.NoError(t, saveErr)

		value3 := wiki.Id
		value3JSON := []byte(`"` + value3 + `"`)
		prop3 := &model.PropertyValue{
			TargetType: "post",
			TargetID:   page3.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      value3JSON,
		}
		_, createErr := ss.PropertyValue().Create(prop3)
		require.NoError(t, createErr)

		pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 1)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 1)

		pages, pagesErr = ss.Wiki().GetPages(wiki.Id, 1, 1)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 1)

		pages, pagesErr = ss.Wiki().GetPages(wiki.Id, 0, 100)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 2)
	})

	t.Run("get pages for non-existent wiki", func(t *testing.T) {
		pages, pagesErr := ss.Wiki().GetPages(model.NewId(), 0, 100)
		require.NoError(t, pagesErr)
		assert.Empty(t, pages)
	})

	t.Run("get pages excludes deleted posts", func(t *testing.T) {
		deletedPage := &model.Post{
			ChannelId: channel.Id,
			UserId:    user.Id,
			Message:   "Deleted page",
			Type:      model.PostTypePage,
		}
		deletedPage, saveErr := ss.Post().Save(rctx, deletedPage)
		require.NoError(t, saveErr)

		valueDeleted := wiki.Id
		valueDeletedJSON := []byte(`"` + valueDeleted + `"`)
		propDeleted := &model.PropertyValue{
			TargetType: "post",
			TargetID:   deletedPage.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      valueDeletedJSON,
		}
		_, createErr := ss.PropertyValue().Create(propDeleted)
		require.NoError(t, createErr)

		deleteErr := ss.Post().Delete(rctx, deletedPage.Id, model.GetMillis(), user.Id)
		require.NoError(t, deleteErr)

		pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 100)
		require.NoError(t, pagesErr)
		for _, p := range pages {
			assert.NotEqual(t, deletedPage.Id, p.Id)
		}
	})

	t.Run("pages maintain stable ordering across multiple fetches", func(t *testing.T) {
		// Create multiple pages with the same CreateAt timestamp to test secondary sort by Id
		baseTime := model.GetMillis()

		for i := range 5 {
			page := &model.Post{
				ChannelId: channel.Id,
				UserId:    user.Id,
				Message:   "Test page " + string(rune('A'+i)),
				Type:      model.PostTypePage,
				CreateAt:  baseTime, // Same timestamp for all
			}
			savedPage, saveErr := ss.Post().Save(rctx, page)
			require.NoError(t, saveErr)

			// Associate with wiki
			valueJSON := []byte(`"` + wiki.Id + `"`)
			prop := &model.PropertyValue{
				TargetType: "post",
				TargetID:   savedPage.Id,
				GroupID:    groupID,
				FieldID:    fieldID,
				Value:      valueJSON,
			}
			_, createErr := ss.PropertyValue().Create(prop)
			require.NoError(t, createErr)
		}

		// Fetch pages multiple times and verify order is consistent
		var firstFetchIds []string
		for attempt := range 3 {
			pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 100)
			require.NoError(t, pagesErr)
			require.GreaterOrEqual(t, len(pages), 5, "Should have at least 5 test pages")

			// Extract IDs from this fetch
			var currentIds []string
			for _, p := range pages {
				currentIds = append(currentIds, p.Id)
			}

			if attempt == 0 {
				firstFetchIds = currentIds
			} else {
				// Verify order matches first fetch
				assert.Equal(t, firstFetchIds, currentIds, "Page order should be stable across fetches (attempt %d)", attempt)
			}
		}

		// Verify pages are sorted by CreateAt ASC, then by Id ASC
		pages, _ := ss.Wiki().GetPages(wiki.Id, 0, 100)
		for i := 1; i < len(pages); i++ {
			prev := pages[i-1]
			curr := pages[i]

			// If CreateAt is the same, Id should be ascending
			if prev.CreateAt == curr.CreateAt {
				assert.True(t, prev.Id < curr.Id,
					"Pages with same CreateAt should be sorted by Id ASC: %s should come before %s",
					prev.Id, curr.Id)
			}
			// Otherwise, CreateAt should be ascending
			if prev.CreateAt != curr.CreateAt {
				assert.True(t, prev.CreateAt < curr.CreateAt,
					"Pages should be sorted by CreateAt ASC: %d should be less than %d",
					prev.CreateAt, curr.CreateAt)
			}
		}
	})
}

func testMovePageToWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	groupID, fieldID := getPagePropertyIDs(t, ss)

	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
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

	user := &model.User{
		Email:    "test@example.com",
		Username: model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	targetChannel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Target Wiki Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	targetChannel, nErr = ss.Channel().Save(rctx, targetChannel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, targetChannel.Id) }()

	sourceWiki := &model.Wiki{
		ChannelId: channel.Id,
		TeamId:    team.Id,
		CreatorId: user.Id,
		Title:     "Source Wiki",
	}
	sourceWiki, err = ss.Wiki().Save(sourceWiki)
	require.NoError(t, err)

	targetWiki := &model.Wiki{
		ChannelId: targetChannel.Id,
		TeamId:    team.Id,
		CreatorId: user.Id,
		Title:     "Target Wiki",
	}
	targetWiki, err = ss.Wiki().Save(targetWiki)
	require.NoError(t, err)

	t.Run("move single page without children", func(t *testing.T) {
		rootPage := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Root page content",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Root Page",
			},
		}
		rootPage, err := ss.Post().Save(rctx, rootPage)
		require.NoError(t, err)

		rootPropValue := []byte(`"` + sourceWiki.Id + `"`)
		rootProp := &model.PropertyValue{
			TargetType: "post",
			TargetID:   rootPage.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      rootPropValue,
		}
		_, err = ss.PropertyValue().Create(rootProp)
		require.NoError(t, err)

		err = ss.Wiki().MovePageToWiki(rootPage.Id, targetWiki.Id, targetWiki.ChannelId, nil)
		require.NoError(t, err)

		props, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{rootPage.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, props, 1)

		expectedValue := json.RawMessage(`"` + targetWiki.Id + `"`)
		assert.Equal(t, expectedValue, props[0].Value)

		movedPage, err := ss.Post().GetSingle(rctx, rootPage.Id, false)
		require.NoError(t, err)
		assert.Equal(t, "", movedPage.PageParentId)
	})

	t.Run("move page with entire subtree", func(t *testing.T) {
		parentPage := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Parent page content",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Parent Page",
			},
		}
		parentPage, err := ss.Post().Save(rctx, parentPage)
		require.NoError(t, err)

		parentPropValue := []byte(`"` + sourceWiki.Id + `"`)
		parentProp := &model.PropertyValue{
			TargetType: "post",
			TargetID:   parentPage.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      parentPropValue,
		}
		_, err = ss.PropertyValue().Create(parentProp)
		require.NoError(t, err)

		childPage1 := &model.Post{
			UserId:       user.Id,
			ChannelId:    channel.Id,
			Message:      "Child 1 content",
			Type:         model.PostTypePage,
			PageParentId: parentPage.Id,
			Props: map[string]any{
				"title": "Child Page 1",
			},
		}
		childPage1, err = ss.Post().Save(rctx, childPage1)
		require.NoError(t, err)

		child1PropValue := []byte(`"` + sourceWiki.Id + `"`)
		child1Prop := &model.PropertyValue{
			TargetType: "post",
			TargetID:   childPage1.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      child1PropValue,
		}
		_, err = ss.PropertyValue().Create(child1Prop)
		require.NoError(t, err)

		childPage2 := &model.Post{
			UserId:       user.Id,
			ChannelId:    channel.Id,
			Message:      "Child 2 content",
			Type:         model.PostTypePage,
			PageParentId: parentPage.Id,
			Props: map[string]any{
				"title": "Child Page 2",
			},
		}
		childPage2, err = ss.Post().Save(rctx, childPage2)
		require.NoError(t, err)

		child2PropValue := []byte(`"` + sourceWiki.Id + `"`)
		child2Prop := &model.PropertyValue{
			TargetType: "post",
			TargetID:   childPage2.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      child2PropValue,
		}
		_, err = ss.PropertyValue().Create(child2Prop)
		require.NoError(t, err)

		grandchildPage := &model.Post{
			UserId:       user.Id,
			ChannelId:    channel.Id,
			Message:      "Grandchild content",
			Type:         model.PostTypePage,
			PageParentId: childPage1.Id,
			Props: map[string]any{
				"title": "Grandchild Page",
			},
		}
		grandchildPage, err = ss.Post().Save(rctx, grandchildPage)
		require.NoError(t, err)

		grandchildPropValue := []byte(`"` + sourceWiki.Id + `"`)
		grandchildProp := &model.PropertyValue{
			TargetType: "post",
			TargetID:   grandchildPage.Id,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      grandchildPropValue,
		}
		_, err = ss.PropertyValue().Create(grandchildProp)
		require.NoError(t, err)

		err = ss.Wiki().MovePageToWiki(parentPage.Id, targetWiki.Id, targetWiki.ChannelId, nil)
		require.NoError(t, err)

		expectedTargetValue := json.RawMessage(`"` + targetWiki.Id + `"`)

		parentProps, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{parentPage.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, parentProps, 1)
		assert.Equal(t, expectedTargetValue, parentProps[0].Value)

		child1Props, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{childPage1.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, child1Props, 1)
		assert.Equal(t, expectedTargetValue, child1Props[0].Value)

		child2Props, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{childPage2.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, child2Props, 1)
		assert.Equal(t, expectedTargetValue, child2Props[0].Value)

		grandchildProps, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{grandchildPage.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, grandchildProps, 1)
		assert.Equal(t, expectedTargetValue, grandchildProps[0].Value)

		movedParent, err := ss.Post().GetSingle(rctx, parentPage.Id, false)
		require.NoError(t, err)
		assert.Equal(t, "", movedParent.PageParentId)

		movedChild1, err := ss.Post().GetSingle(rctx, childPage1.Id, false)
		require.NoError(t, err)
		assert.Equal(t, parentPage.Id, movedChild1.PageParentId)

		movedChild2, err := ss.Post().GetSingle(rctx, childPage2.Id, false)
		require.NoError(t, err)
		assert.Equal(t, parentPage.Id, movedChild2.PageParentId)

		movedGrandchild, err := ss.Post().GetSingle(rctx, grandchildPage.Id, false)
		require.NoError(t, err)
		assert.Equal(t, childPage1.Id, movedGrandchild.PageParentId)
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
		Name:        model.NewId(),
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

func testDeleteAllPagesForWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	groupID, fieldID := getPagePropertyIDs(t, ss)

	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
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

	user := &model.User{
		Email:    "test@example.com",
		Username: model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	wiki := &model.Wiki{
		ChannelId:   channel.Id,
		TeamId:      team.Id,
		CreatorId:   user.Id,
		Title:       "Test Wiki",
		Description: "Test wiki description",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)
	defer func() { _ = ss.Wiki().Delete(wiki.Id, false) }()

	page1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Test page 1 content",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"wiki_id": wiki.Id,
		},
	}
	page1, err = ss.Post().Save(rctx, page1)
	require.NoError(t, err)

	page1PropValue := []byte(`"` + wiki.Id + `"`)
	page1Prop := &model.PropertyValue{
		TargetType: "post",
		TargetID:   page1.Id,
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      page1PropValue,
	}
	_, err = ss.PropertyValue().Create(page1Prop)
	require.NoError(t, err)

	page2 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Test page 2 content",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"wiki_id": wiki.Id,
		},
	}
	page2, err = ss.Post().Save(rctx, page2)
	require.NoError(t, err)

	page2PropValue := []byte(`"` + wiki.Id + `"`)
	page2Prop := &model.PropertyValue{
		TargetType: "post",
		TargetID:   page2.Id,
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      page2PropValue,
	}
	_, err = ss.PropertyValue().Create(page2Prop)
	require.NoError(t, err)

	_, err = ss.Page().UpdatePageWithContent(rctx, page1.Id, "",
		`{"type":"doc","content":[]}`)
	require.NoError(t, err)

	_, err = ss.Page().UpdatePageWithContent(rctx, page2.Id, "",
		`{"type":"doc","content":[]}`)
	require.NoError(t, err)

	// Create a page draft via UpsertPageDraftContent
	draftPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"wiki_id": wiki.Id,
		},
	}
	draftPost, err = ss.Post().Save(rctx, draftPost)
	require.NoError(t, err)
	_, err = ss.Draft().UpsertPageDraftContent(draftPost.Id, user.Id, wiki.Id,
		`{"type":"doc","content":[]}`, 0)
	require.NoError(t, err)

	t.Run("delete all pages and drafts for wiki", func(t *testing.T) {
		err := ss.Wiki().DeleteAllPagesForWiki(wiki.Id)
		require.NoError(t, err)

		deletedPage1, err := ss.Post().GetSingle(rctx, page1.Id, false)
		assert.Nil(t, deletedPage1)
		assert.Error(t, err)

		deletedPage2, err := ss.Post().GetSingle(rctx, page2.Id, false)
		assert.Nil(t, deletedPage2)
		assert.Error(t, err)

		page1Props, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{page1.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		assert.Len(t, page1Props, 0)

		page2Props, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			GroupID:    groupID,
			TargetType: "post",
			TargetIDs:  []string{page2.Id},
			FieldID:    fieldID,
			PerPage:    10,
		})
		require.NoError(t, err)
		assert.Len(t, page2Props, 0)

		pageDrafts, err := ss.Draft().GetPageDraftsForUser(user.Id, wiki.Id, 0, 200)
		require.NoError(t, err)
		assert.Len(t, pageDrafts, 0)
	})

	t.Run("delete for non-existent wiki returns not found", func(t *testing.T) {
		err := ss.Wiki().DeleteAllPagesForWiki(model.NewId())
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testGetAbandonedPages(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
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

	user := &model.User{
		Email:    "test@example.com",
		Username: model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	now := model.GetMillis()
	oldTime := now - (24 * 60 * 60 * 1000)
	cutoffTime := now - (12 * 60 * 60 * 1000)

	oldEmptyPage := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		CreateAt:  oldTime,
		UpdateAt:  oldTime,
	}
	oldEmptyPage, err = ss.Post().Save(rctx, oldEmptyPage)
	require.NoError(t, err)
	defer func() { _ = ss.Post().PermanentDeleteByUser(rctx, user.Id) }()

	recentEmptyPage := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		CreateAt:  now,
		UpdateAt:  now,
	}
	recentEmptyPage, err = ss.Post().Save(rctx, recentEmptyPage)
	require.NoError(t, err)

	oldPageWithContent := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "This page has content",
		Type:      model.PostTypePage,
		CreateAt:  oldTime,
		UpdateAt:  oldTime,
	}
	oldPageWithContent, err = ss.Post().Save(rctx, oldPageWithContent)
	require.NoError(t, err)

	t.Run("get abandoned pages older than cutoff", func(t *testing.T) {
		abandonedPages, err := ss.Wiki().GetAbandonedPages(cutoffTime)
		require.NoError(t, err)
		require.Len(t, abandonedPages, 1)
		assert.Equal(t, oldEmptyPage.Id, abandonedPages[0].Id)
		assert.Equal(t, "", abandonedPages[0].Message)
		assert.Equal(t, model.PostTypePage, abandonedPages[0].Type)
	})

	t.Run("get abandoned pages excludes recent empty pages", func(t *testing.T) {
		abandonedPages, err := ss.Wiki().GetAbandonedPages(cutoffTime)
		require.NoError(t, err)
		for _, page := range abandonedPages {
			assert.NotEqual(t, recentEmptyPage.Id, page.Id)
		}
	})

	t.Run("get abandoned pages excludes pages with content", func(t *testing.T) {
		abandonedPages, err := ss.Wiki().GetAbandonedPages(cutoffTime)
		require.NoError(t, err)
		for _, page := range abandonedPages {
			assert.NotEqual(t, oldPageWithContent.Id, page.Id)
		}
	})
}

func testGetLinkedToChannel(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
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

	t.Run("returns wikis linked via WikiLinks", func(t *testing.T) {
		link1 := &model.WikiLink{
			SourceId: sourceChannel.Id,

			DestinationId: wikiChannel1.Id,
			CreatorId:     creatorId,
		}
		_, err := ss.WikiLink().Save(link1)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM WikiLinks WHERE SourceId = $1 AND DestinationId = $2", sourceChannel.Id, wikiChannel1.Id)
		}()

		link2 := &model.WikiLink{
			SourceId: sourceChannel.Id,

			DestinationId: wikiChannel2.Id,
			CreatorId:     creatorId,
		}
		_, err = ss.WikiLink().Save(link2)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM WikiLinks WHERE SourceId = $1 AND DestinationId = $2", sourceChannel.Id, wikiChannel2.Id)
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

		linkHigh := &model.WikiLink{
			SourceId: sortChannel.Id,

			DestinationId: wikiChannel1.Id,
			CreatorId:     creatorId,
		}
		_, err := ss.WikiLink().Save(linkHigh)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM WikiLinks WHERE SourceId = $1 AND DestinationId = $2", sortChannel.Id, wikiChannel1.Id)
		}()

		linkLow := &model.WikiLink{
			SourceId: sortChannel.Id,

			DestinationId: wikiChannel2.Id,
			CreatorId:     creatorId,
		}
		_, err = ss.WikiLink().Save(linkLow)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM WikiLinks WHERE SourceId = $1 AND DestinationId = $2", sortChannel.Id, wikiChannel2.Id)
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

		link := &model.WikiLink{
			SourceId: delChannel.Id,

			DestinationId: deletedWikiChannel.Id,
			CreatorId:     creatorId,
		}
		_, err = ss.WikiLink().Save(link)
		require.NoError(t, err)
		defer func() {
			_, _ = s.GetMaster().Exec("DELETE FROM WikiLinks WHERE SourceId = $1 AND DestinationId = $2", delChannel.Id, deletedWikiChannel.Id)
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
		Name:        model.NewId(),
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
		Name:        model.NewId(),
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
		Name:        model.NewId(),
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
