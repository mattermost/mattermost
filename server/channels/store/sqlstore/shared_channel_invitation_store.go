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

func pendingSentInvitationFilter(channelID, remoteID string) model.SharedChannelInvitationFilterOpts {
	return model.SharedChannelInvitationFilterOpts{
		ChannelId: channelID,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusPending,
	}
}

func (s SqlSharedChannelInvitationStore) getPendingSentFromMaster(channelID, remoteID string) (*model.SharedChannelInvitation, error) {
	invitations, err := s.GetAllFromMaster(pendingSentInvitationFilter(channelID, remoteID), 0, 1)
	if err != nil {
		return nil, err
	}
	if len(invitations) == 0 {
		return nil, nil
	}
	return invitations[0], nil
}

func (s SqlSharedChannelInvitationStore) EnsurePendingSent(channelID, remoteID, creatorID string) (*model.SharedChannelInvitation, error) {
	inv := &model.SharedChannelInvitation{
		ChannelId: channelID,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: creatorID,
	}
	saved, err := s.Save(inv)
	if err == nil {
		return saved, nil
	}
	if !IsUniqueConstraintError(errors.Cause(err), []string{"idx_sharedchannelinvitations_pending_sent_unique"}) {
		return nil, err
	}
	existing, getErr := s.getPendingSentFromMaster(channelID, remoteID)
	if getErr != nil {
		return nil, getErr
	}
	if existing == nil {
		return nil, errors.New("failed to get pending sent SharedChannelInvitation after unique constraint conflict")
	}
	return existing, nil
}

func (s SqlSharedChannelInvitationStore) Save(invitation *model.SharedChannelInvitation) (*model.SharedChannelInvitation, error) {
	invitation.PreSave()
	invitation.ErrMsg = truncateSharedChannelInvitationErrMsg(invitation.ErrMsg)
	if err := invitation.IsValid(); err != nil {
		return nil, err
	}

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

func (s SqlSharedChannelInvitationStore) getInvitation(id string, fromMaster bool) (*model.SharedChannelInvitation, error) {
	query := s.getQueryBuilder().
		Select(sharedChannelInvitationColumns()...).
		From("SharedChannelInvitations").
		Where(sq.Eq{"Id": id})

	var invitation model.SharedChannelInvitation
	var err error
	if fromMaster {
		err = s.GetMaster().GetBuilder(&invitation, query)
	} else {
		err = s.GetReplica().GetBuilder(&invitation, query)
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelInvitation", id)
		}
		return nil, errors.Wrap(err, "failed to get SharedChannelInvitation")
	}
	return &invitation, nil
}

func (s SqlSharedChannelInvitationStore) Get(id string) (*model.SharedChannelInvitation, error) {
	return s.getInvitation(id, false)
}

func (s SqlSharedChannelInvitationStore) GetFromMaster(id string) (*model.SharedChannelInvitation, error) {
	return s.getInvitation(id, true)
}

func (s SqlSharedChannelInvitationStore) getAll(opts model.SharedChannelInvitationFilterOpts, offset, limit int, fromMaster bool) ([]*model.SharedChannelInvitation, error) {
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
	var err error
	if fromMaster {
		err = s.GetMaster().SelectBuilder(&invitations, query)
	} else {
		err = s.GetReplica().SelectBuilder(&invitations, query)
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to list SharedChannelInvitations")
	}
	return invitations, nil
}

func (s SqlSharedChannelInvitationStore) GetAll(opts model.SharedChannelInvitationFilterOpts, offset, limit int) ([]*model.SharedChannelInvitation, error) {
	return s.getAll(opts, offset, limit, false)
}

func (s SqlSharedChannelInvitationStore) GetAllFromMaster(opts model.SharedChannelInvitationFilterOpts, offset, limit int) ([]*model.SharedChannelInvitation, error) {
	return s.getAll(opts, offset, limit, true)
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
	return s.getInvitation(id, true)
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

func (s SqlSharedChannelInvitationStore) DeletePendingByChannelIdAndRemoteId(channelID, remoteID string) error {
	query := s.getQueryBuilder().
		Delete("SharedChannelInvitations").
		Where(sq.Eq{
			"ChannelId": channelID,
			"RemoteId":  remoteID,
			"Status":    model.SharedChannelInvitationStatusPending,
		})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete pending SharedChannelInvitations by channel and remote")
	}
	return nil
}

func (s SqlSharedChannelInvitationStore) DeleteByRemoteId(remoteID string) error {
	query := s.getQueryBuilder().
		Delete("SharedChannelInvitations").
		Where(sq.Eq{"RemoteId": remoteID})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete SharedChannelInvitations by remote")
	}
	return nil
}
