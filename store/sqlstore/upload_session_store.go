// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	sq "github.com/Masterminds/squirrel"
)

type SqlUploadSessionStore struct {
	SqlStore
}

func newSqlUploadSessionStore(sqlStore SqlStore) store.UploadSessionStore {
	s := &SqlUploadSessionStore{
		SqlStore: sqlStore,
	}
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.UploadSession{}, "UploadSessions").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Filename").SetMaxSize(256)
		table.ColMap("Path").SetMaxSize(512)
	}
	return s
}

func (us SqlUploadSessionStore) createIndexesIfNotExists() {
	us.CreateIndexIfNotExists("idx_uploadsessions_create_at", "UploadSessions", "CreateAt")
	us.CreateIndexIfNotExists("idx_uploadsessions_user_id", "UploadSessions", "UserId")
}

func (us SqlUploadSessionStore) Save(session *model.UploadSession) (*model.UploadSession, error) {
	if session == nil {
		return nil, errors.New("SqlUploadSessionStore.Save: session should not be nil")
	}
	session.PreSave()
	if err := session.IsValid(); err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Save: validation failed")
	}
	if err := us.GetMaster().Insert(session); err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Save: failed to insert")
	}
	return session, nil
}

func (us SqlUploadSessionStore) Update(session *model.UploadSession) error {
	if session == nil {
		return errors.New("SqlUploadSessionStore.Update: session should not be nil")
	}
	if err := session.IsValid(); err != nil {
		return errors.Wrap(err, "SqlUploadSessionStore.Update: validation failed")
	}
	if _, err := us.GetMaster().Update(session); err != nil {
		return errors.Wrap(err, "SqlUploadSessionStore.Update: failed to insert")
	}
	return nil
}

func (us SqlUploadSessionStore) Get(id string) (*model.UploadSession, error) {
	if !model.IsValidId(id) {
		return nil, errors.New("SqlUploadSessionStore.Get: id is not valid")
	}
	query := us.getQueryBuilder().
		Select("*").
		From("UploadSessions").
		Where(sq.Eq{"Id": id})
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Get: failed to build query")
	}
	var session model.UploadSession
	if err := us.GetReplica().SelectOne(&session, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Get: failed to select")
	}
	return &session, nil
}

func (us SqlUploadSessionStore) GetForUser(userId string) ([]*model.UploadSession, error) {
	if !model.IsValidId(userId) {
		return nil, errors.New("SqlUploadSessionStore.GetForUser: userId is not valid")
	}
	query := us.getQueryBuilder().
		Select("*").
		From("UploadSessions").
		Where(sq.Eq{"UserId": userId}).
		OrderBy("CreateAt ASC")
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.GetForUser: failed to build query")
	}
	var sessions []*model.UploadSession
	if _, err := us.GetReplica().Select(&sessions, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.GetForUser: failed to select")
	}
	return sessions, nil
}

func (us SqlUploadSessionStore) Delete(id string) error {
	if !model.IsValidId(id) {
		return errors.New("SqlUploadSessionStore.Delete: id is not valid")
	}
	return nil
}
