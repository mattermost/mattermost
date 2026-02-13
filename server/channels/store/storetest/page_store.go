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

func TestPageStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("GetPageChildren", func(t *testing.T) { testGetPageChildren(t, rctx, ss) })
	t.Run("GetPageAncestors", func(t *testing.T) { testGetPageAncestors(t, rctx, ss) })
	t.Run("GetPageDescendants", func(t *testing.T) { testGetPageDescendants(t, rctx, ss) })
	t.Run("GetChannelPages", func(t *testing.T) { testGetChannelPages(t, rctx, ss) })
	t.Run("ChangePageParent", func(t *testing.T) { testChangePageParent(t, rctx, ss) })
	t.Run("GetCommentsForPage", func(t *testing.T) { testGetCommentsForPage(t, rctx, ss) })
	t.Run("UpdatePageWithContent", func(t *testing.T) { testUpdatePageWithContent(t, rctx, ss) })
	t.Run("ConcurrentOperations", func(t *testing.T) { testConcurrentOperations(t, rctx, ss) })
	t.Run("DeletePage", func(t *testing.T) { testDeletePage(t, rctx, ss) })
	t.Run("VersionHistoryPruning", func(t *testing.T) { testVersionHistoryPruning(t, rctx, ss, s) })
	t.Run("GetSiblingPages", func(t *testing.T) { testGetSiblingPages(t, rctx, ss) })
	t.Run("UpdatePageSortOrder", func(t *testing.T) { testUpdatePageSortOrder(t, rctx, ss) })
	t.Run("MovePage", func(t *testing.T) { testMovePage(t, rctx, ss) })
	t.Run("AtomicUpdatePageNotification", func(t *testing.T) { testAtomicUpdatePageNotification(t, rctx, ss) })

	t.Cleanup(func() {
		typesSQL := pagePostTypesSQL()
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM PropertyValues WHERE TargetType = 'post' AND TargetID IN (SELECT Id FROM Posts WHERE Type IN (%s))", typesSQL))
		_, _ = s.GetMaster().Exec("DELETE FROM PageContents")
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM Posts WHERE Type IN (%s)", typesSQL))
		// Clean up wikis that have no remaining pages (orphaned by page deletion above)
		_, _ = s.GetMaster().Exec("DELETE FROM Wikis WHERE Id NOT IN (SELECT DISTINCT (Props->>'wiki_id')::text FROM Posts WHERE Props->>'wiki_id' IS NOT NULL AND Type = 'page' AND DeleteAt = 0)")
		// Clean up channels that have no remaining posts or wikis (test-created channels only)
		// Note: We don't delete all channels as that could affect parallel tests
		_, _ = s.GetMaster().Exec("DELETE FROM Channels WHERE Id NOT IN (SELECT DISTINCT ChannelId FROM Posts WHERE ChannelId IS NOT NULL) AND Id NOT IN (SELECT DISTINCT ChannelId FROM Wikis WHERE ChannelId IS NOT NULL)")
	})
}

func testGetPageChildren(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel1, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "DisplayName1",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	t.Run("returns multiple children", func(t *testing.T) {
		parentPage := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Parent Page",
		}
		parentPage, err = ss.Post().Save(rctx, parentPage)
		require.NoError(t, err)

		childPage1 := &model.Post{
			ChannelId:    channel1.Id,
			UserId:       model.NewId(),
			Type:         model.PostTypePage,
			Message:      "Child Page 1",
			PageParentId: parentPage.Id,
		}
		childPage1, err = ss.Post().Save(rctx, childPage1)
		require.NoError(t, err)

		childPage2 := &model.Post{
			ChannelId:    channel1.Id,
			UserId:       model.NewId(),
			Type:         model.PostTypePage,
			Message:      "Child Page 2",
			PageParentId: parentPage.Id,
		}
		childPage2, err = ss.Post().Save(rctx, childPage2)
		require.NoError(t, err)

		otherPage := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Other Page",
		}
		otherPage, err = ss.Post().Save(rctx, otherPage)
		require.NoError(t, err)

		result, childErr := ss.Page().GetPageChildren(parentPage.Id, model.GetPostsOptions{})
		require.NoError(t, childErr)
		require.NotNil(t, result)
		require.Len(t, result.Posts, 2, "should return 2 child pages")
		require.Contains(t, result.Posts, childPage1.Id)
		require.Contains(t, result.Posts, childPage2.Id)
		require.NotContains(t, result.Posts, parentPage.Id, "should not include parent")
		require.NotContains(t, result.Posts, otherPage.Id, "should not include unrelated page")
	})

	t.Run("returns empty list for page with no children", func(t *testing.T) {
		leafPage := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Leaf Page",
		}
		leafPage, err = ss.Post().Save(rctx, leafPage)
		require.NoError(t, err)

		result, leafErr := ss.Page().GetPageChildren(leafPage.Id, model.GetPostsOptions{})
		require.NoError(t, leafErr)
		require.NotNil(t, result)
		require.Empty(t, result.Posts)
		require.Empty(t, result.Order)
	})

	t.Run("returns empty list for non-existent page", func(t *testing.T) {
		result, nonExistErr := ss.Page().GetPageChildren(model.NewId(), model.GetPostsOptions{})
		require.NoError(t, nonExistErr)
		require.NotNil(t, result)
		require.Empty(t, result.Posts)
	})

	t.Run("excludes soft-deleted pages", func(t *testing.T) {
		parent := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Parent for Delete Test",
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		activeChild := &model.Post{
			ChannelId:    channel1.Id,
			UserId:       model.NewId(),
			Type:         model.PostTypePage,
			Message:      "Active Child",
			PageParentId: parent.Id,
		}
		activeChild, err = ss.Post().Save(rctx, activeChild)
		require.NoError(t, err)

		deletedChild := &model.Post{
			ChannelId:    channel1.Id,
			UserId:       model.NewId(),
			Type:         model.PostTypePage,
			Message:      "Deleted Child",
			PageParentId: parent.Id,
		}
		deletedChild, err = ss.Post().Save(rctx, deletedChild)
		require.NoError(t, err)

		err = ss.Post().Delete(rctx, deletedChild.Id, model.GetMillis(), model.NewId())
		require.NoError(t, err)

		result, childrenErr := ss.Page().GetPageChildren(parent.Id, model.GetPostsOptions{})
		require.NoError(t, childrenErr)
		require.Len(t, result.Posts, 1)
		require.Contains(t, result.Posts, activeChild.Id)
		require.NotContains(t, result.Posts, deletedChild.Id)
	})

	t.Run("orders by CreateAt DESC (newest first)", func(t *testing.T) {
		parent := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Parent for Order Test",
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		older := &model.Post{
			ChannelId:    channel1.Id,
			UserId:       model.NewId(),
			Type:         model.PostTypePage,
			Message:      "Older Child",
			PageParentId: parent.Id,
			CreateAt:     model.GetMillis() - 2000,
		}
		older, err = ss.Post().Save(rctx, older)
		require.NoError(t, err)

		newer := &model.Post{
			ChannelId:    channel1.Id,
			UserId:       model.NewId(),
			Type:         model.PostTypePage,
			Message:      "Newer Child",
			PageParentId: parent.Id,
			CreateAt:     model.GetMillis(),
		}
		newer, err = ss.Post().Save(rctx, newer)
		require.NoError(t, err)

		result, err := ss.Page().GetPageChildren(parent.Id, model.GetPostsOptions{})
		require.NoError(t, err)
		require.Len(t, result.Order, 2)
		require.Equal(t, newer.Id, result.Order[0], "newer should be first")
		require.Equal(t, older.Id, result.Order[1], "older should be second")
	})
}

func testGetChannelPages(t *testing.T, rctx request.CTX, ss store.Store) {
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

	page1 := &model.Post{
		ChannelId: channel1.Id,
		UserId:    model.NewId(),
		Type:      model.PostTypePage,
		Message:   "Page 1",
	}
	page1, err = ss.Post().Save(rctx, page1)
	require.NoError(t, err)

	page2 := &model.Post{
		ChannelId: channel1.Id,
		UserId:    model.NewId(),
		Type:      model.PostTypePage,
		Message:   "Page 2",
	}
	page2, err = ss.Post().Save(rctx, page2)
	require.NoError(t, err)

	childPage := &model.Post{
		ChannelId:    channel1.Id,
		UserId:       model.NewId(),
		Type:         model.PostTypePage,
		Message:      "Child Page",
		PageParentId: page1.Id,
	}
	childPage, err = ss.Post().Save(rctx, childPage)
	require.NoError(t, err)

	regularPost := &model.Post{
		ChannelId: channel1.Id,
		UserId:    model.NewId(),
		Type:      model.PostTypeDefault,
		Message:   "Regular Post",
	}
	regularPost, err = ss.Post().Save(rctx, regularPost)
	require.NoError(t, err)

	pageInChannel2 := &model.Post{
		ChannelId: channel2.Id,
		UserId:    model.NewId(),
		Type:      model.PostTypePage,
		Message:   "Page in Channel 2",
	}
	pageInChannel2, err = ss.Post().Save(rctx, pageInChannel2)
	require.NoError(t, err)

	t.Run("returns multiple pages ordered by CreateAt ASC", func(t *testing.T) {
		result, channelErr := ss.Page().GetChannelPages(channel1.Id)
		require.NoError(t, channelErr)
		require.NotNil(t, result)
		require.Len(t, result.Posts, 3, "should return 3 pages (parent, child, and sibling)")
		require.Contains(t, result.Posts, page1.Id)
		require.Contains(t, result.Posts, page2.Id)
		require.Contains(t, result.Posts, childPage.Id)
		require.NotContains(t, result.Posts, regularPost.Id, "should not include regular posts")
		require.NotContains(t, result.Posts, pageInChannel2.Id, "should not include pages from other channels")

		require.Len(t, result.Order, 3, "order should have 3 items")
		require.Equal(t, page1.Id, result.Order[0], "pages should be ordered by CreateAt ASC (oldest first)")
	})

	t.Run("returns empty list for empty channel", func(t *testing.T) {
		emptyChannel, emptyErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Empty Channel",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, emptyErr)

		result, resultErr := ss.Page().GetChannelPages(emptyChannel.Id)
		require.NoError(t, resultErr)
		require.NotNil(t, result)
		require.Empty(t, result.Posts)
		require.Empty(t, result.Order)
	})

	t.Run("ensures cross-channel isolation", func(t *testing.T) {
		result1, channel1Err := ss.Page().GetChannelPages(channel1.Id)
		require.NoError(t, channel1Err)
		require.Contains(t, result1.Posts, page1.Id)
		require.NotContains(t, result1.Posts, pageInChannel2.Id, "channel1 should not include pages from channel2")

		result2, channel2Err := ss.Page().GetChannelPages(channel2.Id)
		require.NoError(t, channel2Err)
		require.Contains(t, result2.Posts, pageInChannel2.Id)
		require.NotContains(t, result2.Posts, page1.Id, "channel2 should not include pages from channel1")
	})

	t.Run("excludes soft-deleted pages", func(t *testing.T) {
		activePage := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Active Page",
		}
		activePage, err = ss.Post().Save(rctx, activePage)
		require.NoError(t, err)

		deletedPage := &model.Post{
			ChannelId: channel1.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Deleted Page",
		}
		deletedPage, err = ss.Post().Save(rctx, deletedPage)
		require.NoError(t, err)

		err = ss.Post().Delete(rctx, deletedPage.Id, model.GetMillis(), model.NewId())
		require.NoError(t, err)

		result, delPageErr := ss.Page().GetChannelPages(channel1.Id)
		require.NoError(t, delPageErr)
		require.Contains(t, result.Posts, activePage.Id)
		require.NotContains(t, result.Posts, deletedPage.Id, "should not include deleted pages")
	})

	t.Run("respects PageSortOrder within same parent", func(t *testing.T) {
		sortChannel, sortErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, sortErr)

		// Create pages with explicit sort orders (out of creation order)
		pageC := &model.Post{
			ChannelId: sortChannel.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Page C (sort=3000)",
		}
		pageC, err = ss.Post().Save(rctx, pageC)
		require.NoError(t, err)
		origC := pageC.Clone()
		pageC.SetPageSortOrder(3000)
		pageC, err = ss.Post().Update(rctx, pageC, origC)
		require.NoError(t, err)

		pageA := &model.Post{
			ChannelId: sortChannel.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Page A (sort=1000)",
		}
		pageA, err = ss.Post().Save(rctx, pageA)
		require.NoError(t, err)
		origA := pageA.Clone()
		pageA.SetPageSortOrder(1000)
		pageA, err = ss.Post().Update(rctx, pageA, origA)
		require.NoError(t, err)

		pageB := &model.Post{
			ChannelId: sortChannel.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Message:   "Page B (sort=2000)",
		}
		pageB, err = ss.Post().Save(rctx, pageB)
		require.NoError(t, err)
		origB := pageB.Clone()
		pageB.SetPageSortOrder(2000)
		pageB, err = ss.Post().Update(rctx, pageB, origB)
		require.NoError(t, err)

		result, resultErr := ss.Page().GetChannelPages(sortChannel.Id)
		require.NoError(t, resultErr)
		require.Len(t, result.Order, 3)
		require.Equal(t, pageA.Id, result.Order[0], "should be sorted by page_sort_order ascending")
		require.Equal(t, pageB.Id, result.Order[1])
		require.Equal(t, pageC.Id, result.Order[2])
	})
}
func testGetCommentsForPage(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("returns page and inline comments", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Test Page",
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

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

		require.Len(t, result.Posts, 3, "should return page + 2 inline comments")
		require.Contains(t, result.Posts, page.Id)
		require.Contains(t, result.Posts, inlineComment1.Id)
		require.Contains(t, result.Posts, inlineComment2.Id)

		require.Len(t, result.Order, 3)
		require.Equal(t, page.Id, result.Order[0], "page should be first")
	})

	t.Run("returns inline comment replies", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with replies",
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

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

		require.Len(t, result.Posts, 3, "should return page + inline comment + reply")
		require.Contains(t, result.Posts, page.Id)
		require.Contains(t, result.Posts, inlineComment.Id)
		require.Contains(t, result.Posts, reply.Id)

		require.Equal(t, "", result.Posts[inlineComment.Id].RootId, "inline comment should have empty RootId")
		require.Equal(t, inlineComment.Id, result.Posts[reply.Id].RootId, "reply should have RootId = inlineComment.Id")
	})

	t.Run("filters deleted inline comments when includeDeleted=false", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with deleted inline comment",
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

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

		require.Len(t, result.Posts, 1, "should only return page, not deleted inline comment")
		require.Contains(t, result.Posts, page.Id)
		require.NotContains(t, result.Posts, inlineComment.Id)
	})

	t.Run("includes deleted inline comments when includeDeleted=true", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with deleted inline comment 2",
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

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

		require.Len(t, result.Posts, 2, "should include page and deleted inline comment")
		require.Contains(t, result.Posts, page.Id)
		require.Contains(t, result.Posts, inlineComment.Id)

		deletedComment := result.Posts[inlineComment.Id]
		require.Greater(t, deletedComment.DeleteAt, int64(0), "deleted comment should have DeleteAt > 0")
	})

	t.Run("returns page only when no inline comments exist", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Empty page",
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false, 0, 200)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 1, "should only return the page itself")
		require.Contains(t, result.Posts, page.Id)
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
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page for ordering test",
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

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

		require.Len(t, result.Order, 3)
		require.Equal(t, page.Id, result.Order[0], "page should be first")
		require.Equal(t, comment1.Id, result.Order[1], "first comment created should be second")
		require.Equal(t, comment2.Id, result.Order[2], "second comment created should be third")

		pagePost := result.Posts[page.Id]
		comment1Post := result.Posts[comment1.Id]
		comment2Post := result.Posts[comment2.Id]

		require.Less(t, pagePost.CreateAt, comment1Post.CreateAt, "page CreateAt should be before comment1")
		require.Less(t, comment1Post.CreateAt, comment2Post.CreateAt, "comment1 CreateAt should be before comment2")
	})
}

func testUpdatePageWithContent(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("updates title only", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Original message",
			Props: model.StringInterface{
				"title": "Original Title",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		originalUpdateAt := page.UpdateAt

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "New Title", "", "")
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPost)

		require.Equal(t, "New Title", updatedPost.Props["title"])
		require.Greater(t, updatedPost.UpdateAt, originalUpdateAt, "UpdateAt should be incremented")
	})

	t.Run("updates content only", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with content",
			Props: model.StringInterface{
				"title": "Page Title",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`
		searchText := "Test content"

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", contentJSON, searchText)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPost)

		pageContent, contentErr := ss.Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContent)

		actualContentJSON, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, contentJSON, actualContentJSON)
		require.Equal(t, searchText, pageContent.SearchText)
	})

	t.Run("updates both title and content", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Original message",
			Props: model.StringInterface{
				"title": "Original Title",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		contentJSON := `{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"New Heading"}]}]}`
		searchText := "New Heading"

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "Updated Title", contentJSON, searchText)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPost)

		require.Equal(t, "Updated Title", updatedPost.Props["title"])

		pageContent, contentErr := ss.Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)

		actualContentJSON, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, contentJSON, actualContentJSON)
		require.Equal(t, searchText, pageContent.SearchText)
	})

	t.Run("fails for non-existent pageID", func(t *testing.T) {
		nonExistentPageID := model.NewId()

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, nonExistentPageID, "Title", "", "")
		require.Error(t, updateErr)
		require.Nil(t, updatedPost)
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page for invalid JSON test",
			Props: model.StringInterface{
				"title": "Test Page",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		invalidJSON := `{"type":"doc","content":["invalid structure`

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", invalidJSON, "")
		require.Error(t, updateErr)
		require.Nil(t, updatedPost)
	})

	t.Run("inserts PageContent if it doesn't exist (upsert INSERT path)", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page without content",
			Props: model.StringInterface{
				"title": "Empty Page",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		_, contentErr := ss.Page().GetPageContent(page.Id)
		require.Error(t, contentErr, "should not have content initially")

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First content"}]}]}`
		searchText := "First content"

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", contentJSON, searchText)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPost)

		pageContent, getErr := ss.Page().GetPageContent(page.Id)
		require.NoError(t, getErr, "content should now exist")

		actualContentJSON, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, contentJSON, actualContentJSON)
		require.Equal(t, searchText, pageContent.SearchText)
	})

	t.Run("updates existing PageContent (upsert UPDATE path)", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with existing content",
			Props: model.StringInterface{
				"title": "Page Title",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		initialContentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial content"}]}]}`
		initialSearchText := "Initial content"
		initialContent := &model.PageContent{
			PageId:     page.Id,
			SearchText: initialSearchText,
		}
		err = initialContent.SetDocumentJSON(initialContentJSON)
		require.NoError(t, err)

		_, err = ss.Page().SavePageContent(initialContent)
		require.NoError(t, err)

		updatedContentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
		updatedSearchText := "Updated content"

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "", updatedContentJSON, updatedSearchText)
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPost)

		pageContent, getErr := ss.Page().GetPageContent(page.Id)
		require.NoError(t, getErr)

		actualContentJSON, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, updatedContentJSON, actualContentJSON)
		require.Equal(t, updatedSearchText, pageContent.SearchText)
	})

	t.Run("verifies UpdateAt is incremented", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page for UpdateAt test",
			Props: model.StringInterface{
				"title": "Original Title",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		originalUpdateAt := page.UpdateAt

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"New content"}]}]}`

		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, "New Title", contentJSON, "New content")
		require.NoError(t, updateErr)
		require.NotNil(t, updatedPost)

		require.Greater(t, updatedPost.UpdateAt, originalUpdateAt, "UpdateAt should be incremented")

		fetchedPost, fetchErr := ss.Post().GetSingle(rctx, page.Id, false)
		require.NoError(t, fetchErr)
		require.Equal(t, updatedPost.UpdateAt, fetchedPost.UpdateAt, "UpdateAt should be persisted")
	})

	t.Run("fails with empty pageID", func(t *testing.T) {
		updatedPost, updateErr := ss.Page().UpdatePageWithContent(rctx, "", "Title", "", "")
		require.Error(t, updateErr)
		require.Nil(t, updatedPost)
	})
}

func testGetPageAncestors(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("get ancestors of 3-level hierarchy", func(t *testing.T) {
		grandparent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Grandparent",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Grandparent",
			},
		}
		grandparent, err := ss.Post().Save(rctx, grandparent)
		require.NoError(t, err)

		parent := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Parent",
			Type:         model.PostTypePage,
			PageParentId: grandparent.Id,
			Props: map[string]any{
				"title": "Parent",
			},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		child := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Child",
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Props: map[string]any{
				"title": "Child",
			},
		}
		child, err = ss.Post().Save(rctx, child)
		require.NoError(t, err)

		ancestors, err := ss.Page().GetPageAncestors(child.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestors)
		assert.Len(t, ancestors.Posts, 2)
		assert.Contains(t, ancestors.Posts, parent.Id)
		assert.Contains(t, ancestors.Posts, grandparent.Id)
	})

	t.Run("get ancestors returns empty for root page", func(t *testing.T) {
		root := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Root page",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Root",
			},
		}
		root, err := ss.Post().Save(rctx, root)
		require.NoError(t, err)

		ancestors, err := ss.Page().GetPageAncestors(root.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestors)
		assert.Len(t, ancestors.Posts, 0)
	})

	t.Run("get ancestors excludes deleted pages", func(t *testing.T) {
		grandparent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Grandparent",
			Type:      model.PostTypePage,
			DeleteAt:  model.GetMillis(),
			Props: map[string]any{
				"title": "Deleted Grandparent",
			},
		}
		grandparent, err := ss.Post().Save(rctx, grandparent)
		require.NoError(t, err)

		parent := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Parent",
			Type:         model.PostTypePage,
			PageParentId: grandparent.Id,
			Props: map[string]any{
				"title": "Parent",
			},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		child := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Child",
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Props: map[string]any{
				"title": "Child",
			},
		}
		child, err = ss.Post().Save(rctx, child)
		require.NoError(t, err)

		ancestors, err := ss.Page().GetPageAncestors(child.Id)
		require.NoError(t, err)
		assert.Len(t, ancestors.Posts, 1)
		assert.Contains(t, ancestors.Posts, parent.Id)
		assert.NotContains(t, ancestors.Posts, grandparent.Id)
	})

	t.Run("handles NULL vs empty PageParentId correctly", func(t *testing.T) {
		rootWithEmptyParent := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Root with empty parent",
			Type:         model.PostTypePage,
			PageParentId: "",
			Props: map[string]any{
				"title": "Root with Empty Parent",
			},
		}
		rootWithEmptyParent, err := ss.Post().Save(rctx, rootWithEmptyParent)
		require.NoError(t, err)

		ancestors, err := ss.Page().GetPageAncestors(rootWithEmptyParent.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestors)
		assert.Empty(t, ancestors.Posts, "page with empty PageParentId should have no ancestors")
	})
}

func testGetPageDescendants(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("get descendants of page with subtree", func(t *testing.T) {
		root := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Root",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Root",
			},
		}
		root, err := ss.Post().Save(rctx, root)
		require.NoError(t, err)

		child1 := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Child 1",
			Type:         model.PostTypePage,
			PageParentId: root.Id,
			Props: map[string]any{
				"title": "Child 1",
			},
		}
		child1, err = ss.Post().Save(rctx, child1)
		require.NoError(t, err)

		grandchild := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Grandchild",
			Type:         model.PostTypePage,
			PageParentId: child1.Id,
			Props: map[string]any{
				"title": "Grandchild",
			},
		}
		grandchild, err = ss.Post().Save(rctx, grandchild)
		require.NoError(t, err)

		child2 := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Child 2",
			Type:         model.PostTypePage,
			PageParentId: root.Id,
			Props: map[string]any{
				"title": "Child 2",
			},
		}
		child2, err = ss.Post().Save(rctx, child2)
		require.NoError(t, err)

		descendants, err := ss.Page().GetPageDescendants(root.Id)
		require.NoError(t, err)
		require.NotNil(t, descendants)
		assert.Len(t, descendants.Posts, 3)
		assert.Contains(t, descendants.Posts, child1.Id)
		assert.Contains(t, descendants.Posts, child2.Id)
		assert.Contains(t, descendants.Posts, grandchild.Id)
	})

	t.Run("get descendants returns empty for leaf page", func(t *testing.T) {
		leaf := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Leaf page",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Leaf",
			},
		}
		leaf, err := ss.Post().Save(rctx, leaf)
		require.NoError(t, err)

		descendants, err := ss.Page().GetPageDescendants(leaf.Id)
		require.NoError(t, err)
		require.NotNil(t, descendants)
		assert.Len(t, descendants.Posts, 0)
	})

	t.Run("get descendants excludes deleted pages", func(t *testing.T) {
		root := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Root",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Root",
			},
		}
		root, err := ss.Post().Save(rctx, root)
		require.NoError(t, err)

		activeChild := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Active child",
			Type:         model.PostTypePage,
			PageParentId: root.Id,
			Props: map[string]any{
				"title": "Active",
			},
		}
		activeChild, err = ss.Post().Save(rctx, activeChild)
		require.NoError(t, err)

		deletedChild := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Deleted child",
			Type:         model.PostTypePage,
			PageParentId: root.Id,
			DeleteAt:     model.GetMillis(),
			Props: map[string]any{
				"title": "Deleted",
			},
		}
		deletedChild, err = ss.Post().Save(rctx, deletedChild)
		require.NoError(t, err)

		descendants, err := ss.Page().GetPageDescendants(root.Id)
		require.NoError(t, err)
		assert.Len(t, descendants.Posts, 1)
		assert.Contains(t, descendants.Posts, activeChild.Id)
		assert.NotContains(t, descendants.Posts, deletedChild.Id)
	})

	t.Run("handles deep nesting (12+ levels)", func(t *testing.T) {
		root := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Deep Root",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Deep Root",
			},
		}
		root, err := ss.Post().Save(rctx, root)
		require.NoError(t, err)

		currentParent := root
		var allPages []*model.Post
		for i := 1; i <= 12; i++ {
			page := &model.Post{
				UserId:       userID,
				ChannelId:    channel.Id,
				Message:      "Level " + string(rune('0'+i)),
				Type:         model.PostTypePage,
				PageParentId: currentParent.Id,
				Props: map[string]any{
					"title": "Level " + string(rune('0'+i)),
				},
			}
			page, err = ss.Post().Save(rctx, page)
			require.NoError(t, err)
			allPages = append(allPages, page)
			currentParent = page
		}

		descendants, err := ss.Page().GetPageDescendants(root.Id)
		require.NoError(t, err)
		require.NotNil(t, descendants)
		assert.Len(t, descendants.Posts, 12, "should return all 12 levels of descendants")

		for _, page := range allPages {
			assert.Contains(t, descendants.Posts, page.Id, "should contain page at each level")
		}
	})
}

func testChangePageParent(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("change page parent successfully", func(t *testing.T) {
		oldParent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Old parent",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Old Parent",
			},
		}
		oldParent, err := ss.Post().Save(rctx, oldParent)
		require.NoError(t, err)

		newParent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "New parent",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "New Parent",
			},
		}
		newParent, err = ss.Post().Save(rctx, newParent)
		require.NoError(t, err)

		page := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Page to move",
			Type:         model.PostTypePage,
			PageParentId: oldParent.Id,
			Props: map[string]any{
				"title": "Page",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		time.Sleep(10 * time.Millisecond)

		err = ss.Page().ChangePageParent(page.Id, newParent.Id, page.UpdateAt)
		require.NoError(t, err)

		updatedPage, err := ss.Post().GetSingle(rctx, page.Id, false)
		require.NoError(t, err)
		assert.Equal(t, newParent.Id, updatedPage.PageParentId)
		assert.Greater(t, updatedPage.UpdateAt, page.UpdateAt)
	})

	t.Run("change page to root (empty parent)", func(t *testing.T) {
		parent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Parent",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Parent",
			},
		}
		parent, err := ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		page := &model.Post{
			UserId:       userID,
			ChannelId:    channel.Id,
			Message:      "Page with parent",
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Props: map[string]any{
				"title": "Page",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		err = ss.Page().ChangePageParent(page.Id, "", page.UpdateAt)
		require.NoError(t, err)

		updatedPage, err := ss.Post().GetSingle(rctx, page.Id, false)
		require.NoError(t, err)
		assert.Empty(t, updatedPage.PageParentId)
	})

	t.Run("change page parent fails for non-existent page", func(t *testing.T) {
		newParent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "New parent",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "New Parent",
			},
		}
		newParent, err := ss.Post().Save(rctx, newParent)
		require.NoError(t, err)

		err = ss.Page().ChangePageParent("nonexistent", newParent.Id, 0)
		require.Error(t, err)
	})

	t.Run("change page parent fails with stale UpdateAt (optimistic locking)", func(t *testing.T) {
		newParent := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "New parent",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "New Parent",
			},
		}
		newParent, err := ss.Post().Save(rctx, newParent)
		require.NoError(t, err)

		page := &model.Post{
			UserId:    userID,
			ChannelId: channel.Id,
			Message:   "Page",
			Type:      model.PostTypePage,
			Props: map[string]any{
				"title": "Page",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		staleUpdateAt := page.UpdateAt

		// Make a copy of the original for Update
		originalPage := page.Clone()

		// Simulate a concurrent modification by updating the page
		page.Message = "Modified page"
		_, err = ss.Post().Update(rctx, page, originalPage)
		require.NoError(t, err)

		// Now try to change parent with stale UpdateAt - should fail
		err = ss.Page().ChangePageParent(page.Id, newParent.Id, staleUpdateAt)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.True(t, errors.As(err, &nfErr), "expected ErrNotFound for optimistic locking conflict")
	})
}

func testConcurrentOperations(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Concurrent Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("concurrent page reads", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Concurrent Read Page",
			Props: model.StringInterface{
				"title": "Test Page",
			},
		}
		_, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		const numReaders = 10
		errChan := make(chan error, numReaders)

		for range numReaders {
			go func() {
				result, getErr := ss.Page().GetChannelPages(channel.Id)
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

	t.Run("concurrent page writes", func(t *testing.T) {
		const numWriters = 5
		errChan := make(chan error, numWriters)
		pageIDChan := make(chan string, numWriters)

		for i := range numWriters {
			go func(idx int) {
				page := &model.Post{
					ChannelId: channel.Id,
					UserId:    userID,
					Type:      model.PostTypePage,
					Message:   fmt.Sprintf("Concurrent Write Page %d", idx),
					Props: model.StringInterface{
						"title": fmt.Sprintf("Concurrent Page %d", idx),
					},
				}
				savedPage, saveErr := ss.Post().Save(rctx, page)
				if saveErr != nil {
					errChan <- saveErr
					pageIDChan <- ""
					return
				}
				errChan <- nil
				pageIDChan <- savedPage.Id
			}(i)
		}

		var createdPages []string
		for range numWriters {
			writeErr := <-errChan
			pageID := <-pageIDChan
			require.NoError(t, writeErr)
			if pageID != "" {
				createdPages = append(createdPages, pageID)
			}
		}
		require.Len(t, createdPages, numWriters, "all pages should be created")
	})

	t.Run("concurrent read-write on same page", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Read-Write Test Page",
			Props: model.StringInterface{
				"title": "Original Title",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		const numOps = 10
		errChan := make(chan error, numOps)

		for i := range numOps {
			if i%2 == 0 {
				go func() {
					_, readErr := ss.Post().GetSingle(rctx, page.Id, false)
					errChan <- readErr
				}()
			} else {
				go func() {
					children, childErr := ss.Page().GetPageChildren(page.Id, model.GetPostsOptions{})
					if childErr != nil {
						errChan <- childErr
						return
					}
					if children == nil {
						errChan <- fmt.Errorf("nil children result")
						return
					}
					errChan <- nil
				}()
			}
		}

		for range numOps {
			opErr := <-errChan
			require.NoError(t, opErr)
		}
	})

	t.Run("concurrent hierarchy modifications", func(t *testing.T) {
		parent := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Parent for Hierarchy Test",
			Props: model.StringInterface{
				"title": "Parent",
			},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		const numChildren = 5
		childPages := make([]*model.Post, numChildren)
		for i := range numChildren {
			child := &model.Post{
				ChannelId:    channel.Id,
				UserId:       userID,
				Type:         model.PostTypePage,
				Message:      fmt.Sprintf("Child %d", i),
				PageParentId: parent.Id,
				Props: model.StringInterface{
					"title": fmt.Sprintf("Child %d", i),
				},
			}
			child, err = ss.Post().Save(rctx, child)
			require.NoError(t, err)
			childPages[i] = child
		}

		errChan := make(chan error, numChildren)
		for _, child := range childPages {
			go func(c *model.Post) {
				ancestors, ancestorErr := ss.Page().GetPageAncestors(c.Id)
				if ancestorErr != nil {
					errChan <- ancestorErr
					return
				}
				if ancestors == nil || len(ancestors.Posts) == 0 {
					errChan <- fmt.Errorf("expected at least 1 ancestor for child page")
					return
				}
				errChan <- nil
			}(child)
		}

		for range numChildren {
			ancestorErr := <-errChan
			require.NoError(t, ancestorErr)
		}
	})

	t.Run("concurrent content updates", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Content Update Test Page",
			Props: model.StringInterface{
				"title": "Content Test",
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		const numUpdates = 3
		errChan := make(chan error, numUpdates)

		for i := range numUpdates {
			go func(idx int) {
				title := fmt.Sprintf("Updated Title %d", idx)
				contentJSON := fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content %d"}]}]}`, idx)
				searchText := fmt.Sprintf("Content %d", idx)

				_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, title, contentJSON, searchText)
				errChan <- updateErr
			}(i)
		}

		for range numUpdates {
			updateErr := <-errChan
			require.NoError(t, updateErr)
		}

		finalPage, err := ss.Post().GetSingle(rctx, page.Id, false)
		require.NoError(t, err)
		require.NotNil(t, finalPage)
		require.Contains(t, finalPage.Props["title"], "Updated Title")
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
		page, err := ss.Page().CreatePage(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with drafts",
			Props: model.StringInterface{
				"title": "Page With Drafts",
			},
		}, `{"type":"doc","content":[]}`, "")
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

	t.Run("deletes page content drafts from PageContents table", func(t *testing.T) {
		page, err := ss.Page().CreatePage(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page with content drafts",
			Props: model.StringInterface{
				"title": "Page With Content Drafts",
			},
		}, `{"type":"doc","content":[]}`, "")
		require.NoError(t, err)

		draftContent := &model.PageContent{
			PageId:   page.Id,
			UserId:   userID,
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}
		err = draftContent.SetDocumentJSON(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`)
		require.NoError(t, err)

		_, err = ss.Draft().CreatePageDraft(draftContent)
		require.NoError(t, err)

		getDraft, err := ss.Draft().GetPageDraft(page.Id, userID)
		require.NoError(t, err)
		require.NotNil(t, getDraft)

		err = ss.Page().DeletePage(page.Id, userID, "")
		require.NoError(t, err)

		_, err = ss.Draft().GetPageDraft(page.Id, userID)
		require.Error(t, err)
		var notFoundErr *store.ErrNotFound
		assert.True(t, errors.As(err, &notFoundErr), "expected ErrNotFound for content draft after page deletion")
	})

	t.Run("does not affect drafts for other pages", func(t *testing.T) {
		page1, err := ss.Page().CreatePage(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page 1",
			Props: model.StringInterface{
				"title": "Page 1",
			},
		}, `{"type":"doc","content":[]}`, "")
		require.NoError(t, err)

		page2, err := ss.Page().CreatePage(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page 2",
			Props: model.StringInterface{
				"title": "Page 2",
			},
		}, `{"type":"doc","content":[]}`, "")
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

	userID := model.NewId()

	t.Run("prunes versions beyond PostEditHistoryLimit", func(t *testing.T) {
		// Create a page with initial content
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial"}]}]}`
		page, createErr := ss.Page().CreatePage(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Props:     model.StringInterface{"title": "Pruning Test"},
		}, initialContent, "Initial")
		require.NoError(t, createErr)
		require.NotNil(t, page)

		// Make 14 edits (more than PostEditHistoryLimit of 10)
		// Each edit should create a version history entry
		for i := 1; i <= 14; i++ {
			content := fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edit %d"}]}]}`, i)
			searchText := fmt.Sprintf("Edit %d", i)
			_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, fmt.Sprintf("Title %d", i), content, searchText)
			require.NoError(t, updateErr, "Edit %d should succeed", i)
		}

		// Verify via store API: GetPageVersionHistory should return at most 10 versions
		history, histErr := ss.Page().GetPageVersionHistory(page.Id, 0, 100)
		require.NoError(t, histErr)
		require.LessOrEqual(t, len(history), model.PostEditHistoryLimit,
			"Version history should be pruned to at most %d entries, got %d",
			model.PostEditHistoryLimit, len(history))

		// Verify via direct DB query: Posts table should have at most 10 historical entries
		var postsCount int
		err := s.GetMaster().Get(&postsCount,
			"SELECT COUNT(*) FROM Posts WHERE OriginalId = $1 AND DeleteAt > 0", page.Id)
		require.NoError(t, err)
		require.LessOrEqual(t, postsCount, model.PostEditHistoryLimit,
			"Posts table should have at most %d historical entries, got %d",
			model.PostEditHistoryLimit, postsCount)

		// Verify via direct DB query: PageContents table should have at most 10 historical entries
		var contentsCount int
		err = s.GetMaster().Get(&contentsCount,
			`SELECT COUNT(*) FROM PageContents WHERE PageId IN (
				SELECT Id FROM Posts WHERE OriginalId = $1 AND DeleteAt > 0
			)`, page.Id)
		require.NoError(t, err)
		require.LessOrEqual(t, contentsCount, model.PostEditHistoryLimit,
			"PageContents table should have at most %d historical entries, got %d",
			model.PostEditHistoryLimit, contentsCount)
	})

	t.Run("keeps most recent versions when pruning", func(t *testing.T) {
		// Create a page with initial content
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Start"}]}]}`
		page, createErr := ss.Page().CreatePage(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Props:     model.StringInterface{"title": "Order Test"},
		}, initialContent, "Start")
		require.NoError(t, createErr)

		// Make 12 edits
		for i := 1; i <= 12; i++ {
			content := fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version %d"}]}]}`, i)
			_, updateErr := ss.Page().UpdatePageWithContent(rctx, page.Id, fmt.Sprintf("Title %d", i), content, fmt.Sprintf("Version %d", i))
			require.NoError(t, updateErr)
		}

		// Get version history
		history, histErr := ss.Page().GetPageVersionHistory(page.Id, 0, 100)
		require.NoError(t, histErr)
		require.NotEmpty(t, history)

		// Verify the most recent versions are kept (ordered by EditAt DESC)
		// The first entry should be the most recent historical version
		for i := 0; i < len(history)-1; i++ {
			require.GreaterOrEqual(t, history[i].EditAt, history[i+1].EditAt,
				"History should be ordered by EditAt DESC")
		}

		// The oldest versions (edits 1, 2) should have been pruned
		// Remaining should be edits 3-12 (or similar recent ones)
		for _, entry := range history {
			pageContent, contentErr := ss.Page().GetPageContentWithDeleted(entry.Id)
			require.NoError(t, contentErr)
			contentJSON, _ := pageContent.GetDocumentJSON()
			// Should not contain "Version 1" or "Version 2" (oldest pruned)
			require.NotContains(t, contentJSON, `"Version 1"`,
				"Oldest version should have been pruned")
		}
	})
}

func testGetSiblingPages(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Sibling Pages Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("returns root-level siblings when parentID is empty", func(t *testing.T) {
		page1 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Root Page 1",
			Props:     model.StringInterface{"title": "Root Page 1"},
		}
		page1, err = ss.Post().Save(rctx, page1)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		page2 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Root Page 2",
			Props:     model.StringInterface{"title": "Root Page 2"},
		}
		page2, err = ss.Post().Save(rctx, page2)
		require.NoError(t, err)

		siblings, sibErr := ss.Page().GetSiblingPages("", channel.Id)
		require.NoError(t, sibErr)
		require.GreaterOrEqual(t, len(siblings), 2)

		// Verify our pages are in the result
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
		parent := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Parent Page",
			Props:     model.StringInterface{"title": "Parent Page"},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		child1 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Child 1",
			Props:        model.StringInterface{"title": "Child 1"},
		}
		_, err = ss.Post().Save(rctx, child1)
		require.NoError(t, err)

		child2 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Child 2",
			Props:        model.StringInterface{"title": "Child 2"},
		}
		_, err = ss.Post().Save(rctx, child2)
		require.NoError(t, err)

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

		activePage := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: deletedParent,
			Message:      "Active Page",
			Props:        model.StringInterface{"title": "Active Page"},
		}
		activePage, err = ss.Post().Save(rctx, activePage)
		require.NoError(t, err)

		deletedPage := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: deletedParent,
			Message:      "Deleted Page",
			Props:        model.StringInterface{"title": "Deleted Page"},
			DeleteAt:     model.GetMillis(),
		}
		_, err = ss.Post().Save(rctx, deletedPage)
		require.NoError(t, err)

		siblings, sibErr := ss.Page().GetSiblingPages(deletedParent, channel.Id)
		require.NoError(t, sibErr)
		require.Len(t, siblings, 1)
		require.Equal(t, activePage.Id, siblings[0].Id)
	})

	t.Run("returns error for empty channelID", func(t *testing.T) {
		_, sibErr := ss.Page().GetSiblingPages("", "")
		require.Error(t, sibErr)
	})

	t.Run("sorts by page_sort_order then create_at", func(t *testing.T) {
		sortTestParent := model.NewId()

		// Create pages with different sort orders
		pageHigh := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: sortTestParent,
			Message:      "High Sort Order",
			Props:        model.StringInterface{"title": "High Sort Order", "page_sort_order": int64(3000)},
		}
		_, err = ss.Post().Save(rctx, pageHigh)
		require.NoError(t, err)

		pageLow := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: sortTestParent,
			Message:      "Low Sort Order",
			Props:        model.StringInterface{"title": "Low Sort Order", "page_sort_order": int64(1000)},
		}
		_, err = ss.Post().Save(rctx, pageLow)
		require.NoError(t, err)

		pageMid := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: sortTestParent,
			Message:      "Mid Sort Order",
			Props:        model.StringInterface{"title": "Mid Sort Order", "page_sort_order": int64(2000)},
		}
		_, err = ss.Post().Save(rctx, pageMid)
		require.NoError(t, err)

		siblings, sibErr := ss.Page().GetSiblingPages(sortTestParent, channel.Id)
		require.NoError(t, sibErr)
		require.Len(t, siblings, 3)

		// Should be sorted: Low (1000), Mid (2000), High (3000)
		require.Equal(t, "Low Sort Order", siblings[0].Props["title"])
		require.Equal(t, "Mid Sort Order", siblings[1].Props["title"])
		require.Equal(t, "High Sort Order", siblings[2].Props["title"])
	})

	t.Run("returns error for invalid parentID format", func(t *testing.T) {
		_, sibErr := ss.Page().GetSiblingPages("invalid-id-format", channel.Id)
		require.Error(t, sibErr)
	})
}

func testUpdatePageSortOrder(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Sort Order Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("reorders page from first to last position", func(t *testing.T) {
		// Create 3 root-level pages
		page1 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page 1",
			Props:     model.StringInterface{"title": "Page 1"},
		}
		page1, err = ss.Post().Save(rctx, page1)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond) // Ensure different CreateAt

		page2 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page 2",
			Props:     model.StringInterface{"title": "Page 2"},
		}
		_, err = ss.Post().Save(rctx, page2)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		page3 := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page 3",
			Props:     model.StringInterface{"title": "Page 3"},
		}
		_, err = ss.Post().Save(rctx, page3)
		require.NoError(t, err)

		// Move page1 to index 2 (last position)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(page1.Id, "", channel.Id, 2)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 3)

		// Sort by new page_sort_order to verify order
		sortedSiblings := make([]*model.Post, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].GetPageSortOrder() > sortedSiblings[j].GetPageSortOrder() {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		require.Equal(t, "Page 2", sortedSiblings[0].Props["title"])
		require.Equal(t, "Page 3", sortedSiblings[1].Props["title"])
		require.Equal(t, "Page 1", sortedSiblings[2].Props["title"])

		// Verify sort orders use gaps
		require.Equal(t, model.PageSortOrderGap, sortedSiblings[0].GetPageSortOrder())
		require.Equal(t, model.PageSortOrderGap*2, sortedSiblings[1].GetPageSortOrder())
		require.Equal(t, model.PageSortOrderGap*3, sortedSiblings[2].GetPageSortOrder())
	})

	t.Run("reorders page from last to first position", func(t *testing.T) {
		// Create separate channel for isolation
		ch2, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel 2",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		// Create 3 root-level pages
		pageA := &model.Post{
			ChannelId: ch2.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page A",
			Props:     model.StringInterface{"title": "Page A"},
		}
		_, err = ss.Post().Save(rctx, pageA)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		pageB := &model.Post{
			ChannelId: ch2.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page B",
			Props:     model.StringInterface{"title": "Page B"},
		}
		_, err = ss.Post().Save(rctx, pageB)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		pageC := &model.Post{
			ChannelId: ch2.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page C",
			Props:     model.StringInterface{"title": "Page C"},
		}
		pageC, err = ss.Post().Save(rctx, pageC)
		require.NoError(t, err)

		// Move pageC to index 0 (first position)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageC.Id, "", ch2.Id, 0)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 3)

		// Sort by page_sort_order
		sortedSiblings := make([]*model.Post, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].GetPageSortOrder() > sortedSiblings[j].GetPageSortOrder() {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		// Verify new order: pageC, pageA, pageB
		require.Equal(t, "Page C", sortedSiblings[0].Props["title"])
		require.Equal(t, "Page A", sortedSiblings[1].Props["title"])
		require.Equal(t, "Page B", sortedSiblings[2].Props["title"])
	})

	t.Run("reorders page to middle position", func(t *testing.T) {
		parentPage := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Parent Page",
			Props:     model.StringInterface{"title": "Parent"},
		}
		parentPage, err = ss.Post().Save(rctx, parentPage)
		require.NoError(t, err)

		// Create child pages
		child1 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parentPage.Id,
			Message:      "Child 1",
			Props:        model.StringInterface{"title": "Child 1"},
		}
		child1, err = ss.Post().Save(rctx, child1)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		child2 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parentPage.Id,
			Message:      "Child 2",
			Props:        model.StringInterface{"title": "Child 2"},
		}
		_, err = ss.Post().Save(rctx, child2)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		child3 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parentPage.Id,
			Message:      "Child 3",
			Props:        model.StringInterface{"title": "Child 3"},
		}
		_, err = ss.Post().Save(rctx, child3)
		require.NoError(t, err)

		// Move child1 to index 1 (middle position)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(child1.Id, parentPage.Id, channel.Id, 1)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 3)

		// Sort by page_sort_order
		sortedSiblings := make([]*model.Post, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].GetPageSortOrder() > sortedSiblings[j].GetPageSortOrder() {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		// Verify new order: child2, child1, child3
		require.Equal(t, "Child 2", sortedSiblings[0].Props["title"])
		require.Equal(t, "Child 1", sortedSiblings[1].Props["title"])
		require.Equal(t, "Child 3", sortedSiblings[2].Props["title"])
	})

	t.Run("no-op when already at target position", func(t *testing.T) {
		// Create separate channel for isolation
		ch3, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel 3",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageX := &model.Post{
			ChannelId: ch3.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page X",
			Props:     model.StringInterface{"title": "Page X"},
		}
		pageX, err = ss.Post().Save(rctx, pageX)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		pageY := &model.Post{
			ChannelId: ch3.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page Y",
			Props:     model.StringInterface{"title": "Page Y"},
		}
		_, err = ss.Post().Save(rctx, pageY)
		require.NoError(t, err)

		// Move pageX to index 0 (already at 0 by CreateAt order)
		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageX.Id, "", ch3.Id, 0)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 2)
	})

	t.Run("clamps index to valid bounds", func(t *testing.T) {
		// Create separate channel for isolation
		ch4, chErr := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Sort Test Channel 4",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, chErr)

		pageP := &model.Post{
			ChannelId: ch4.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page P",
			Props:     model.StringInterface{"title": "Page P"},
		}
		pageP, err = ss.Post().Save(rctx, pageP)
		require.NoError(t, err)

		time.Sleep(2 * time.Millisecond)

		pageQ := &model.Post{
			ChannelId: ch4.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page Q",
			Props:     model.StringInterface{"title": "Page Q"},
		}
		_, err = ss.Post().Save(rctx, pageQ)
		require.NoError(t, err)

		// Try to move to index 100 (out of bounds) - should clamp to last position
		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageP.Id, "", ch4.Id, 100)
		require.NoError(t, sortErr)
		require.Len(t, siblings, 2)

		// Verify pageP is at the end
		sortedSiblings := make([]*model.Post, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].GetPageSortOrder() > sortedSiblings[j].GetPageSortOrder() {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		require.Equal(t, "Page Q", sortedSiblings[0].Props["title"])
		require.Equal(t, "Page P", sortedSiblings[1].Props["title"])
	})

	t.Run("returns ErrNotFound for non-existent page", func(t *testing.T) {
		_, sortErr := ss.Page().UpdatePageSortOrder(model.NewId(), "", channel.Id, 0)
		require.Error(t, sortErr)
		var nfErr *store.ErrNotFound
		assert.True(t, errors.As(sortErr, &nfErr))
	})

	t.Run("returns error for invalid parentID format", func(t *testing.T) {
		validPage := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Valid Page",
			Props:     model.StringInterface{"title": "Valid Page"},
		}
		validPage, err = ss.Post().Save(rctx, validPage)
		require.NoError(t, err)

		_, sortErr := ss.Page().UpdatePageSortOrder(validPage.Id, "invalid-parent-id", channel.Id, 0)
		require.Error(t, sortErr)
	})

	t.Run("updates UpdateAt timestamp", func(t *testing.T) {
		pageT := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page T",
			Props:     model.StringInterface{"title": "Page T"},
		}
		pageT, err = ss.Post().Save(rctx, pageT)
		require.NoError(t, err)

		originalUpdateAt := pageT.UpdateAt

		time.Sleep(5 * time.Millisecond)

		siblings, sortErr := ss.Page().UpdatePageSortOrder(pageT.Id, "", channel.Id, 0)
		require.NoError(t, sortErr)
		require.NotEmpty(t, siblings)

		// Find pageT in siblings
		var updatedPageT *model.Post
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
		activeParent := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Active Parent",
			Props:     model.StringInterface{"title": "Active Parent"},
		}
		activeParent, err = ss.Post().Save(rctx, activeParent)
		require.NoError(t, err)

		activeSibling := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: activeParent.Id,
			Message:      "Active Sibling",
			Props:        model.StringInterface{"title": "Active Sibling"},
		}
		activeSibling, err = ss.Post().Save(rctx, activeSibling)
		require.NoError(t, err)

		deletedSibling := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: activeParent.Id,
			Message:      "Deleted Sibling",
			Props:        model.StringInterface{"title": "Deleted Sibling"},
		}
		deletedSibling, err = ss.Post().Save(rctx, deletedSibling)
		require.NoError(t, err)

		// Delete the sibling
		err = ss.Post().Delete(rctx, deletedSibling.Id, model.GetMillis(), userID)
		require.NoError(t, err)

		anotherSibling := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: activeParent.Id,
			Message:      "Another Sibling",
			Props:        model.StringInterface{"title": "Another Sibling"},
		}
		_, err = ss.Post().Save(rctx, anotherSibling)
		require.NoError(t, err)

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

func testMovePage(t *testing.T, rctx request.CTX, ss store.Store) {
	teamID := model.NewId()
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      teamID,
		DisplayName: "Move Page Test Channel",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()

	t.Run("moves page to new parent with index", func(t *testing.T) {
		// Create parent page
		parent := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Parent",
			Props:     model.StringInterface{"title": "Parent"},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		// Create existing child under parent
		existingChild := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Existing Child",
			Props:        model.StringInterface{"title": "Existing Child"},
		}
		_, err = ss.Post().Save(rctx, existingChild)
		require.NoError(t, err)

		// Create page to move (currently at root level)
		pageToMove := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Page to Move",
			Props:     model.StringInterface{"title": "Page to Move"},
		}
		pageToMove, err = ss.Post().Save(rctx, pageToMove)
		require.NoError(t, err)

		// Move page to parent at index 0 (before existing child)
		newParentID := parent.Id
		newIndex := int64(0)
		siblings, moveErr := ss.Page().MovePage(pageToMove.Id, channel.Id, &newParentID, &newIndex, pageToMove.UpdateAt)
		require.NoError(t, moveErr)
		require.NotNil(t, siblings)
		require.Len(t, siblings, 2)

		// Verify page is now first among siblings (lower sort order)
		var movedPage, otherChild *model.Post
		for _, p := range siblings {
			if p.Id == pageToMove.Id {
				movedPage = p
			} else {
				otherChild = p
			}
		}
		require.NotNil(t, movedPage)
		require.NotNil(t, otherChild)
		require.Less(t, movedPage.GetPageSortOrder(), otherChild.GetPageSortOrder())

		// Verify parent was updated
		updatedPage, getErr := ss.Post().GetSingle(rctx, pageToMove.Id, false)
		require.NoError(t, getErr)
		require.Equal(t, parent.Id, updatedPage.PageParentId)
	})

	t.Run("reorders page within same parent (no parent change)", func(t *testing.T) {
		parent := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Reorder Parent",
			Props:     model.StringInterface{"title": "Reorder Parent"},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		// Create 3 children
		child1 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Child 1",
			Props:        model.StringInterface{"title": "Child 1"},
		}
		child1, _ = ss.Post().Save(rctx, child1)
		time.Sleep(2 * time.Millisecond)

		child2 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Child 2",
			Props:        model.StringInterface{"title": "Child 2"},
		}
		_, _ = ss.Post().Save(rctx, child2)
		time.Sleep(2 * time.Millisecond)

		child3 := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Child 3",
			Props:        model.StringInterface{"title": "Child 3"},
		}
		_, _ = ss.Post().Save(rctx, child3)

		// Move child1 to index 2 (last) - only reorder, no parent change
		newIndex := int64(2)
		siblings, moveErr := ss.Page().MovePage(child1.Id, channel.Id, nil, &newIndex, child1.UpdateAt)
		require.NoError(t, moveErr)
		require.Len(t, siblings, 3)

		// Sort by page_sort_order
		sortedSiblings := make([]*model.Post, len(siblings))
		copy(sortedSiblings, siblings)
		for i := 0; i < len(sortedSiblings)-1; i++ {
			for j := i + 1; j < len(sortedSiblings); j++ {
				if sortedSiblings[i].GetPageSortOrder() > sortedSiblings[j].GetPageSortOrder() {
					sortedSiblings[i], sortedSiblings[j] = sortedSiblings[j], sortedSiblings[i]
				}
			}
		}

		// New order should be: Child 2, Child 3, Child 1
		require.Equal(t, "Child 2", sortedSiblings[0].Props["title"])
		require.Equal(t, "Child 3", sortedSiblings[1].Props["title"])
		require.Equal(t, "Child 1", sortedSiblings[2].Props["title"])
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
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Concurrent Page",
			Props:     model.StringInterface{"title": "Concurrent Page"},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

		// Use a stale UpdateAt value (simulating concurrent modification)
		staleUpdateAt := page.UpdateAt - 1000
		newParentID := ""
		_, moveErr := ss.Page().MovePage(page.Id, channel.Id, &newParentID, nil, staleUpdateAt)
		require.Error(t, moveErr)

		var nfErr *store.ErrNotFound
		require.True(t, errors.As(moveErr, &nfErr), "expected ErrNotFound for optimistic lock failure")
	})

	t.Run("returns error when creating cycle", func(t *testing.T) {
		// Create parent -> child hierarchy
		parent := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "Cycle Parent",
			Props:     model.StringInterface{"title": "Cycle Parent"},
		}
		parent, err = ss.Post().Save(rctx, parent)
		require.NoError(t, err)

		child := &model.Post{
			ChannelId:    channel.Id,
			UserId:       userID,
			Type:         model.PostTypePage,
			PageParentId: parent.Id,
			Message:      "Cycle Child",
			Props:        model.StringInterface{"title": "Cycle Child"},
		}
		child, err = ss.Post().Save(rctx, child)
		require.NoError(t, err)

		// Try to move parent under child (would create cycle)
		newParentID := child.Id
		_, moveErr := ss.Page().MovePage(parent.Id, channel.Id, &newParentID, nil, parent.UpdateAt)
		require.Error(t, moveErr)

		var invErr *store.ErrInvalidInput
		require.True(t, errors.As(moveErr, &invErr), "expected ErrInvalidInput for cycle detection")
	})

	t.Run("returns nil siblings when no index provided and parent unchanged", func(t *testing.T) {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Type:      model.PostTypePage,
			Message:   "No-op Page",
			Props:     model.StringInterface{"title": "No-op Page"},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)

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
