// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/pkg/errors"
)

type SqlThreadStore struct {
	SqlStore
}

func (s *SqlThreadStore) ClearCaches() {
}

func newSqlThreadStore(sqlStore SqlStore) store.ThreadStore {
	s := &SqlThreadStore{
		SqlStore: sqlStore,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Thread{}, "Threads").SetKeys(false, "PostId")
		table.ColMap("PostId").SetMaxSize(26)
	}

	return s
}

func threadSliceColumns() []string {
	return []string{"PostId", "LastReplyAt", "ReplyCount", "Who"}
}

func threadToSlice(thread *model.Thread) []interface{} {
	return []interface{}{
		thread.PostId,
		thread.LastReplyAt,
		thread.ReplyCount,
		thread.Who,
	}
}

func (s *SqlThreadStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_threads_last_reply_at", "Threads", "LastReplyAt")
	s.CreateIndexIfNotExists("idx_threads_post_id", "Threads", "PostId")
}

func (s *SqlThreadStore) Cleanup(postId, rootId, userId string) error {
	if len(rootId) > 0 {
		thread, err := s.Get(rootId)
		if err != nil {
			if err != sql.ErrNoRows {
				return errors.Wrap(err, "failed to get a thread")
			}
		}
		if thread != nil {
			thread.ReplyCount -= 1
			thread.Who = thread.Who.Remove(userId)
			if _, err = s.Update(thread); err != nil {
				return errors.Wrap(err, "failed to update thread")
			}
		}
	}
	_, err := s.GetMaster().Exec("DELETE FROM Threads WHERE PostId = :Id", map[string]interface{}{"Id": postId})
	if err != nil {
		return errors.Wrap(err, "failed to update Threads")
	}
	return nil
}

func (s *SqlThreadStore) UpdateFromPosts(transaction *gorp.Transaction, posts []*model.Post) error {
	postsByRoot := map[string][]*model.Post{}
	for _, post := range posts {
		// skip if post is not a part of a thread
		if len(post.RootId) == 0 {
			continue
		}
		postsByRoot[post.RootId] = append(postsByRoot[post.RootId], post)
	}
	now := model.GetMillis()
	for rootId, posts := range postsByRoot {
		var thread model.Thread
		if err := transaction.SelectOne(&thread, "SELECT * from Threads WHERE PostId=:PostId", map[string]interface{}{"PostId": rootId}); err != nil {
			if err != sql.ErrNoRows {
				return err
			}
			// calculate participants
			var participants model.StringArray
			if _, err := transaction.Select(&participants, "SELECT DISTINCT UserId FROM Posts WHERE RootId=:RootId", map[string]interface{}{"RootId": rootId}); err != nil {
				return err
			}
			// calculate reply count
			count, err := transaction.SelectInt("SELECT COUNT(Id) FROM Posts WHERE RootId=:RootId", map[string]interface{}{"RootId": rootId})
			if err != nil {
				return err
			}
			// no metadata entry, create one
			thread = model.Thread{
				PostId:      rootId,
				ReplyCount:  count,
				LastReplyAt: now,
				Who:         participants,
			}
			if err := transaction.Insert(&thread); err != nil {
				return err
			}
		} else {
			for _, post := range posts {
				// metadata exists, update it
				thread.LastReplyAt = now
				thread.ReplyCount += 1
				if !thread.Who.Contains(post.UserId) {
					thread.Who = append(thread.Who, post.UserId)
				}
			}
			if _, err := transaction.Update(&thread); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *SqlThreadStore) SaveMultiple(threads []*model.Thread) ([]*model.Thread, int, error) {
	builder := s.getQueryBuilder().Insert("Threads").Columns(threadSliceColumns()...)
	for _, thread := range threads {
		builder = builder.Values(threadToSlice(thread)...)
	}
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, -1, errors.Wrap(err, "thread_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return nil, -1, errors.Wrap(err, "failed to save Post")
	}

	return threads, -1, nil
}

func (s *SqlThreadStore) Save(thread *model.Thread) (*model.Thread, error) {
	threads, _, err := s.SaveMultiple([]*model.Thread{thread})
	if err != nil {
		return nil, err
	}
	return threads[0], nil
}

func (s *SqlThreadStore) Update(thread *model.Thread) (*model.Thread, error) {
	if _, err := s.GetMaster().Update(thread); err != nil {
		return nil, errors.Wrapf(err, "failed to update thread with id=%s", thread.PostId)
	}

	return thread, nil
}

func (s *SqlThreadStore) Get(id string) (*model.Thread, error) {
	var thread model.Thread
	err := s.GetReplica().SelectOne(&thread, "SELECT * from Threads WHERE PostId=:PostId", map[string]interface{}{"PostId": id})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", id)
		}

		return nil, errors.Wrapf(err, "failed to get thread with id=%s", id)
	}
	return &thread, nil
}

func (s *SqlThreadStore) Delete(threadId string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM Threads Where PostId = :Id", map[string]interface{}{"Id": threadId}); err != nil {
		return errors.Wrap(err, "failed to update threads")
	}

	return nil
}
