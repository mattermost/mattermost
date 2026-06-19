// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
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

// pagePostTypes returns the list of post types related to pages/wiki functionality.
// This mirrors sqlstore.PagePostTypes() but is defined here to avoid circular imports.
func pagePostTypes() []string {
	return []string{
		model.PostTypePage,
		model.PostTypePageComment,
		model.PostTypePageMention,
		model.PostTypePageAdded,
		model.PostTypePageUpdated,
		model.PostTypeWikiAdded,
		model.PostTypeWikiDeleted,
	}
}

// pagePostTypesSQL returns a SQL IN clause value for page post types.
func pagePostTypesSQL() string {
	types := pagePostTypes()
	quoted := make([]string, len(types))
	for i, t := range types {
		quoted[i] = fmt.Sprintf("'%s'", t)
	}
	return strings.Join(quoted, ", ")
}

// testInsertPage inserts a page row directly into the Pages table and returns the inserted page.
// This bypasses the advisory lock and app-layer concerns, so it is test-setup only.
func testInsertPage(s SqlStore, channelID, wikiID, userID, parentID, title string) *model.Page {
	p := &model.Page{
		ChannelId: channelID,
		WikiId:    wikiID,
		UserId:    userID,
		ParentId:  parentID,
		Title:     title,
		Type:      model.PageTypePage,
	}
	p.PreSave()
	now := p.CreateAt
	_, err := s.GetMaster().Exec(
		`INSERT INTO Pages
		  (Id, WikiId, ChannelId, ParentId, Type, Title, Body, SearchText,
		   UserId, LastModifiedBy, SortOrder,
		   CreateAt, UpdateAt, DeleteAt, EditAt, OriginalId,
		   HasEffectiveViewRestriction, HasLocalEditRestriction,
		   ReparentedParentOnDelete, ReparentedChildrenOnDelete)
		 VALUES
		  ($1,$2,$3,$4,$5,$6,'',' ',$7,$7,0,$8,$8,0,0,'',false,false,NULL,NULL)`,
		p.Id, wikiID, channelID, parentID, p.Type, title, userID, now,
	)
	if err != nil {
		panic(fmt.Sprintf("testInsertPage: %v", err))
	}
	return p
}

// testInsertPageWithDeleteAt is like testInsertPage but sets DeleteAt so the row looks soft-deleted.
func testInsertPageWithDeleteAt(s SqlStore, channelID, wikiID, userID, parentID, title string, deleteAt int64) *model.Page {
	p := testInsertPage(s, channelID, wikiID, userID, parentID, title)
	_, _ = s.GetMaster().Exec(`UPDATE Pages SET DeleteAt=$1 WHERE Id=$2`, deleteAt, p.Id)
	p.DeleteAt = deleteAt
	return p
}

// testInsertPageWithSortOrder is like testInsertPage but also sets SortOrder.
func testInsertPageWithSortOrder(s SqlStore, channelID, wikiID, userID, parentID, title string, sortOrder int64) *model.Page {
	p := testInsertPage(s, channelID, wikiID, userID, parentID, title)
	_, _ = s.GetMaster().Exec(`UPDATE Pages SET SortOrder=$1 WHERE Id=$2`, sortOrder, p.Id)
	p.SortOrder = sortOrder
	return p
}

// pageSliceToMap converts a []*model.Page slice to map[string]*model.Page keyed by Id.
func pageSliceToMap(pages []*model.Page) map[string]*model.Page {
	m := make(map[string]*model.Page, len(pages))
	for _, p := range pages {
		m[p.Id] = p
	}
	return m
}

// pageSliceIDs extracts Id strings from a []*model.Page slice.
func pageSliceIDs(pages []*model.Page) []string {
	ids := make([]string, len(pages))
	for i, p := range pages {
		ids[i] = p.Id
	}
	return ids
}

func TestPageStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("GetPageChildren", func(t *testing.T) { testGetPageChildren(t, rctx, ss, s) })
	t.Run("GetPageAncestors", func(t *testing.T) { testGetPageAncestors(t, rctx, ss, s) })
	t.Run("GetPageDescendants", func(t *testing.T) { testGetPageDescendants(t, rctx, ss, s) })
	t.Run("GetChannelPages", func(t *testing.T) { testGetChannelPages(t, rctx, ss, s) })
	t.Run("GetChannelPagesMeta", func(t *testing.T) { testGetChannelPagesMeta(t, rctx, ss, s) })
	t.Run("ChangePageParent", func(t *testing.T) { testChangePageParent(t, rctx, ss, s) })
	t.Run("GetCommentsForPage", func(t *testing.T) { testGetCommentsForPage(t, rctx, ss, s) })
	t.Run("UpdatePageWithContent", func(t *testing.T) { testUpdatePageWithContent(t, rctx, ss, s) })
	t.Run("ContentTextPersistence", func(t *testing.T) { testContentTextPersistence(t, rctx, ss, s) })
	t.Run("ConcurrentOperations", func(t *testing.T) { testConcurrentOperations(t, rctx, ss, s) })
	t.Run("DeletePage", func(t *testing.T) { testDeletePage(t, rctx, ss) })
	t.Run("VersionHistoryPruning", func(t *testing.T) { testVersionHistoryPruning(t, rctx, ss, s) })
	t.Run("GetSiblingPages", func(t *testing.T) { testGetSiblingPages(t, rctx, ss, s) })
	t.Run("UpdatePageSortOrder", func(t *testing.T) { testUpdatePageSortOrder(t, rctx, ss, s) })
	t.Run("MovePage", func(t *testing.T) { testMovePage(t, rctx, ss, s) })
	t.Run("AtomicUpdatePageNotification", func(t *testing.T) { testAtomicUpdatePageNotification(t, rctx, ss) })

	t.Cleanup(func() {
		typesSQL := pagePostTypesSQL()
		_, _ = s.GetMaster().Exec("DELETE FROM PropertyValues WHERE TargetType = '" + model.PropertyValueTargetTypePage + "' AND TargetID IN (SELECT Id FROM Pages)")
		_, _ = s.GetMaster().Exec("DELETE FROM Pages")
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM Posts WHERE Type IN (%s)", typesSQL))
		_, _ = s.GetMaster().Exec("DELETE FROM Wikis WHERE Id NOT IN (SELECT DISTINCT ChannelId FROM Posts WHERE ChannelId IS NOT NULL)")
		_, _ = s.GetMaster().Exec("DELETE FROM Channels WHERE Id NOT IN (SELECT DISTINCT ChannelId FROM Posts WHERE ChannelId IS NOT NULL) AND Id NOT IN (SELECT DISTINCT ChannelId FROM Wikis WHERE ChannelId IS NOT NULL)")
	})
}

func testGetPageChildren(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("returns multiple children", func(t *testing.T) {
		parentPage := testInsertPage(s, channel1.Id, wikiID, userID, "", "Parent Page")
		childPage1 := testInsertPage(s, channel1.Id, wikiID, userID, parentPage.Id, "Child Page 1")
		childPage2 := testInsertPage(s, channel1.Id, wikiID, userID, parentPage.Id, "Child Page 2")
		otherPage := testInsertPage(s, channel1.Id, wikiID, userID, "", "Other Page")

		result, childErr := ss.Page().GetPageChildren(parentPage.Id, model.GetPostsOptions{})
		require.NoError(t, childErr)
		require.NotNil(t, result)
		pageMap := pageSliceToMap(result)
		require.Len(t, pageMap, 2, "should return 2 child pages")
		require.Contains(t, pageMap, childPage1.Id)
		require.Contains(t, pageMap, childPage2.Id)
		require.NotContains(t, pageMap, parentPage.Id, "should not include parent")
		require.NotContains(t, pageMap, otherPage.Id, "should not include unrelated page")
	})

	t.Run("returns empty list for page with no children", func(t *testing.T) {
		leafPage := testInsertPage(s, channel1.Id, wikiID, userID, "", "Leaf Page")

		result, leafErr := ss.Page().GetPageChildren(leafPage.Id, model.GetPostsOptions{})
		require.NoError(t, leafErr)
		require.NotNil(t, result)
		require.Empty(t, result)
	})

	t.Run("returns empty list for non-existent page", func(t *testing.T) {
		result, nonExistErr := ss.Page().GetPageChildren(model.NewId(), model.GetPostsOptions{})
		require.NoError(t, nonExistErr)
		require.NotNil(t, result)
		require.Empty(t, result)
	})

	t.Run("excludes soft-deleted pages", func(t *testing.T) {
		parent := testInsertPage(s, channel1.Id, wikiID, userID, "", "Parent for Delete Test")
		activeChild := testInsertPage(s, channel1.Id, wikiID, userID, parent.Id, "Active Child")
		deletedChild := testInsertPage(s, channel1.Id, wikiID, userID, parent.Id, "Deleted Child")
		_, _ = s.GetMaster().Exec(`UPDATE Pages SET DeleteAt=$1 WHERE Id=$2`, model.GetMillis(), deletedChild.Id)

		result, childrenErr := ss.Page().GetPageChildren(parent.Id, model.GetPostsOptions{})
		require.NoError(t, childrenErr)
		pageMap := pageSliceToMap(result)
		require.Len(t, pageMap, 1)
		require.Contains(t, pageMap, activeChild.Id)
		require.NotContains(t, pageMap, deletedChild.Id)
	})

	t.Run("orders by CreateAt DESC (newest first)", func(t *testing.T) {
		parent := testInsertPage(s, channel1.Id, wikiID, userID, "", "Parent for Order Test")
		now := model.GetMillis()
		olderID := model.NewId()
		newerID := model.NewId()

		_, _ = s.GetMaster().Exec(
			`INSERT INTO Pages (Id, WikiId, ChannelId, ParentId, Type, Title, Body, SearchText, UserId, LastModifiedBy, SortOrder, CreateAt, UpdateAt, DeleteAt, EditAt, OriginalId, HasEffectiveViewRestriction, HasLocalEditRestriction, ReparentedParentOnDelete, ReparentedChildrenOnDelete)
			 VALUES ($1,$2,$3,$4,'page','Older Child','',' ',$5,$5,0,$6,$6,0,0,'',false,false,NULL,NULL)`,
			olderID, wikiID, channel1.Id, parent.Id, userID, now-2000,
		)
		_, _ = s.GetMaster().Exec(
			`INSERT INTO Pages (Id, WikiId, ChannelId, ParentId, Type, Title, Body, SearchText, UserId, LastModifiedBy, SortOrder, CreateAt, UpdateAt, DeleteAt, EditAt, OriginalId, HasEffectiveViewRestriction, HasLocalEditRestriction, ReparentedParentOnDelete, ReparentedChildrenOnDelete)
			 VALUES ($1,$2,$3,$4,'page','Newer Child','',' ',$5,$5,0,$6,$6,0,0,'',false,false,NULL,NULL)`,
			newerID, wikiID, channel1.Id, parent.Id, userID, now,
		)

		result, err := ss.Page().GetPageChildren(parent.Id, model.GetPostsOptions{})
		require.NoError(t, err)
		ids := pageSliceIDs(result)
		require.Len(t, ids, 2)
		require.Equal(t, newerID, ids[0], "newer should be first")
		require.Equal(t, olderID, ids[1], "older should be second")
	})
}

func testGetChannelPages(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	channel2, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName2",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	page1 := testInsertPage(s, channel1.Id, wikiID, userID, "", "Page 1")
	time.Sleep(2 * time.Millisecond)
	page2 := testInsertPage(s, channel1.Id, wikiID, userID, "", "Page 2")
	time.Sleep(2 * time.Millisecond)
	childPage := testInsertPage(s, channel1.Id, wikiID, userID, page1.Id, "Child Page")
	pageInChannel2 := testInsertPage(s, channel2.Id, wikiID, userID, "", "Page in Channel 2")

	// Insert a non-page post to verify it's excluded
	regularPost := &model.Post{
		ChannelId: channel1.Id,
		UserId:    userID,
		Type:      model.PostTypeDefault,
		Message:   "Regular Post",
	}
	regularPost, err = ss.Post().Save(rctx, regularPost)
	require.NoError(t, err)

	t.Run("returns pages ordered by CreateAt DESC with full content", func(t *testing.T) {
		result, channelErr := ss.Page().GetChannelPages(channel1.Id, 0, 0)
		require.NoError(t, channelErr)
		require.NotNil(t, result)
		pageMap := pageSliceToMap(result)
		require.Len(t, pageMap, 3, "should return 3 pages (parent, child, and sibling)")
		require.Contains(t, pageMap, page1.Id)
		require.Contains(t, pageMap, page2.Id)
		require.Contains(t, pageMap, childPage.Id)
		require.NotContains(t, pageMap, pageInChannel2.Id, "should not include pages from other channels")

		ids := pageSliceIDs(result)
		require.Len(t, ids, 3, "order should have 3 items")
		require.Equal(t, childPage.Id, ids[0], "newest page first (CreateAt DESC)")
		require.Equal(t, page1.Id, ids[len(ids)-1], "oldest page last")

		for _, p := range result {
			require.NotEmpty(t, p.Title, "Title should be populated")
		}
	})

	t.Run("SQL pagination: offset and limit", func(t *testing.T) {
		page0, err0 := ss.Page().GetChannelPages(channel1.Id, 0, 1)
		require.NoError(t, err0)
		require.Len(t, page0, 1)

		page1Result, err1 := ss.Page().GetChannelPages(channel1.Id, 1, 1)
		require.NoError(t, err1)
		require.Len(t, page1Result, 1)

		require.NotEqual(t, page0[0].Id, page1Result[0].Id, "pages at different offsets must differ")
	})

	t.Run("limit=0 returns all pages", func(t *testing.T) {
		all, allErr := ss.Page().GetChannelPages(channel1.Id, 0, 0)
		require.NoError(t, allErr)
		require.Len(t, all, 3)
	})

	t.Run("returns empty list for empty channel", func(t *testing.T) {
		emptyChannel, emptyErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Empty Channel",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, emptyErr)

		result, resultErr := ss.Page().GetChannelPages(emptyChannel.Id, 0, 0)
		require.NoError(t, resultErr)
		require.NotNil(t, result)
		require.Empty(t, result)
	})

	t.Run("ensures cross-channel isolation", func(t *testing.T) {
		result1, channel1Err := ss.Page().GetChannelPages(channel1.Id, 0, 0)
		require.NoError(t, channel1Err)
		map1 := pageSliceToMap(result1)
		require.Contains(t, map1, page1.Id)
		require.NotContains(t, map1, pageInChannel2.Id, "channel1 should not include pages from channel2")

		result2, channel2Err := ss.Page().GetChannelPages(channel2.Id, 0, 0)
		require.NoError(t, channel2Err)
		map2 := pageSliceToMap(result2)
		require.Contains(t, map2, pageInChannel2.Id)
		require.NotContains(t, map2, page1.Id, "channel2 should not include pages from channel1")
	})

	t.Run("excludes soft-deleted pages", func(t *testing.T) {
		activePage := testInsertPage(s, channel1.Id, wikiID, userID, "", "Active Page")
		deletedPage := testInsertPage(s, channel1.Id, wikiID, userID, "", "Deleted Page")
		_, _ = s.GetMaster().Exec(`UPDATE Pages SET DeleteAt=$1 WHERE Id=$2`, model.GetMillis(), deletedPage.Id)

		result, delPageErr := ss.Page().GetChannelPages(channel1.Id, 0, 0)
		require.NoError(t, delPageErr)
		pageMap := pageSliceToMap(result)
		require.Contains(t, pageMap, activePage.Id)
		require.NotContains(t, pageMap, deletedPage.Id, "should not include deleted pages")
	})
}

func testGetChannelPagesMeta(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	ch, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Meta Test",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	otherCh, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Other",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	p1 := testInsertPage(s, ch.Id, wikiID, userID, "", "content-a")
	p2 := testInsertPage(s, ch.Id, wikiID, userID, "", "content-b")
	testInsertPage(s, otherCh.Id, wikiID, userID, "", "other")

	t.Run("Body field is empty for all returned pages", func(t *testing.T) {
		result, metaErr := ss.Page().GetChannelPagesMeta(ch.Id)
		require.NoError(t, metaErr)
		require.Len(t, result, 2)
		for _, p := range result {
			require.Empty(t, p.Body, "Body must not be loaded by GetChannelPagesMeta")
		}
	})

	t.Run("cross-channel isolation", func(t *testing.T) {
		result, metaErr := ss.Page().GetChannelPagesMeta(ch.Id)
		require.NoError(t, metaErr)
		pageMap := pageSliceToMap(result)
		require.Contains(t, pageMap, p1.Id)
		require.Contains(t, pageMap, p2.Id)
		for _, p := range result {
			require.Equal(t, ch.Id, p.ChannelId, "must not include pages from other channels")
		}
	})

	t.Run("excludes soft-deleted pages", func(t *testing.T) {
		deleted := testInsertPage(s, ch.Id, wikiID, userID, "", "to-delete")
		_, _ = s.GetMaster().Exec(`UPDATE Pages SET DeleteAt=$1 WHERE Id=$2`, model.GetMillis(), deleted.Id)

		result, metaErr := ss.Page().GetChannelPagesMeta(ch.Id)
		require.NoError(t, metaErr)
		pageMap := pageSliceToMap(result)
		require.NotContains(t, pageMap, deleted.Id)
	})

	t.Run("respects SortOrder (in-memory sort)", func(t *testing.T) {
		sortCh, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageC := testInsertPageWithSortOrder(s, sortCh.Id, wikiID, userID, "", "C", 3000)
		pageA := testInsertPageWithSortOrder(s, sortCh.Id, wikiID, userID, "", "A", 1000)
		pageB := testInsertPageWithSortOrder(s, sortCh.Id, wikiID, userID, "", "B", 2000)

		result, sortErr := ss.Page().GetChannelPagesMeta(sortCh.Id)
		require.NoError(t, sortErr)
		require.Len(t, result, 3)
		require.Equal(t, pageA.Id, result[0].Id, "lowest sort order first")
		require.Equal(t, pageB.Id, result[1].Id)
		require.Equal(t, pageC.Id, result[2].Id)
	})

	t.Run("empty channel returns empty list", func(t *testing.T) {
		emptyCh, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Empty",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		result, metaErr := ss.Page().GetChannelPagesMeta(emptyCh.Id)
		require.NoError(t, metaErr)
		require.Empty(t, result)
	})
}

func testGetCommentsForPage(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("returns inline comments (page itself is no longer in results)", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Test Page")

		inlineComment1 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "First inline comment",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "paragraph-123",
					"offset": 10,
				},
			},
		}
		inlineComment1, err = ss.Post().Save(rctx, inlineComment1)
		require.NoError(t, err)

		inlineComment2 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "Second inline comment",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "heading-456",
					"offset": 0,
				},
			},
		}
		inlineComment2, err = ss.Post().Save(rctx, inlineComment2)
		require.NoError(t, err)

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 2, "should return 2 inline comments")
		require.Contains(t, result.Posts, inlineComment1.Id)
		require.Contains(t, result.Posts, inlineComment2.Id)
	})

	t.Run("returns inline comment replies", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page with replies")

		inlineComment := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "Inline comment",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "paragraph-789",
					"offset": 5,
				},
			},
		}
		inlineComment, err = ss.Post().Save(rctx, inlineComment)
		require.NoError(t, err)

		reply := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    inlineComment.Id,
			Message:   "Reply to inline comment",
			Props: model.StringInterface{
				model.PagePropsPageID: page.Id,
			},
		}
		reply, err = ss.Post().Save(rctx, reply)
		require.NoError(t, err)

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 2, "should return inline comment + reply")
		require.Contains(t, result.Posts, inlineComment.Id)
		require.Contains(t, result.Posts, reply.Id)

		require.Equal(t, "", result.Posts[inlineComment.Id].RootId, "inline comment should have empty RootId")
		require.Equal(t, inlineComment.Id, result.Posts[reply.Id].RootId, "reply should have RootId = inlineComment.Id")
	})

	t.Run("filters deleted inline comments when includeDeleted=false", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page with deleted inline comment")

		inlineComment := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "Inline comment to be deleted",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "paragraph-111",
					"offset": 15,
				},
			},
		}
		inlineComment, err = ss.Post().Save(rctx, inlineComment)
		require.NoError(t, err)

		err = ss.Post().Delete(rctx, inlineComment.Id, model.GetMillis(), userID)
		require.NoError(t, err)

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Empty(t, result.Posts, "should return no comments (deleted comment excluded, page itself dropped)")
		require.NotContains(t, result.Posts, inlineComment.Id)
	})

	t.Run("includes deleted inline comments when includeDeleted=true", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page with deleted inline comment 2")

		inlineComment := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "Another inline comment to be deleted",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "paragraph-222",
					"offset": 20,
				},
			},
		}
		inlineComment, err = ss.Post().Save(rctx, inlineComment)
		require.NoError(t, err)

		err = ss.Post().Delete(rctx, inlineComment.Id, model.GetMillis(), userID)
		require.NoError(t, err)

		result, getErr := ss.Page().GetCommentsForPage(page.Id, true, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 1, "should include deleted inline comment")
		require.Contains(t, result.Posts, inlineComment.Id)

		deletedComment := result.Posts[inlineComment.Id]
		require.Greater(t, deletedComment.DeleteAt, int64(0), "deleted comment should have DeleteAt > 0")
	})

	t.Run("returns empty list when no inline comments exist", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Empty page")

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 0, "should return empty list (page itself excluded)")
	})

	t.Run("returns error for invalid pageID", func(t *testing.T) {
		result, getErr := ss.Page().GetCommentsForPage("", false, 0, 200)
		require.Error(t, getErr)
		require.Nil(t, result)

		var invalidErr *store.ErrInvalidInput
		require.ErrorAs(t, getErr, &invalidErr)
	})

	t.Run("returns empty list for non-existent page", func(t *testing.T) {
		nonExistentPageID := model.NewId()

		result, getErr := ss.Page().GetCommentsForPage(nonExistentPageID, false, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 0, "should return empty list for non-existent page")
		require.Len(t, result.Order, 0)
	})

	t.Run("verifies CreateAt ASC ordering", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page for ordering test")

		time.Sleep(2 * time.Millisecond)

		comment1 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "First comment",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "para-1",
					"offset": 0,
				},
			},
		}
		comment1, err = ss.Post().Save(rctx, comment1)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		comment2 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePageComment,
			RootId:    "",
			Message:   "Second comment",
			Props: model.StringInterface{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "para-2",
					"offset": 0,
				},
			},
		}
		comment2, err = ss.Post().Save(rctx, comment2)
		require.NoError(t, err)

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false, 0, 200)
		require.NoError(t, getErr)

		require.Len(t, result.Order, 2)
		require.Equal(t, comment1.Id, result.Order[0], "first comment created should be first")
		require.Equal(t, comment2.Id, result.Order[1], "second comment created should be second")

		comment1Post := result.Posts[comment1.Id]
		comment2Post := result.Posts[comment2.Id]

		require.Less(t, comment1Post.CreateAt, comment2Post.CreateAt, "comment1 CreateAt should be before comment2")
	})
}

func testUpdatePageWithContent(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("updates title only", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Original Title")
		originalUpdateAt := page.UpdateAt

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "New Title", "")
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPage)

		require.Equal(t, "New Title", updatedPage.Title)
		require.Greater(t, updatedPage.UpdateAt, originalUpdateAt, "UpdateAt should be incremented")
	})

	t.Run("updates content only", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page Title")

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", contentJSON)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPage)

		require.JSONEq(t, contentJSON, updatedPage.Body)
		require.Equal(t, "Test content", updatedPage.SearchText)
	})

	t.Run("updates both title and content", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Original Title")

		contentJSON := `{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"New Heading"}]}]}`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "Updated Title", contentJSON)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPage)

		require.Equal(t, "Updated Title", updatedPage.Title)
		require.JSONEq(t, contentJSON, updatedPage.Body)
		require.Equal(t, "New Heading", updatedPage.SearchText)
	})

	t.Run("fails for non-existent pageID", func(t *testing.T) {
		nonExistentPageID := model.NewId()

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, nonExistentPageID, "Title", "")
		require.Error(t, updateErr)
		require.Nil(t, updatedPage)
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Test Page")

		invalidJSON := `{"type":"doc","content":["invalid structure`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", invalidJSON)
		require.Error(t, updateErr)
		require.Nil(t, updatedPage)
	})

	t.Run("sets content in Body when page had no content", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Empty Page")

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First content"}]}]}`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", contentJSON)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPage)

		require.JSONEq(t, contentJSON, updatedPage.Body)
	})

	t.Run("overwrites existing content in Body", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page Title")
		initialContentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial content"}]}]}`
		_, _ = s.GetMaster().Exec(`UPDATE Pages SET Body=$1 WHERE Id=$2`, initialContentJSON, page.Id)

		updatedContentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", updatedContentJSON)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPage)

		require.JSONEq(t, updatedContentJSON, updatedPage.Body)
	})

	t.Run("verifies UpdateAt is incremented", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Original Title")
		originalUpdateAt := page.UpdateAt

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"New content"}]}]}`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "New Title", contentJSON)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPage)

		require.Greater(t, updatedPage.UpdateAt, originalUpdateAt, "UpdateAt should be incremented")

		fetchedPage, fetchErr := ss.Page().GetPage(rctx, page.Id, false)
		require.NoError(t, fetchErr)
		require.Equal(t, updatedPage.UpdateAt, fetchedPage.UpdateAt, "UpdateAt should be persisted")
	})

	t.Run("fails with empty pageID", func(t *testing.T) {
		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, "", "Title", "")
		require.Error(t, updateErr)
		require.Nil(t, updatedPage)
	})
}

func testContentTextPersistence(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Search Text Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("SearchText is persisted and fetchable after UpdatePageWithContent", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "FTS Page")

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"searchable words here"}]}]}`

		updatedPage, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", contentJSON)
		require.NoError(t, updateErr)
		require.Equal(t, "searchable words here", updatedPage.SearchText)

		// Re-fetch from DB and verify the column was actually persisted.
		fetched, fetchErr := ss.Page().GetPage(rctx, page.Id, false)
		require.NoError(t, fetchErr)
		require.Equal(t, "searchable words here", fetched.SearchText)
	})

	t.Run("SearchText is not touched when content is invalid JSON (error path)", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page")

		// Invalid JSON — UpdatePageWithContent should return an error and not touch the row.
		_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", `{invalid`)
		require.Error(t, updateErr)
	})
}

func testGetPageAncestors(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("get ancestors of 3-level hierarchy", func(t *testing.T) {
		grandparent := testInsertPage(s, channel.Id, wikiID, userID, "", "Grandparent")
		parent := testInsertPage(s, channel.Id, wikiID, userID, grandparent.Id, "Parent")
		child := testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child")

		ancestors, err := ss.Page().GetPageAncestors(child.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestors)
		ancestorMap := pageSliceToMap(ancestors)
		assert.Len(t, ancestorMap, 2)
		assert.Contains(t, ancestorMap, parent.Id)
		assert.Contains(t, ancestorMap, grandparent.Id)
	})

	t.Run("get ancestors returns empty for root page", func(t *testing.T) {
		root := testInsertPage(s, channel.Id, wikiID, userID, "", "Root page")

		ancestors, err := ss.Page().GetPageAncestors(root.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestors)
		assert.Len(t, ancestors, 0)
	})

	t.Run("get ancestors excludes deleted pages", func(t *testing.T) {
		grandparent := testInsertPageWithDeleteAt(s, channel.Id, wikiID, userID, "", "Deleted Grandparent", model.GetMillis())
		parent := testInsertPage(s, channel.Id, wikiID, userID, grandparent.Id, "Parent")
		child := testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child")

		ancestors, err := ss.Page().GetPageAncestors(child.Id)
		require.NoError(t, err)
		ancestorMap := pageSliceToMap(ancestors)
		assert.Len(t, ancestorMap, 1)
		assert.Contains(t, ancestorMap, parent.Id)
		assert.NotContains(t, ancestorMap, grandparent.Id)
	})

	t.Run("handles empty ParentId correctly", func(t *testing.T) {
		rootWithEmptyParent := testInsertPage(s, channel.Id, wikiID, userID, "", "Root with Empty Parent")

		ancestors, err := ss.Page().GetPageAncestors(rootWithEmptyParent.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestors)
		assert.Empty(t, ancestors, "page with empty ParentId should have no ancestors")
	})
}

func testGetPageDescendants(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("get descendants of page with subtree", func(t *testing.T) {
		root := testInsertPage(s, channel.Id, wikiID, userID, "", "Root")
		child1 := testInsertPage(s, channel.Id, wikiID, userID, root.Id, "Child 1")
		grandchild := testInsertPage(s, channel.Id, wikiID, userID, child1.Id, "Grandchild")
		child2 := testInsertPage(s, channel.Id, wikiID, userID, root.Id, "Child 2")

		descendants, err := ss.Page().GetPageDescendants(root.Id)
		require.NoError(t, err)
		require.NotNil(t, descendants)
		descMap := pageSliceToMap(descendants)
		assert.Len(t, descMap, 3)
		assert.Contains(t, descMap, child1.Id)
		assert.Contains(t, descMap, child2.Id)
		assert.Contains(t, descMap, grandchild.Id)
	})

	t.Run("get descendants returns empty for leaf page", func(t *testing.T) {
		leaf := testInsertPage(s, channel.Id, wikiID, userID, "", "Leaf page")

		descendants, err := ss.Page().GetPageDescendants(leaf.Id)
		require.NoError(t, err)
		require.NotNil(t, descendants)
		assert.Len(t, descendants, 0)
	})

	t.Run("get descendants excludes deleted pages", func(t *testing.T) {
		root := testInsertPage(s, channel.Id, wikiID, userID, "", "Root")
		activeChild := testInsertPage(s, channel.Id, wikiID, userID, root.Id, "Active child")
		deletedChild := testInsertPageWithDeleteAt(s, channel.Id, wikiID, userID, root.Id, "Deleted child", model.GetMillis())

		descendants, err := ss.Page().GetPageDescendants(root.Id)
		require.NoError(t, err)
		descMap := pageSliceToMap(descendants)
		assert.Len(t, descMap, 1)
		assert.Contains(t, descMap, activeChild.Id)
		assert.NotContains(t, descMap, deletedChild.Id)
	})

	t.Run("handles deep nesting (12+ levels)", func(t *testing.T) {
		root := testInsertPage(s, channel.Id, wikiID, userID, "", "Deep Root")

		currentParentID := root.Id
		var allIDs []string
		for i := 1; i <= 12; i++ {
			p := testInsertPage(s, channel.Id, wikiID, userID, currentParentID, fmt.Sprintf("Level %d", i))
			allIDs = append(allIDs, p.Id)
			currentParentID = p.Id
		}

		descendants, err := ss.Page().GetPageDescendants(root.Id)
		require.NoError(t, err)
		require.NotNil(t, descendants)
		descMap := pageSliceToMap(descendants)
		assert.Len(t, descMap, 12, "should return all 12 levels of descendants")

		for _, id := range allIDs {
			assert.Contains(t, descMap, id, "should contain page at each level")
		}
	})
}

func testChangePageParent(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("change page parent successfully", func(t *testing.T) {
		oldParent := testInsertPage(s, channel.Id, wikiID, userID, "", "Old Parent")
		newParent := testInsertPage(s, channel.Id, wikiID, userID, "", "New Parent")
		page := testInsertPage(s, channel.Id, wikiID, userID, oldParent.Id, "Page to move")

		time.Sleep(10 * time.Millisecond)

		err = ss.Page().ChangePageParent(page.Id, newParent.Id, page.UpdateAt)
		require.NoError(t, err)

		updatedPage, err := ss.Page().GetPage(rctx, page.Id, false)
		require.NoError(t, err)
		assert.Equal(t, newParent.Id, updatedPage.ParentId)
		assert.Greater(t, updatedPage.UpdateAt, page.UpdateAt)
	})

	t.Run("change page to root (empty parent)", func(t *testing.T) {
		parent := testInsertPage(s, channel.Id, wikiID, userID, "", "Parent")
		page := testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Page with parent")

		err = ss.Page().ChangePageParent(page.Id, "", page.UpdateAt)
		require.NoError(t, err)

		updatedPage, err := ss.Page().GetPage(rctx, page.Id, false)
		require.NoError(t, err)
		assert.Empty(t, updatedPage.ParentId)
	})

	t.Run("change page parent fails for non-existent page", func(t *testing.T) {
		newParent := testInsertPage(s, channel.Id, wikiID, userID, "", "New Parent")

		err = ss.Page().ChangePageParent("nonexistent", newParent.Id, 0)
		require.Error(t, err)
	})

	t.Run("change page parent fails with stale UpdateAt (optimistic locking)", func(t *testing.T) {
		newParent := testInsertPage(s, channel.Id, wikiID, userID, "", "New Parent")
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Page")

		// Use a stale UpdateAt value (simulating concurrent modification)
		staleUpdateAt := page.UpdateAt - 1000

		err = ss.Page().ChangePageParent(page.Id, newParent.Id, staleUpdateAt)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.True(t, errors.As(err, &nfErr), "expected ErrNotFound for optimistic locking conflict")
	})
}

func testConcurrentOperations(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Concurrent Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("concurrent page reads", func(t *testing.T) {
		testInsertPage(s, channel.Id, wikiID, userID, "", "Concurrent Read Page")

		const numReaders = 10
		errChan := make(chan error, numReaders)

		for range numReaders {
			go func() {
				result, getErr := ss.Page().GetChannelPages(channel.Id, 0, 0)
				if getErr != nil {
					errChan <- getErr
					return
				}
				if result == nil {
					errChan <- fmt.Errorf("nil result from GetChannelPages")
					return
				}
				errChan <- nil
			}()
		}

		for range numReaders {
			readErr := <-errChan
			require.NoError(t, readErr)
		}
	})

	t.Run("concurrent page reads of children", func(t *testing.T) {
		parent := testInsertPage(s, channel.Id, wikiID, userID, "", "Parent for Hierarchy Test")

		const numChildren = 5
		childIDs := make([]string, numChildren)
		for i := range numChildren {
			child := testInsertPage(s, channel.Id, wikiID, userID, parent.Id, fmt.Sprintf("Child %d", i))
			childIDs[i] = child.Id
		}

		errChan := make(chan error, numChildren)
		for _, childID := range childIDs {
			go func(cID string) {
				ancestors, ancestorErr := ss.Page().GetPageAncestors(cID)
				if ancestorErr != nil {
					errChan <- ancestorErr
					return
				}
				if len(ancestors) == 0 {
					errChan <- fmt.Errorf("expected at least 1 ancestor for child page")
					return
				}
				errChan <- nil
			}(childID)
		}

		for range numChildren {
			ancestorErr := <-errChan
			require.NoError(t, ancestorErr)
		}
	})

	t.Run("concurrent content updates", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Content Test")

		const numUpdates = 3
		errChan := make(chan error, numUpdates)

		for i := range numUpdates {
			go func(idx int) {
				title := fmt.Sprintf("Updated Title %d", idx)
				contentJSON := fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content %d"}]}]}`, idx)

				_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, title, contentJSON)
				errChan <- updateErr
			}(i)
		}

		for range numUpdates {
			updateErr := <-errChan
			require.NoError(t, updateErr)
		}

		finalPage, err := ss.Page().GetPage(rctx, page.Id, false)
		require.NoError(t, err)
		require.NotNil(t, finalPage)
		require.Contains(t, finalPage.Title, "Updated Title")
	})
}

func testDeletePage(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DeletePage Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()
	user2ID := model.NewId()
	wikiID := model.NewId()

	t.Run("deletes page drafts from Drafts table", func(t *testing.T) {
		page, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Page With Drafts",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		draft1 := &model.Draft{
			UserId:    userID,
			ChannelId: wikiID,
			RootId:    page.Id,
			Message:   "",
		}
		_, err = ss.Draft().UpsertPageDraft(draft1)
		require.NoError(t, err)

		draft2 := &model.Draft{
			UserId:    user2ID,
			ChannelId: wikiID,
			RootId:    page.Id,
			Message:   "",
		}
		_, err = ss.Draft().UpsertPageDraft(draft2)
		require.NoError(t, err)

		getDraft1, err := ss.Draft().Get(userID, wikiID, page.Id, false)
		require.NoError(t, err)
		require.NotNil(t, getDraft1)

		getDraft2, err := ss.Draft().Get(user2ID, wikiID, page.Id, false)
		require.NoError(t, err)
		require.NotNil(t, getDraft2)

		err = ss.Page().DeletePage(page.Id, userID, "")
		require.NoError(t, err)

		_, err = ss.Draft().Get(userID, wikiID, page.Id, false)
		require.Error(t, err)
		var notFoundErr *store.ErrNotFound
		assert.True(t, errors.As(err, &notFoundErr), "expected ErrNotFound after page deletion")

		_, err = ss.Draft().Get(user2ID, wikiID, page.Id, false)
		require.Error(t, err)
		assert.True(t, errors.As(err, &notFoundErr), "expected ErrNotFound for second user's draft after page deletion")
	})

	t.Run("deletes page drafts when page is deleted", func(t *testing.T) {
		page, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Page With Content Drafts",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		draft := &model.Draft{
			UserId:    userID,
			ChannelId: wikiID,
			RootId:    page.Id,
			Message:   `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`,
		}
		_, err = ss.Draft().UpsertPageDraft(draft)
		require.NoError(t, err)

		getDraft, err := ss.Draft().Get(userID, wikiID, page.Id, false)
		require.NoError(t, err)
		require.NotNil(t, getDraft)

		err = ss.Page().DeletePage(page.Id, userID, "")
		require.NoError(t, err)

		_, err = ss.Draft().Get(userID, wikiID, page.Id, false)
		require.Error(t, err)
		var notFoundErr *store.ErrNotFound
		assert.True(t, errors.As(err, &notFoundErr), "expected ErrNotFound for draft after page deletion")
	})

	t.Run("does not affect drafts for other pages", func(t *testing.T) {
		page1, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Page 1",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		page2, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Page 2",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		draft1 := &model.Draft{
			UserId:    userID,
			ChannelId: wikiID,
			RootId:    page1.Id,
			Message:   "",
		}
		_, err = ss.Draft().UpsertPageDraft(draft1)
		require.NoError(t, err)

		draft2 := &model.Draft{
			UserId:    userID,
			ChannelId: wikiID,
			RootId:    page2.Id,
			Message:   "",
		}
		_, err = ss.Draft().UpsertPageDraft(draft2)
		require.NoError(t, err)

		err = ss.Page().DeletePage(page1.Id, userID, "")
		require.NoError(t, err)

		_, err = ss.Draft().Get(userID, wikiID, page1.Id, false)
		require.Error(t, err)

		getDraft2, err := ss.Draft().Get(userID, wikiID, page2.Id, false)
		require.NoError(t, err)
		require.NotNil(t, getDraft2, "draft for page2 should still exist")
	})

	t.Run("reparents direct children to newParentID and restores them on RestorePage", func(t *testing.T) {
		parent, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Parent",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		newParent, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "New Parent",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		child1, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			ParentId:  parent.Id,
			Title:     "Child 1",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		child2, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			ParentId:  parent.Id,
			Title:     "Child 2",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		// Delete the parent, reparenting its children to newParent.
		err = ss.Page().DeletePage(parent.Id, userID, newParent.Id)
		require.NoError(t, err)

		reparented1, err := ss.Page().GetPage(rctx, child1.Id, false)
		require.NoError(t, err)
		require.Equal(t, newParent.Id, reparented1.ParentId, "child1 should be reparented to newParent")

		reparented2, err := ss.Page().GetPage(rctx, child2.Id, false)
		require.NoError(t, err)
		require.Equal(t, newParent.Id, reparented2.ParentId, "child2 should be reparented to newParent")

		children, err := ss.Page().GetPageChildren(newParent.Id, model.GetPostsOptions{})
		require.NoError(t, err)
		require.Len(t, children, 2, "newParent should now have both reparented children")

		// Restore the parent: children that still point at newParent return to the parent.
		err = ss.Page().RestorePage(parent.Id)
		require.NoError(t, err)

		restored1, err := ss.Page().GetPage(rctx, child1.Id, false)
		require.NoError(t, err)
		require.Equal(t, parent.Id, restored1.ParentId, "child1 should be reparented back to the restored parent")

		restored2, err := ss.Page().GetPage(rctx, child2.Id, false)
		require.NoError(t, err)
		require.Equal(t, parent.Id, restored2.ParentId, "child2 should be reparented back to the restored parent")
	})

	t.Run("does not reparent children that were moved after the parent was deleted", func(t *testing.T) {
		parent, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Parent Moved-Child",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		newParent, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "New Parent Moved-Child",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		otherParent, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Other Parent",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		child, err := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			ParentId:  parent.Id,
			Title:     "Moving Child",
			Body:      `{"type":"doc","content":[]}`,
		})
		require.NoError(t, err)

		err = ss.Page().DeletePage(parent.Id, userID, newParent.Id)
		require.NoError(t, err)

		// User intentionally moves the child elsewhere after the delete.
		reparented, err := ss.Page().GetPage(rctx, child.Id, false)
		require.NoError(t, err)
		err = ss.Page().ChangePageParent(child.Id, otherParent.Id, reparented.UpdateAt)
		require.NoError(t, err)

		err = ss.Page().RestorePage(parent.Id)
		require.NoError(t, err)

		moved, err := ss.Page().GetPage(rctx, child.Id, false)
		require.NoError(t, err)
		require.Equal(t, otherParent.Id, moved.ParentId, "a child moved after delete must not be reparented back on restore")
	})
}

func testVersionHistoryPruning(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Pruning Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("prunes versions beyond PostEditHistoryLimit", func(t *testing.T) {
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial"}]}]}`
		page, createErr := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Pruning Test",
			Body:      initialContent,
		})
		require.NoError(t, createErr)
		require.NotNil(t, page)

		// Make 14 edits (more than PostEditHistoryLimit of 10)
		for i := 1; i <= 14; i++ {
			content := fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edit %d"}]}]}`, i)
			_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, fmt.Sprintf("Title %d", i), content)
			require.NoError(t, updateErr, "Edit %d should succeed", i)
		}

		// Verify via store API: GetPageVersionHistory should return at most 10 versions
		history, histErr := ss.Page().GetPageVersionHistory(page.Id, 0, 100)
		require.NoError(t, histErr)
		require.LessOrEqual(t, len(history), model.PostEditHistoryLimit,
			"Version history should be pruned to at most %d entries, got %d",
			model.PostEditHistoryLimit, len(history))

		// Verify via direct DB query: Pages table should have at most 10 historical entries
		var pagesCount int
		err := s.GetMaster().Get(&pagesCount,
			"SELECT COUNT(*) FROM Pages WHERE OriginalId = $1 AND DeleteAt > 0", page.Id)
		require.NoError(t, err)
		require.LessOrEqual(t, pagesCount, model.PostEditHistoryLimit,
			"Pages table should have at most %d historical entries, got %d",
			model.PostEditHistoryLimit, pagesCount)
	})

	t.Run("keeps most recent versions when pruning", func(t *testing.T) {
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Start"}]}]}`
		page, createErr := ss.Page().CreatePage(rctx, &model.Page{
			ChannelId: channel.Id,
			WikiId:    wikiID,
			UserId:    userID,
			Title:     "Order Test",
			Body:      initialContent,
		})
		require.NoError(t, createErr)

		// Make 12 edits
		for i := 1; i <= 12; i++ {
			content := fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version %d"}]}]}`, i)
			_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, fmt.Sprintf("Title %d", i), content)
			require.NoError(t, updateErr)
		}

		// Get version history
		history, histErr := ss.Page().GetPageVersionHistory(page.Id, 0, 100)
		require.NoError(t, histErr)
		require.NotEmpty(t, history)

		// Verify the most recent versions are kept (ordered by EditAt DESC)
		for i := 0; i < len(history)-1; i++ {
			require.GreaterOrEqual(t, history[i].EditAt, history[i+1].EditAt,
				"History should be ordered by EditAt DESC")
		}

		// The oldest versions (edits 1, 2) should have been pruned
		for _, entry := range history {
			require.NotContains(t, entry.Body, `"Version 1"`,
				"Oldest version should have been pruned")
		}
	})
}

func testGetSiblingPages(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Sibling Pages Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("returns root-level siblings when parentID is empty", func(t *testing.T) {
		page1 := testInsertPage(s, channel.Id, wikiID, userID, "", "Root Page 1")
		time.Sleep(2 * time.Millisecond)
		page2 := testInsertPage(s, channel.Id, wikiID, userID, "", "Root Page 2")

		siblings, sibErr := ss.Page().GetSiblingPages("", channel.Id)
		require.NoError(t, sibErr)
		require.GreaterOrEqual(t, len(siblings), 2)

		foundPage1, foundPage2 := false, false
		for _, p := range siblings {
			if p.Id == page1.Id {
				foundPage1 = true
			}
			if p.Id == page2.Id {
				foundPage2 = true
			}
		}
		require.True(t, foundPage1)
		require.True(t, foundPage2)
	})

	t.Run("returns child siblings for given parentID", func(t *testing.T) {
		parent := testInsertPage(s, channel.Id, wikiID, userID, "", "Parent Page")
		testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child 1")
		testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child 2")

		siblings, sibErr := ss.Page().GetSiblingPages(parent.Id, channel.Id)
		require.NoError(t, sibErr)
		require.Len(t, siblings, 2)
	})

	t.Run("returns empty slice when no siblings exist", func(t *testing.T) {
		nonExistentParent := model.NewId()
		siblings, sibErr := ss.Page().GetSiblingPages(nonExistentParent, channel.Id)
		require.NoError(t, sibErr)
		require.Empty(t, siblings)
	})

	t.Run("excludes deleted pages", func(t *testing.T) {
		deletedParent := model.NewId()

		activePage := testInsertPage(s, channel.Id, wikiID, userID, deletedParent, "Active Page")
		deletedPage := testInsertPageWithDeleteAt(s, channel.Id, wikiID, userID, deletedParent, "Deleted Page", model.GetMillis())

		siblings, sibErr := ss.Page().GetSiblingPages(deletedParent, channel.Id)
		require.NoError(t, sibErr)
		require.Len(t, siblings, 1)
		require.Equal(t, activePage.Id, siblings[0].Id)
		_ = deletedPage
	})

	t.Run("returns error for empty channelID", func(t *testing.T) {
		_, sibErr := ss.Page().GetSiblingPages("", "")
		require.Error(t, sibErr)
	})

	t.Run("sorts by SortOrder then CreateAt", func(t *testing.T) {
		sortTestParent := model.NewId()

		pageHigh := testInsertPageWithSortOrder(s, channel.Id, wikiID, userID, sortTestParent, "High Sort Order", 3000)
		pageLow := testInsertPageWithSortOrder(s, channel.Id, wikiID, userID, sortTestParent, "Low Sort Order", 1000)
		pageMid := testInsertPageWithSortOrder(s, channel.Id, wikiID, userID, sortTestParent, "Mid Sort Order", 2000)

		siblings, sibErr := ss.Page().GetSiblingPages(sortTestParent, channel.Id)
		require.NoError(t, sibErr)
		require.Len(t, siblings, 3)

		// Should be sorted: Low (1000), Mid (2000), High (3000)
		require.Equal(t, pageLow.Id, siblings[0].Id)
		require.Equal(t, pageMid.Id, siblings[1].Id)
		require.Equal(t, pageHigh.Id, siblings[2].Id)
	})

	t.Run("returns error for invalid parentID format", func(t *testing.T) {
		_, sibErr := ss.Page().GetSiblingPages("invalid-id-format", channel.Id)
		require.Error(t, sibErr)
	})
}

func testUpdatePageSortOrder(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Sort Order Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("reorders page from first to last position", func(t *testing.T) {
		page1 := testInsertPage(s, channel.Id, wikiID, userID, "", "Page 1")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, channel.Id, wikiID, userID, "", "Page 2")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, channel.Id, wikiID, userID, "", "Page 3")

		// Move page1 to index 2 (last position)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(page1.Id, "", channel.Id, 2)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 3)

		// Sort by SortOrder to verify order
		sortedSiblings := make([]*model.Page, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].SortOrder > sortedSiblings[j].SortOrder {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		require.Equal(t, "Page 2", sortedSiblings[0].Title)
		require.Equal(t, "Page 3", sortedSiblings[1].Title)
		require.Equal(t, "Page 1", sortedSiblings[2].Title)

		// Verify sort orders use gaps
		require.Equal(t, model.PageSortOrderGap, sortedSiblings[0].SortOrder)
		require.Equal(t, model.PageSortOrderGap*2, sortedSiblings[1].SortOrder)
		require.Equal(t, model.PageSortOrderGap*3, sortedSiblings[2].SortOrder)
	})

	t.Run("reorders page from last to first position", func(t *testing.T) {
		ch2, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel 2",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		testInsertPage(s, ch2.Id, wikiID, userID, "", "Page A")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, ch2.Id, wikiID, userID, "", "Page B")
		time.Sleep(2 * time.Millisecond)
		pageC := testInsertPage(s, ch2.Id, wikiID, userID, "", "Page C")

		// Move pageC to index 0 (first position)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageC.Id, "", ch2.Id, 0)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 3)

		// Sort by SortOrder
		sortedSiblings := make([]*model.Page, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].SortOrder > sortedSiblings[j].SortOrder {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		// Verify new order: pageC, pageA, pageB
		require.Equal(t, "Page C", sortedSiblings[0].Title)
		require.Equal(t, "Page A", sortedSiblings[1].Title)
		require.Equal(t, "Page B", sortedSiblings[2].Title)
	})

	t.Run("reorders page to middle position", func(t *testing.T) {
		parentPage := testInsertPage(s, channel.Id, wikiID, userID, "", "Parent")
		child1 := testInsertPage(s, channel.Id, wikiID, userID, parentPage.Id, "Child 1")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, channel.Id, wikiID, userID, parentPage.Id, "Child 2")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, channel.Id, wikiID, userID, parentPage.Id, "Child 3")

		// Move child1 to index 1 (middle position)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(child1.Id, parentPage.Id, channel.Id, 1)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 3)

		// Sort by SortOrder
		sortedSiblings := make([]*model.Page, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].SortOrder > sortedSiblings[j].SortOrder {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		// Verify new order: child2, child1, child3
		require.Equal(t, "Child 2", sortedSiblings[0].Title)
		require.Equal(t, "Child 1", sortedSiblings[1].Title)
		require.Equal(t, "Child 3", sortedSiblings[2].Title)
	})

	t.Run("no-op when already at target position", func(t *testing.T) {
		ch3, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel 3",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageX := testInsertPage(s, ch3.Id, wikiID, userID, "", "Page X")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, ch3.Id, wikiID, userID, "", "Page Y")

		// Move pageX to index 0 (already at 0 by CreateAt order)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageX.Id, "", ch3.Id, 0)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 2)
	})

	t.Run("clamps index to valid bounds", func(t *testing.T) {
		ch4, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel 4",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageP := testInsertPage(s, ch4.Id, wikiID, userID, "", "Page P")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, ch4.Id, wikiID, userID, "", "Page Q")

		// Try to move to index 100 (out of bounds) - should clamp to last position
		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageP.Id, "", ch4.Id, 100)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 2)

		// Verify pageP is at the end
		sortedSiblings := make([]*model.Page, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].SortOrder > sortedSiblings[j].SortOrder {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		require.Equal(t, "Page Q", sortedSiblings[0].Title)
		require.Equal(t, "Page P", sortedSiblings[1].Title)
	})

	t.Run("returns ErrNotFound for non-existent page", func(t *testing.T) {
		_, sortErr := ss.Page().UpdatePageSortOrder(model.NewId(), "", channel.Id, 0)
		require.Error(t, sortErr)
		var nfErr *store.ErrNotFound
		assert.True(t, errors.As(sortErr, &nfErr))
	})

	t.Run("returns error for invalid parentID format", func(t *testing.T) {
		validPage := testInsertPage(s, channel.Id, wikiID, userID, "", "Valid Page")

		_, sortErr := ss.Page().UpdatePageSortOrder(validPage.Id, "invalid-parent-id", channel.Id, 0)
		require.Error(t, sortErr)
	})

	t.Run("updates UpdateAt timestamp", func(t *testing.T) {
		pageT := testInsertPage(s, channel.Id, wikiID, userID, "", "Page T")
		originalUpdateAt := pageT.UpdateAt

		time.Sleep(5 * time.Millisecond)

		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageT.Id, "", channel.Id, 0)
		require.NoError(t, sortErr)
		require.NotEmpty(t, siblings)

		// Find pageT in siblings
		var updatedPageT *model.Page
		for _, p := range siblings {
			if p.Id == pageT.Id {
				updatedPageT = p
				break
			}
		}
		require.NotNil(t, updatedPageT)
		require.Greater(t, updatedPageT.UpdateAt, originalUpdateAt)
	})

	t.Run("excludes deleted pages from siblings", func(t *testing.T) {
		activeParent := testInsertPage(s, channel.Id, wikiID, userID, "", "Active Parent")
		activeSibling := testInsertPage(s, channel.Id, wikiID, userID, activeParent.Id, "Active Sibling")
		deletedSibling := testInsertPage(s, channel.Id, wikiID, userID, activeParent.Id, "Deleted Sibling")
		_, _ = s.GetMaster().Exec(`UPDATE Pages SET DeleteAt=$1 WHERE Id=$2`, model.GetMillis(), deletedSibling.Id)
		testInsertPage(s, channel.Id, wikiID, userID, activeParent.Id, "Another Sibling")

		// Reorder should only include 2 active siblings
		siblings, sortErr := ss.Page().UpdatePageSortOrder(activeSibling.Id, activeParent.Id, channel.Id, 1)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 2, "should only include active siblings, not deleted")

		// Verify deleted sibling is not in the list
		for _, p := range siblings {
			require.NotEqual(t, deletedSibling.Id, p.Id)
		}
	})
}

func testMovePage(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Move Page Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	wikiID := model.NewId()
	userID := model.NewId()

	t.Run("moves page to new parent with index", func(t *testing.T) {
		parent := testInsertPage(s, channel.Id, wikiID, userID, "", "Parent")
		testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Existing Child")
		pageToMove := testInsertPage(s, channel.Id, wikiID, userID, "", "Page to Move")

		// Move page to parent at index 0 (before existing child)
		newParentID := parent.Id
		newIndex := int64(0)
		siblings, moveErr := ss.Page().MovePage(pageToMove.Id, channel.Id, &newParentID, &newIndex, pageToMove.UpdateAt)
		require.NoError(t, moveErr)
		require.NotNil(t, siblings)
		require.Len(t, siblings, 2)

		// Verify page is now first among siblings (lower sort order)
		var movedPage, otherChild *model.Page
		for _, p := range siblings {
			if p.Id == pageToMove.Id {
				movedPage = p
			} else {
				otherChild = p
			}
		}
		require.NotNil(t, movedPage)
		require.NotNil(t, otherChild)
		require.Less(t, movedPage.SortOrder, otherChild.SortOrder)

		// Verify parent was updated
		updatedPage, getErr := ss.Page().GetPage(rctx, pageToMove.Id, false)
		require.NoError(t, getErr)
		require.Equal(t, parent.Id, updatedPage.ParentId)
	})

	t.Run("reorders page within same parent (no parent change)", func(t *testing.T) {
		parent := testInsertPage(s, channel.Id, wikiID, userID, "", "Reorder Parent")
		child1 := testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child 1")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child 2")
		time.Sleep(2 * time.Millisecond)
		testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Child 3")

		// Move child1 to index 2 (last) - only reorder, no parent change
		newIndex := int64(2)
		siblings, moveErr := ss.Page().MovePage(child1.Id, channel.Id, nil, &newIndex, child1.UpdateAt)
		require.NoError(t, moveErr)
		require.Len(t, siblings, 3)

		// Sort by SortOrder
		sortedSiblings := make([]*model.Page, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].SortOrder > sortedSiblings[j].SortOrder {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		// New order should be: Child 2, Child 3, Child 1
		require.Equal(t, "Child 2", sortedSiblings[0].Title)
		require.Equal(t, "Child 3", sortedSiblings[1].Title)
		require.Equal(t, "Child 1", sortedSiblings[2].Title)
	})

	t.Run("returns error for non-existent page", func(t *testing.T) {
		nonExistentID := model.NewId()
		newParentID := ""
		_, moveErr := ss.Page().MovePage(nonExistentID, channel.Id, &newParentID, nil, 12345)
		require.Error(t, moveErr)

		var nfErr *store.ErrNotFound
		require.True(t, errors.As(moveErr, &nfErr))
	})

	t.Run("returns error for optimistic lock failure (concurrent modification)", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "Concurrent Page")

		// Use a stale UpdateAt value (simulating concurrent modification)
		staleUpdateAt := page.UpdateAt - 1000
		newParentID := ""
		_, moveErr := ss.Page().MovePage(page.Id, channel.Id, &newParentID, nil, staleUpdateAt)
		require.Error(t, moveErr)

		var nfErr *store.ErrNotFound
		require.True(t, errors.As(moveErr, &nfErr), "expected ErrNotFound for optimistic lock failure")
	})

	t.Run("returns error when creating cycle", func(t *testing.T) {
		parent := testInsertPage(s, channel.Id, wikiID, userID, "", "Cycle Parent")
		child := testInsertPage(s, channel.Id, wikiID, userID, parent.Id, "Cycle Child")

		// Try to move parent under child (would create cycle)
		newParentID := child.Id
		_, moveErr := ss.Page().MovePage(parent.Id, channel.Id, &newParentID, nil, parent.UpdateAt)
		require.Error(t, moveErr)

		var invErr *store.ErrInvalidInput
		require.True(t, errors.As(moveErr, &invErr), "expected ErrInvalidInput for cycle detection")
	})

	t.Run("returns nil siblings when no index provided and parent unchanged", func(t *testing.T) {
		page := testInsertPage(s, channel.Id, wikiID, userID, "", "No-op Page")

		// Move with nil parent (keep current) and nil index - should be a no-op
		siblings, moveErr := ss.Page().MovePage(page.Id, channel.Id, nil, nil, page.UpdateAt)
		require.NoError(t, moveErr)
		require.Nil(t, siblings, "no siblings should be returned for no-op move")
	})
}

func testAtomicUpdatePageNotification(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Notification Channel",
		Name:        "test-notification-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()
	pageID := model.NewId()

	t.Run("returns nil when no existing notification", func(t *testing.T) {
		result, err := ss.Page().AtomicUpdatePageNotification(channel.Id, pageID, userID, "testuser", "Test Page", model.GetMillis()-1000)
		require.NoError(t, err)
		assert.Nil(t, result, "should return nil when no existing notification")
	})

	t.Run("updates existing notification", func(t *testing.T) {
		// Create a fresh channel to isolate this subtest
		ch, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Update Notif Channel",
			Name:        "update-notif-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		testPageID := model.NewId()
		now := model.GetMillis()

		notifPost := &model.Post{
			ChannelId: ch.Id,
			UserId:    userID,
			Type:      model.PostTypePageUpdated,
			CreateAt:  now,
			Props: model.StringInterface{
				model.PagePropsPageID: testPageID,
				"page_title":          "Original Title",
				"update_count":        float64(1),
				"last_update_time":    float64(now),
				"updater_ids":         []any{userID},
				"username_" + userID:  "testuser",
			},
		}
		savedPost, saveErr := ss.Post().Save(rctx, notifPost)
		require.NoError(t, saveErr)

		sinceTime := now - 1000
		result, updateErr := ss.Page().AtomicUpdatePageNotification(ch.Id, testPageID, userID, "testuser", "Updated Title", sinceTime)
		require.NoError(t, updateErr)
		require.NotNil(t, result)
		assert.Equal(t, savedPost.Id, result.Id)
		assert.Equal(t, "Updated Title", result.Props["page_title"])

		// update_count should be incremented; the function sets it as int
		count, ok := result.Props["update_count"].(int)
		require.True(t, ok, "update_count should be int, got %T", result.Props["update_count"])
		assert.Equal(t, 2, count)
	})

	t.Run("adds new updater to updater_ids", func(t *testing.T) {
		ch2, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Notif Channel 2",
			Name:        "notif-ch-2-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageID2 := model.NewId()
		user1 := model.NewId()
		user2 := model.NewId()
		now := model.GetMillis()

		notifPost := &model.Post{
			ChannelId: ch2.Id,
			UserId:    user1,
			Type:      model.PostTypePageUpdated,
			CreateAt:  now,
			Props: model.StringInterface{
				model.PagePropsPageID: pageID2,
				"page_title":          "Page Title",
				"update_count":        float64(1),
				"last_update_time":    float64(now),
				"updater_ids":         []any{user1},
				"username_" + user1:   "user1",
			},
		}
		_, saveErr := ss.Post().Save(rctx, notifPost)
		require.NoError(t, saveErr)

		// Second user updates - should be added to updater_ids
		result, updateErr := ss.Page().AtomicUpdatePageNotification(ch2.Id, pageID2, user2, "user2", "Page Title", now-1000)
		require.NoError(t, updateErr)
		require.NotNil(t, result)

		// The function returns updater_ids as []string (built from map keys)
		updaterIds, ok := result.Props["updater_ids"].([]string)
		require.True(t, ok, "updater_ids should be []string, got %T", result.Props["updater_ids"])
		assert.Contains(t, updaterIds, user1)
		assert.Contains(t, updaterIds, user2)
		assert.Equal(t, "user2", result.Props["username_"+user2])
	})

	t.Run("ignores old notifications before sinceTime", func(t *testing.T) {
		ch3, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Notif Channel 3",
			Name:        "notif-ch-3-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageID3 := model.NewId()
		now := model.GetMillis()

		// Create a notification from 3 hours ago
		oldPost := &model.Post{
			ChannelId: ch3.Id,
			UserId:    userID,
			Type:      model.PostTypePageUpdated,
			CreateAt:  now - 3*60*60*1000,
			Props: model.StringInterface{
				model.PagePropsPageID: pageID3,
				"page_title":          "Old Notification",
				"update_count":        float64(5),
			},
		}
		_, saveErr := ss.Post().Save(rctx, oldPost)
		require.NoError(t, saveErr)

		// sinceTime is 2 hours ago - should not find the 3-hour-old notification
		sinceTime := now - 2*60*60*1000
		result, updateErr := ss.Page().AtomicUpdatePageNotification(ch3.Id, pageID3, userID, "testuser", "New Title", sinceTime)
		require.NoError(t, updateErr)
		assert.Nil(t, result, "should not find notification older than sinceTime")
	})

	t.Run("does not match notification for different page", func(t *testing.T) {
		ch4, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Notif Channel 4",
			Name:        "notif-ch-4-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageA := model.NewId()
		pageB := model.NewId()
		now := model.GetMillis()

		// Create a notification for pageA
		notifPost := &model.Post{
			ChannelId: ch4.Id,
			UserId:    userID,
			Type:      model.PostTypePageUpdated,
			CreateAt:  now,
			Props: model.StringInterface{
				model.PagePropsPageID: pageA,
				"page_title":          "Page A",
				"update_count":        float64(1),
			},
		}
		_, saveErr := ss.Post().Save(rctx, notifPost)
		require.NoError(t, saveErr)

		// Query for pageB - should not match
		result, updateErr := ss.Page().AtomicUpdatePageNotification(ch4.Id, pageB, userID, "testuser", "Page B", now-1000)
		require.NoError(t, updateErr)
		assert.Nil(t, result, "should not match notification for a different page")
	})

	t.Run("does not match deleted notification", func(t *testing.T) {
		ch5, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Notif Channel 5",
			Name:        "notif-ch-5-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageID5 := model.NewId()
		now := model.GetMillis()

		// Create a deleted notification post
		deletedPost := &model.Post{
			ChannelId: ch5.Id,
			UserId:    userID,
			Type:      model.PostTypePageUpdated,
			CreateAt:  now,
			DeleteAt:  now,
			Props: model.StringInterface{
				model.PagePropsPageID: pageID5,
				"page_title":          "Deleted Notif",
				"update_count":        float64(1),
			},
		}
		_, saveErr := ss.Post().Save(rctx, deletedPost)
		require.NoError(t, saveErr)

		result, updateErr := ss.Page().AtomicUpdatePageNotification(ch5.Id, pageID5, userID, "testuser", "New Title", now-1000)
		require.NoError(t, updateErr)
		assert.Nil(t, result, "should not match soft-deleted notification")
	})
}
