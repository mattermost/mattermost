// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"

	sq "github.com/mattermost/squirrel"
)

type SqlSharedChannelInvitationStore struct {
	*SqlStore
}

func newSqlSharedChannelInvitationStore(sqlStore *SqlStore) store.SharedChannelInvitationStore {
	return &SqlSharedChannelInvitationStore{
		SqlStore: sqlStore,
	}
}

func sharedChannelInvitationColumns() []string {
	return []string{
		"Id",
		"ChannelId",
		"RemoteId",
		"Direction",
		"Status",
		"ErrMsg",
		"CreatorId",
		"CreateAt",
		"UpdateAt",
	}
}

func truncateSharedChannelInvitationErrMsg(msg string) string {
	runes := []rune(msg)
	if len(runes) <= model.SharedChannelInvitationErrMsgMaxRunes {
		return msg
	}
	return string(runes[:model.SharedChannelInvitationErrMsgMaxRunes])
}

func (s SqlSharedChannelInvitationStore) Save(invitation *model.SharedChannelInvitation) (*model.SharedChannelInvitation, error) {
	invitation.PreSave()
	if err := invitation.IsValid(); err != nil {
		return nil, err
	}

	invitation.ErrMsg = truncateSharedChannelInvitationErrMsg(invitation.ErrMsg)

	query := s.getQueryBuilder().
		Insert("SharedChannelInvitations").
		Columns(sharedChannelInvitationColumns()...).
		Values(
			invitation.Id,
			invitation.ChannelId,
			invitation.RemoteId,
			invitation.Direction,
			invitation.Status,
			invitation.ErrMsg,
			invitation.CreatorId,
			invitation.CreateAt,
			invitation.UpdateAt,
		)

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to insert SharedChannelInvitation")
	}
	return invitation, nil
}

func (s SqlSharedChannelInvitationStore) Get(id string) (*model.SharedChannelInvitation, error) {
	query := s.getQueryBuilder().
		Select(sharedChannelInvitationColumns()...).
		From("SharedChannelInvitations").
		Where(sq.Eq{"Id": id})

	var invitation model.SharedChannelInvitation
	if err := s.GetReplica().GetBuilder(&invitation, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelInvitation", id)
		}
		return nil, errors.Wrap(err, "failed to get SharedChannelInvitation")
	}
	return &invitation, nil
}

func (s SqlSharedChannelInvitationStore) GetAll(opts model.SharedChannelInvitationFilterOpts, offset, limit int) ([]*model.SharedChannelInvitation, error) {
	query := s.getQueryBuilder().
		Select(sharedChannelInvitationColumns()...).
		From("SharedChannelInvitations").
		OrderBy("CreateAt DESC").
		Offset(uint64(offset)).
		Limit(uint64(limit))

	if opts.ChannelId != "" {
		query = query.Where(sq.Eq{"ChannelId": opts.ChannelId})
	}
	if opts.RemoteId != "" {
		query = query.Where(sq.Eq{"RemoteId": opts.RemoteId})
	}
	if opts.Direction != "" {
		query = query.Where(sq.Eq{"Direction": opts.Direction})
	}
	if opts.Status != "" {
		query = query.Where(sq.Eq{"Status": opts.Status})
	}

	var invitations []*model.SharedChannelInvitation
	if err := s.GetReplica().SelectBuilder(&invitations, query); err != nil {
		return nil, errors.Wrap(err, "failed to list SharedChannelInvitations")
	}
	return invitations, nil
}

func (s SqlSharedChannelInvitationStore) UpdateStatus(id, status, errMsg string) (*model.SharedChannelInvitation, error) {
	errMsg = truncateSharedChannelInvitationErrMsg(errMsg)
	now := model.GetMillis()

	query := s.getQueryBuilder().
		Update("SharedChannelInvitations").
		Set("Status", status).
		Set("ErrMsg", errMsg).
		Set("UpdateAt", now).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to update SharedChannelInvitation status")
	}
	return s.Get(id)
}

func (s SqlSharedChannelInvitationStore) Delete(id string) error {
	query := s.getQueryBuilder().
		Delete("SharedChannelInvitations").
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete SharedChannelInvitation")
	}
	return nil
}

func (s SqlSharedChannelInvitationStore) DeleteByChannelId(channelID string) error {
	query := s.getQueryBuilder().
		Delete("SharedChannelInvitations").
		Where(sq.Eq{"ChannelId": channelID})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete SharedChannelInvitations by channel")
	}
	return nil
}

func (s SqlSharedChannelInvitationStore) DeleteByChannelIdAndRemoteId(channelID, remoteID string) error {
	query := s.getQueryBuilder().
		Delete("SharedChannelInvitations").
		Where(sq.Eq{"ChannelId": channelID, "RemoteId": remoteID})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete SharedChannelInvitations by channel and remote")
	}
	return nil
}
