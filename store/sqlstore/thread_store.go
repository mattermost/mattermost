// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/pkg/errors"

	sq "github.com/Masterminds/squirrel"
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
		table.ColMap("Participants").SetMaxSize(0)
	}

	return s
}

func threadSliceColumns() []string {
	return []string{"PostId", "LastReplyAt", "ReplyCount", "Participants"}
}

func threadToSlice(thread *model.Thread) []interface{} {
	return []interface{}{
		thread.PostId,
		thread.LastReplyAt,
		thread.ReplyCount,
		thread.Participants,
	}
}

func (s *SqlThreadStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_threads_last_reply_at", "Threads", "LastReplyAt")
	s.CreateIndexIfNotExists("idx_threads_post_id", "Threads", "PostId")
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
	query, args, _ := s.getQueryBuilder().Select("*").From("Threads").Where(sq.Eq{"PostId": id}).ToSql()
	err := s.GetReplica().SelectOne(&thread, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", id)
		}

		return nil, errors.Wrapf(err, "failed to get thread with id=%s", id)
	}
	return &thread, nil
}

func (s *SqlThreadStore) Delete(threadId string) error {
	query, args, _ := s.getQueryBuilder().Delete("Threads").Where(sq.Eq{"PostId": threadId}).ToSql()
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to update threads")
	}

	return nil
}
