// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type SqlWebhookStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

func (s SqlWebhookStore) ClearCaches() {
}

func newSqlWebhookStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.WebhookStore {
	return &SqlWebhookStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}
}

func (s SqlWebhookStore) InvalidateWebhookCache(webhookId string) {
}

func (s SqlWebhookStore) SaveIncoming(webhook *model.IncomingWebhook) (*model.IncomingWebhook, error) {
	if webhook.Id != "" {
		return nil, store.NewErrInvalidInput("IncomingWebhook", "id", webhook.Id)
	}

	webhook.PreSave()
	if err := webhook.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO IncomingWebhooks
		(Id, CreateAt, UpdateAt, DeleteAt, UserId, ChannelId, TeamId, DisplayName, Description, Username, IconURL, ChannelLocked, Enabled)
		VALUES
		(:Id, :CreateAt, :UpdateAt, :DeleteAt, :UserId, :ChannelId, :TeamId, :DisplayName, :Description, :Username, :IconURL, :ChannelLocked, :Enabled)`, webhook); err != nil {
		return nil, errors.Wrapf(err, "failed to save IncomingWebhook with id=%s", webhook.Id)
	}

	return webhook, nil
}

func (s SqlWebhookStore) UpdateIncoming(hook *model.IncomingWebhook) (*model.IncomingWebhook, error) {
	hook.UpdateAt = model.GetMillis()

	_, err := s.GetMasterX().NamedExec(`UPDATE IncomingWebhooks SET
			CreateAt=:CreateAt, UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, ChannelId=:ChannelId, TeamId=:TeamId, DisplayName=:DisplayName,
			Description=:Description, Username=:Username, IconURL=:IconURL, ChannelLocked=:ChannelLocked, Enabled=:Enabled
			WHERE Id=:Id`, hook)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update IncomingWebhook with id=%s", hook.Id)
	}

	return hook, nil
}

func (s SqlWebhookStore) GetIncoming(id string, allowFromCache bool) (*model.IncomingWebhook, error) {
	var webhook model.IncomingWebhook
	if err := s.GetReplicaX().Get(&webhook, "SELECT * FROM IncomingWebhooks WHERE Id = ? AND DeleteAt = 0", id); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("IncomingWebhook", id)
		}
		return nil, errors.Wrapf(err, "failed to get IncomingWebhook with id=%s", id)
	}

	return &webhook, nil
}

func (s SqlWebhookStore) DeleteIncoming(webhookId string, time int64) error {
	_, err := s.GetMasterX().Exec("UPDATE IncomingWebhooks SET DeleteAt = ?, UpdateAt = ? WHERE Id = ?", time, time, webhookId)
	if err != nil {
		return errors.Wrapf(err, "failed to update IncomingWebhook with id=%s", webhookId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteIncomingByUser(userId string) error {
	_, err := s.GetMasterX().Exec("DELETE FROM IncomingWebhooks WHERE UserId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete IncomingWebhook with userId=%s", userId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteIncomingByChannel(channelId string) error {
	_, err := s.GetMasterX().Exec("DELETE FROM IncomingWebhooks WHERE ChannelId = ?", channelId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete IncomingWebhook with channelId=%s", channelId)
	}

	return nil
}

func (s SqlWebhookStore) GetIncomingList(offset, limit int) ([]*model.IncomingWebhook, error) {
	return s.GetIncomingListByUser("", offset, limit)
}

func (s SqlWebhookStore) GetIncomingListByUser(userId string, offset, limit int) ([]*model.IncomingWebhook, error) {
	webhooks := []*model.IncomingWebhook{}

	query := s.getQueryBuilder().
		Select("*").
		From("IncomingWebhooks").
		Where(sq.Eq{"DeleteAt": int(0)}).Limit(uint64(limit)).Offset(uint64(offset))

	if userId != "" {
		query = query.Where(sq.Eq{"UserId": userId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "incoming_webhook_tosql")
	}

	if err := s.GetReplicaX().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find IncomingWebhooks")
	}

	return webhooks, nil

}

func (s SqlWebhookStore) GetIncomingByTeamByUser(teamId string, userId string, offset, limit int) ([]*model.IncomingWebhook, error) {
	webhooks := []*model.IncomingWebhook{}

	query := s.getQueryBuilder().
		Select("*").
		From("IncomingWebhooks").
		Where(sq.And{
			sq.Eq{"TeamId": teamId},
			sq.Eq{"DeleteAt": int(0)},
		}).Limit(uint64(limit)).Offset(uint64(offset))

	if userId != "" {
		query = query.Where(sq.Eq{"UserId": userId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "incoming_webhook_tosql")
	}

	if err := s.GetReplicaX().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find IncomingWebhook with teamId=%s", teamId)
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetIncomingByTeam(teamId string, offset, limit int) ([]*model.IncomingWebhook, error) {
	return s.GetIncomingByTeamByUser(teamId, "", offset, limit)
}

func (s SqlWebhookStore) GetIncomingByChannel(channelId string) ([]*model.IncomingWebhook, error) {
	webhooks := []*model.IncomingWebhook{}

	if err := s.GetReplicaX().Select(&webhooks, "SELECT * FROM IncomingWebhooks WHERE ChannelId = ? AND DeleteAt = 0", channelId); err != nil {
		return nil, errors.Wrapf(err, "failed to find IncomingWebhooks with channelId=%s", channelId)
	}

	return webhooks, nil
}

func (s SqlWebhookStore) SaveOutgoing(webhook *model.OutgoingWebhook) (*model.OutgoingWebhook, error) {
	if webhook.Id != "" {
		return nil, store.NewErrInvalidInput("OutgoingWebhook", "id", webhook.Id)
	}

	webhook.PreSave()
	if err := webhook.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO OutgoingWebhooks
			(Id, Token, CreateAt, UpdateAt, DeleteAt, CreatorId, ChannelId, TeamId, TriggerWords, TriggerWhen,
			CallbackURLs, DisplayName, Description, ContentType, Username, IconURL)
			VALUES
			(:Id, :Token, :CreateAt, :UpdateAt, :DeleteAt, :CreatorId, :ChannelId, :TeamId, :TriggerWords, :TriggerWhen,
			:CallbackURLs, :DisplayName, :Description, :ContentType, :Username, :IconURL)`, webhook); err != nil {
		return nil, errors.Wrapf(err, "failed to save OutgoingWebhook with id=%s", webhook.Id)
	}

	return webhook, nil
}

func (s SqlWebhookStore) GetOutgoing(id string) (*model.OutgoingWebhook, error) {

	var webhook model.OutgoingWebhook

	if err := s.GetReplicaX().Get(&webhook, "SELECT * FROM OutgoingWebhooks WHERE Id = ? AND DeleteAt = 0", id); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("OutgoingWebhook", id)
		}

		return nil, errors.Wrapf(err, "failed to get OutgoingWebhook with id=%s", id)
	}

	return &webhook, nil
}

func (s SqlWebhookStore) GetOutgoingListByUser(userId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	webhooks := []*model.OutgoingWebhook{}

	query := s.getQueryBuilder().
		Select("*").
		From("OutgoingWebhooks").
		Where(sq.And{
			sq.Eq{"DeleteAt": int(0)},
		}).Limit(uint64(limit)).Offset(uint64(offset))

	if userId != "" {
		query = query.Where(sq.Eq{"CreatorId": userId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "outgoing_webhook_tosql")
	}

	if err := s.GetReplicaX().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find OutgoingWebhooks")
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetOutgoingList(offset, limit int) ([]*model.OutgoingWebhook, error) {
	return s.GetOutgoingListByUser("", offset, limit)

}

func (s SqlWebhookStore) GetOutgoingByChannelByUser(channelId string, userId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	webhooks := []*model.OutgoingWebhook{}

	query := s.getQueryBuilder().
		Select("*").
		From("OutgoingWebhooks").
		Where(sq.And{
			sq.Eq{"ChannelId": channelId},
			sq.Eq{"DeleteAt": int(0)},
		})

	if userId != "" {
		query = query.Where(sq.Eq{"CreatorId": userId})
	}
	if limit >= 0 && offset >= 0 {
		query = query.Limit(uint64(limit)).Offset(uint64(offset))
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "outgoing_webhook_tosql")
	}

	if err := s.GetReplicaX().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find OutgoingWebhooks")
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetOutgoingByChannel(channelId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	return s.GetOutgoingByChannelByUser(channelId, "", offset, limit)
}

func (s SqlWebhookStore) GetOutgoingByTeamByUser(teamId string, userId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	webhooks := []*model.OutgoingWebhook{}

	query := s.getQueryBuilder().
		Select("*").
		From("OutgoingWebhooks").
		Where(sq.And{
			sq.Eq{"TeamId": teamId},
			sq.Eq{"DeleteAt": int(0)},
		})

	if userId != "" {
		query = query.Where(sq.Eq{"CreatorId": userId})
	}
	if limit >= 0 && offset >= 0 {
		query = query.Limit(uint64(limit)).Offset(uint64(offset))
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "outgoing_webhook_tosql")
	}

	if err := s.GetReplicaX().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find OutgoingWebhooks")
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetOutgoingByTeam(teamId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	return s.GetOutgoingByTeamByUser(teamId, "", offset, limit)
}

func (s SqlWebhookStore) DeleteOutgoing(webhookId string, time int64) error {
	_, err := s.GetMasterX().Exec("Update OutgoingWebhooks SET DeleteAt = ?, UpdateAt = ? WHERE Id = ?", time, time, webhookId)
	if err != nil {
		return errors.Wrapf(err, "failed to update OutgoingWebhook with id=%s", webhookId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteOutgoingByUser(userId string) error {
	_, err := s.GetMasterX().Exec("DELETE FROM OutgoingWebhooks WHERE CreatorId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete OutgoingWebhook with creatorId=%s", userId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteOutgoingByChannel(channelId string) error {
	_, err := s.GetMasterX().Exec("DELETE FROM OutgoingWebhooks WHERE ChannelId = ?", channelId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete OutgoingWebhook with channelId=%s", channelId)
	}

	s.ClearCaches()

	return nil
}

func (s SqlWebhookStore) UpdateOutgoing(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, error) {
	hook.UpdateAt = model.GetMillis()

	_, err := s.GetMasterX().NamedExec(`UPDATE OutgoingWebhooks SET
			CreateAt = :CreateAt, UpdateAt = :UpdateAt, DeleteAt = :DeleteAt, Token = :Token, CreatorId = :CreatorId,
			ChannelId = :ChannelId, TeamId = :TeamId, TriggerWords = :TriggerWords, TriggerWhen = :TriggerWhen,
			CallbackURLs = :CallbackURLs, DisplayName = :DisplayName, Description = :Description,
			ContentType = :ContentType, Username = :Username, IconURL = :IconURL WHERE Id = :Id`, hook)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update OutgoingWebhook with id=%s", hook.Id)
	}

	return hook, nil
}

func (s SqlWebhookStore) AnalyticsIncomingCount(teamId string) (int64, error) {
	queryBuilder :=
		s.getQueryBuilder().
			Select("COUNT(*)").
			From("IncomingWebhooks").
			Where("DeleteAt = 0")

	if teamId != "" {
		queryBuilder = queryBuilder.Where("TeamId", teamId)
	}

	queryString, args, err := queryBuilder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "incoming_webhook_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count IncomingWebhooks")
	}
	return count, nil
}

func (s SqlWebhookStore) AnalyticsOutgoingCount(teamId string) (int64, error) {
	queryBuilder :=
		s.getQueryBuilder().
			Select("COUNT(*)").
			From("OutgoingWebhooks").
			Where("DeleteAt = 0")

	if teamId != "" {
		queryBuilder = queryBuilder.Where("TeamId", teamId)
	}

	queryString, args, err := queryBuilder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "outgoing_webhook_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count OutgoingWebhooks")
	}
	return count, nil
}
