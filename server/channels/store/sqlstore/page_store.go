// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPageStore struct {
	*SqlStore
}

func newSqlPageStore(sqlStore *SqlStore) store.PageStore {
	return &SqlPageStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPageStore) GetPageChildren(postID string, options model.GetPostsOptions) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select("p.*").
		From("Posts p").
		Where(sq.Eq{
			"p.PageParentId": postID,
			"p.Type":         model.PostTypePage,
			"p.DeleteAt":     0,
		}).
		OrderBy("p.CreateAt DESC")

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find children for post_id=%s", postID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) GetPageDescendants(postID string) (*model.PostList, error) {
	query := `
		WITH RECURSIVE descendants AS (
			SELECT Id, PageParentId
			FROM Posts WHERE Id = $1
			UNION ALL
			SELECT p.Id, p.PageParentId
			FROM Posts p
			INNER JOIN descendants d ON p.PageParentId = d.Id
			WHERE p.Type = 'page' AND p.DeleteAt = 0
		)
		SELECT p.Id, p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.IsPinned, p.UserId, p.ChannelId, p.RootId, p.OriginalId,
		       p.Message, p.Type, p.Props, p.Hashtags, p.Filenames, p.FileIds, p.HasReactions, p.RemoteId, p.PageParentId
		FROM descendants d
		INNER JOIN Posts p ON p.Id = d.Id
		WHERE d.Id != $1
		ORDER BY p.CreateAt
	`

	posts := []*model.Post{}
	if err := s.GetReplica().Select(&posts, query, postID); err != nil {
		return nil, errors.Wrapf(err, "failed to find descendants for post_id=%s", postID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) GetPageAncestors(postID string) (*model.PostList, error) {
	query := `
		WITH RECURSIVE ancestors AS (
			SELECT Id, PageParentId
			FROM Posts WHERE Id = $1
			UNION ALL
			SELECT p.Id, p.PageParentId
			FROM Posts p
			INNER JOIN ancestors a ON p.Id = a.PageParentId
			WHERE a.PageParentId IS NOT NULL AND a.PageParentId != '' AND p.Type = 'page' AND p.DeleteAt = 0
		)
		SELECT p.Id, p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.IsPinned, p.UserId, p.ChannelId, p.RootId, p.OriginalId,
		       p.Message, p.Type, p.Props, p.Hashtags, p.Filenames, p.FileIds, p.HasReactions, p.RemoteId, p.PageParentId
		FROM ancestors a
		INNER JOIN Posts p ON p.Id = a.Id
		WHERE a.Id != $1
		ORDER BY p.CreateAt
	`

	posts := []*model.Post{}
	if err := s.GetReplica().Select(&posts, query, postID); err != nil {
		return nil, errors.Wrapf(err, "failed to find ancestors for post_id=%s", postID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) GetChannelPages(channelID string) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select("p.*").
		From("Posts p").
		Where(sq.Eq{
			"p.ChannelId": channelID,
			"p.Type":      model.PostTypePage,
			"p.DeleteAt":  0,
		}).
		OrderBy("p.CreateAt ASC")

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find pages for channel_id=%s", channelID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) ChangePageParent(postID string, newParentID string) error {
	updateQuery := s.getQueryBuilder().
		Update("Posts").
		Set("PageParentId", newParentID).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": postID})

	result, err := s.GetMaster().ExecBuilder(updateQuery)
	if err != nil {
		return errors.Wrapf(err, "failed to update parent for post_id=%s", postID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("Post", postID)
	}

	return nil
}
