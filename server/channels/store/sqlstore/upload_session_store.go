// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"errors"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlUploadSessionStore struct {
	*SqlStore

	uploadSessionQuery sq.SelectBuilder
}

func newSqlUploadSessionStore(sqlStore *SqlStore) store.UploadSessionStore {
	s := &SqlUploadSessionStore{
		SqlStore: sqlStore,
	}

	s.uploadSessionQuery = s.getQueryBuilder().
		Select(
			"Id",
			"Type",
			"CreateAt",
			"UserId",
			"ChannelId",
			"Filename",
			"Path",
			"FileSize",
			"FileOffset",
			"RemoteId",
			"ReqFileId",
		).
		From("UploadSessions")

	return s
}

func (us SqlUploadSessionStore) Save(session *model.UploadSession) (*model.UploadSession, error) {
	if session == nil {
		return nil, errors.New("SqlUploadSessionStore.Save: session should not be nil")
	}
	session.PreSave()
	if err := session.IsValid(); err != nil {
		return nil, fmt.Errorf("SqlUploadSessionStore.Save: validation failed: %w", err)
	}
	query, args, err := us.getQueryBuilder().
		Insert("UploadSessions").
		Columns("Id", "Type", "CreateAt", "UserId", "ChannelId", "Filename", "Path", "FileSize", "FileOffset", "RemoteId", "ReqFileId").
		Values(session.Id, session.Type, session.CreateAt, session.UserId, session.ChannelId, session.Filename, session.Path, session.FileSize, session.FileOffset, session.RemoteId, session.ReqFileId).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("SqlUploadSessionStore.Save: failed to build query: %w", err)
	}
	if _, err := us.GetMaster().Exec(query, args...); err != nil {
		return nil, fmt.Errorf("SqlUploadSessionStore.Save: failed to insert: %w", err)
	}
	return session, nil
}

func (us SqlUploadSessionStore) Update(session *model.UploadSession) error {
	if session == nil {
		return errors.New("SqlUploadSessionStore.Update: session should not be nil")
	}
	if err := session.IsValid(); err != nil {
		return fmt.Errorf("SqlUploadSessionStore.Update: validation failed: %w", err)
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
		return fmt.Errorf("SqlUploadSessionStore.Update: failed to build query: %w", err)
	}
	if _, err := us.GetMaster().Exec(query, args...); err != nil {
		if err == sql.ErrNoRows {
			return store.NewErrNotFound("UploadSession", session.Id)
		}
		return fmt.Errorf("SqlUploadSessionStore.Update: failed to update session with id=%s: %w", session.Id, err)
	}
	return nil
}

func (us SqlUploadSessionStore) Get(rctx request.CTX, id string) (*model.UploadSession, error) {
	if !model.IsValidId(id) {
		return nil, errors.New("SqlUploadSessionStore.Get: id is not valid")
	}
	query, args, err := us.uploadSessionQuery.
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("SqlUploadSessionStore.Get: failed to build query: %w", err)
	}
	var session model.UploadSession
	if err := us.DBXFromContext(rctx.Context()).Get(&session, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("UploadSession", id)
		}
		return nil, fmt.Errorf("SqlUploadSessionStore.Get: failed to select session with id=%s: %w", id, err)
	}
	return &session, nil
}

func (us SqlUploadSessionStore) GetForUser(userId string) ([]*model.UploadSession, error) {
	query, args, err := us.uploadSessionQuery.
		Where(sq.Eq{"UserId": userId}).
		OrderBy("CreateAt ASC").
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("SqlUploadSessionStore.GetForUser: failed to build query: %w", err)
	}
	sessions := []*model.UploadSession{}
	if err := us.GetReplica().Select(&sessions, query, args...); err != nil {
		return nil, fmt.Errorf("SqlUploadSessionStore.GetForUser: failed to select: %w", err)
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
		return fmt.Errorf("SqlUploadSessionStore.Delete: failed to build query: %w", err)
	}

	if _, err := us.GetMaster().Exec(query, args...); err != nil {
		return fmt.Errorf("SqlUploadSessionStore.Delete: failed to delete: %w", err)
	}

	return nil
}
