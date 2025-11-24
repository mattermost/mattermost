// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPageStore_Update_OptimisticLocking(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Test Channel",
			Name:        "zz" + model.NewId() + "b",
			Type:        model.ChannelTypeOpen,
		}
		_, err := ss.Channel().Save(rctx, channel, 1000)
		require.NoError(t, err)

		originalContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
		post := &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Props:     map[string]any{"title": "Original Title"},
		}

		createdPost, createErr := ss.Page().CreatePage(rctx, post, originalContent, "original content")
		require.NoError(t, createErr)
		require.NotNil(t, createdPost)

		time.Sleep(10 * time.Millisecond)

		baseUpdateAt := createdPost.UpdateAt

		updatedContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated by User 1"}]}]}`
		createdPost.Message = updatedContent
		createdPost.Props["title"] = "Updated Title by User 1"
		updatedPost1, err1 := ss.Page().Update(createdPost, baseUpdateAt, false)
		require.NoError(t, err1)
		require.NotNil(t, updatedPost1)
		assert.Equal(t, updatedContent, updatedPost1.Message)
		assert.Equal(t, "Updated Title by User 1", updatedPost1.Props["title"])

		updatedContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated by User 2"}]}]}`
		createdPost.Message = updatedContent2
		createdPost.Props["title"] = "Updated Title by User 2"
		_, err2 := ss.Page().Update(createdPost, baseUpdateAt, false)
		require.Error(t, err2)

		var conflictErr *store.ErrConflict
		require.ErrorAs(t, err2, &conflictErr)
	})
}

func TestPageStore_Update_DeletedPageReturns404(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		sqlStore := ss.(*SqlStore)

		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Test Channel",
			Name:        "zz" + model.NewId() + "b",
			Type:        model.ChannelTypeOpen,
		}
		_, err := ss.Channel().Save(rctx, channel, 1000)
		require.NoError(t, err)

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   "Original Title",
			Type:      model.PostTypePage,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			DeleteAt:  0,
		}

		query := sqlStore.getQueryBuilder().
			Insert("Posts").
			Columns(postSliceColumns()...).
			Values(postToSlice(post)...)

		queryStr, args, buildErr := query.ToSql()
		require.NoError(t, buildErr)

		_, execErr := sqlStore.GetMaster().Exec(queryStr, args...)
		require.NoError(t, execErr)

		baseUpdateAt := post.UpdateAt

		deleteQuery := sqlStore.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", model.GetMillis()).
			Where("Id = ?", post.Id)

		deleteSQL, deleteArgs, buildErr := deleteQuery.ToSql()
		require.NoError(t, buildErr)

		_, execErr = sqlStore.GetMaster().Exec(deleteSQL, deleteArgs...)
		require.NoError(t, execErr)

		post.Message = "Updated Title"
		_, err = ss.Page().Update(post, baseUpdateAt, false)
		require.Error(t, err)

		var notFoundErr *store.ErrNotFound
		require.ErrorAs(t, err, &notFoundErr)
	})
}

func TestPageStore_Update_NonExistentPageReturns404(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		post := &model.Post{
			Id:       model.NewId(),
			Message:  "Updated Title",
			Type:     model.PostTypePage,
			UpdateAt: model.GetMillis(),
		}

		_, err := ss.Page().Update(post, model.GetMillis(), false)
		require.Error(t, err)

		var notFoundErr *store.ErrNotFound
		require.ErrorAs(t, err, &notFoundErr)
	})
}

func TestPageStore_Update_RegularPostsUnaffected(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Test Channel",
			Name:        "zz" + model.NewId() + "b",
			Type:        model.ChannelTypeOpen,
		}
		_, err := ss.Channel().Save(rctx, channel, 1000)
		require.NoError(t, err)

		regularPost := &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Message:   "Regular message",
			Type:      model.PostTypeDefault,
		}

		createdPost, err := ss.Post().Save(rctx, regularPost)
		require.NoError(t, err)
		require.NotNil(t, createdPost)

		createdPost.Message = "Updated regular message"
		updatedPost, err := ss.Post().Update(rctx, createdPost, createdPost)
		require.NoError(t, err)
		require.NotNil(t, updatedPost)
		assert.Equal(t, "Updated regular message", updatedPost.Message)

		regularPostWithPageType := &model.Post{
			Id:       createdPost.Id,
			Message:  "Trying to update as page",
			Type:     model.PostTypePage,
			UpdateAt: model.GetMillis(),
		}

		_, err = ss.Page().Update(regularPostWithPageType, createdPost.UpdateAt, false)
		require.Error(t, err)

		var notFoundErr *store.ErrNotFound
		require.ErrorAs(t, err, &notFoundErr)
	})
}

func TestPageStore_GetPageAncestors_AfterChangeParent(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Test Channel",
			Name:        "zz" + model.NewId() + "b",
			Type:        model.ChannelTypeOpen,
		}
		_, err := ss.Channel().Save(rctx, channel, 1000)
		require.NoError(t, err)

		// Create parent page
		parentPost := &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Props:     map[string]any{"title": "Parent Page"},
		}
		parentPage, err := ss.Page().CreatePage(rctx, parentPost, `{"type":"doc"}`, "parent page")
		require.NoError(t, err)
		require.NotNil(t, parentPage)

		// Create child page WITHOUT a parent initially
		childPost := &model.Post{
			ChannelId: channel.Id,
			UserId:    model.NewId(),
			Type:      model.PostTypePage,
			Props:     map[string]any{"title": "Child Page"},
		}
		childPage, err := ss.Page().CreatePage(rctx, childPost, `{"type":"doc"}`, "child page")
		require.NoError(t, err)
		require.NotNil(t, childPage)

		// Verify child has no ancestors initially
		ancestorsBefore, err := ss.Page().GetPageAncestors(childPage.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestorsBefore)
		require.Len(t, ancestorsBefore.Posts, 0, "Child should have no ancestors initially")

		// NOW change the parent
		err = ss.Page().ChangePageParent(childPage.Id, parentPage.Id)
		require.NoError(t, err)

		// Verify the PageParentId was updated
		updatedChild, err := ss.Post().GetSingle(rctx, childPage.Id, false)
		require.NoError(t, err)
		require.Equal(t, parentPage.Id, updatedChild.PageParentId, "PageParentId should be updated")

		// NOW get ancestors - this should return the parent
		ancestorsAfter, err := ss.Page().GetPageAncestors(childPage.Id)
		require.NoError(t, err)
		require.NotNil(t, ancestorsAfter)
		require.Len(t, ancestorsAfter.Posts, 1, "Child should have 1 ancestor after parent change")
		require.Equal(t, parentPage.Id, ancestorsAfter.Order[0], "Ancestor should be the parent page")
	})
}
