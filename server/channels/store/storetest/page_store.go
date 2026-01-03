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

	t.Cleanup(func() {
		typesSQL := pagePostTypesSQL()
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM PropertyValues WHERE TargetType = 'post' AND TargetID IN (SELECT Id FROM Posts WHERE Type IN (%s))", typesSQL))
		_, _ = s.GetMaster().Exec("DELETE FROM PageContents")
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM Posts WHERE Type IN (%s)", typesSQL))
		// Clean up wikis and channels created by page tests
		_, _ = s.GetMaster().Exec("TRUNCATE Wikis CASCADE")
		_, _ = s.GetMaster().Exec("TRUNCATE Channels CASCADE")
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

		result, err := ss.Page().GetChannelPages(channel1.Id)
		require.NoError(t, err)
		require.Contains(t, result.Posts, activePage.Id)
		require.NotContains(t, result.Posts, deletedPage.Id, "should not include deleted pages")
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

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false)
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

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false)
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

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false)
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

		result, getErr := ss.Page().GetCommentsForPage(page.Id, true)
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

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false)
		require.NoError(t, getErr)
		require.NotNil(t, result)

		require.Len(t, result.Posts, 1, "should only return the page itself")
		require.Contains(t, result.Posts, page.Id)
	})

	t.Run("returns error for invalid pageID", func(t *testing.T) {
		result, getErr := ss.Page().GetCommentsForPage("", false)
		require.Error(t, getErr)
		require.Nil(t, result)

		var invalidErr *store.ErrInvalidInput
		require.ErrorAs(t, getErr, &invalidErr)
	})

	t.Run("returns empty list for non-existent page", func(t *testing.T) {
		nonExistentPageID := model.NewId()

		result, getErr := ss.Page().GetCommentsForPage(nonExistentPageID, false)
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

		result, getErr := ss.Page().GetCommentsForPage(page.Id, false)
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
