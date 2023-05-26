// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

type SqlUploadSessionStore struct {
	*SqlStore
}

func newSqlUploadSessionStore(sqlStore *SqlStore) store.UploadSessionStore {
	return &SqlUploadSessionStore{
		SqlStore: sqlStore,
	}
}

func (us SqlUploadSessionStore) Save(session *model.UploadSession) (*model.UploadSession, error) {
	if session == nil {
		return nil, errors.New("SqlUploadSessionStore.Save: session should not be nil")
	}
	session.PreSave()
	if err := session.IsValid(); err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Save: validation failed")
	}
	query, args, err := us.getQueryBuilder().
		Insert("UploadSessions").
		Columns("Id", "Type", "CreateAt", "UserId", "ChannelId", "Filename", "Path", "FileSize", "FileOffset", "RemoteId", "ReqFileId").
		Values(session.Id, session.Type, session.CreateAt, session.UserId, session.ChannelId, session.Filename, session.Path, session.FileSize, session.FileOffset, session.RemoteId, session.ReqFileId).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Save: failed to build query")
	}
	if _, err := us.GetMasterX().Exec(query, args...); err != nil {
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
	query, args, err := us.getQueryBuilder().
		Update("UploadSessions").
		Set("Type", session.Type).
		Set("CreateAt", session.CreateAt).
		Set("UserId", session.UserId).
		Set("ChannelId", session.ChannelId).
		Set("Filename", session.Filename).
		Set("Path", session.Path).
		Set("FileSize", session.FileSize).
		Set("FileOffset", session.FileOffset).
		Set("RemoteId", session.RemoteId).
		Set("ReqFileId", session.ReqFileId).
		Where(sq.Eq{"Id": session.Id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "SqlUploadSessionStore.Update: failed to build query")
	}
	if _, err := us.GetMasterX().Exec(query, args...); err != nil {
		if err == sql.ErrNoRows {
			return store.NewErrNotFound("UploadSession", session.Id)
		}
		return errors.Wrapf(err, "SqlUploadSessionStore.Update: failed to update session with id=%s", session.Id)
	}
	return nil
}

func (us SqlUploadSessionStore) Get(ctx context.Context, id string) (*model.UploadSession, error) {
	if !model.IsValidId(id) {
		return nil, errors.New("SqlUploadSessionStore.Get: id is not valid")
	}
	query, args, err := us.getQueryBuilder().
		Select("*").
		From("UploadSessions").
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.Get: failed to build query")
	}
	var session model.UploadSession
	if err := us.DBXFromContext(ctx).Get(&session, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("UploadSession", id)
		}
		return nil, errors.Wrapf(err, "SqlUploadSessionStore.Get: failed to select session with id=%s", id)
	}
	return &session, nil
}

func (us SqlUploadSessionStore) GetForUser(userId string) ([]*model.UploadSession, error) {
	query, args, err := us.getQueryBuilder().
		Select("*").
		From("UploadSessions").
		Where(sq.Eq{"UserId": userId}).
		OrderBy("CreateAt ASC").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.GetForUser: failed to build query")
	}
	sessions := []*model.UploadSession{}
	if err := us.GetReplicaX().Select(&sessions, query, args...); err != nil {
		return nil, errors.Wrap(err, "SqlUploadSessionStore.GetForUser: failed to select")
	}
	return sessions, nil
}

func (us SqlUploadSessionStore) Delete(id string) error {
	if !model.IsValidId(id) {
		return errors.New("SqlUploadSessionStore.Delete: id is not valid")
	}

	query, args, err := us.getQueryBuilder().
		Delete("UploadSessions").
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "SqlUploadSessionStore.Delete: failed to build query")
	}

	if _, err := us.GetMasterX().Exec(query, args...); err != nil {
		return errors.Wrap(err, "SqlUploadSessionStore.Delete: failed to delete")
	}

	return nil
}
