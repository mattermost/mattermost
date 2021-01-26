// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlWebhookStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

func (s SqlWebhookStore) ClearCaches() {
}

func newSqlWebhookStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.WebhookStore {
	s := &SqlWebhookStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.IncomingWebhook{}, "IncomingWebhooks").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("Description").SetMaxSize(500)
		table.ColMap("Username").SetMaxSize(255)
		table.ColMap("IconURL").SetMaxSize(1024)

		tableo := db.AddTableWithName(model.OutgoingWebhook{}, "OutgoingWebhooks").SetKeys(false, "Id")
		tableo.ColMap("Id").SetMaxSize(26)
		tableo.ColMap("Token").SetMaxSize(26)
		tableo.ColMap("CreatorId").SetMaxSize(26)
		tableo.ColMap("ChannelId").SetMaxSize(26)
		tableo.ColMap("TeamId").SetMaxSize(26)
		tableo.ColMap("TriggerWords").SetMaxSize(1024)
		tableo.ColMap("CallbackURLs").SetMaxSize(1024)
		tableo.ColMap("DisplayName").SetMaxSize(64)
		tableo.ColMap("Description").SetMaxSize(500)
		tableo.ColMap("ContentType").SetMaxSize(128)
		tableo.ColMap("TriggerWhen").SetMaxSize(1)
		tableo.ColMap("Username").SetMaxSize(64)
		tableo.ColMap("IconURL").SetMaxSize(1024)
	}

	return s
}

func (s SqlWebhookStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_incoming_webhook_user_id", "IncomingWebhooks", "UserId")
	s.CreateIndexIfNotExists("idx_incoming_webhook_team_id", "IncomingWebhooks", "TeamId")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_team_id", "OutgoingWebhooks", "TeamId")

	s.CreateIndexIfNotExists("idx_incoming_webhook_update_at", "IncomingWebhooks", "UpdateAt")
	s.CreateIndexIfNotExists("idx_incoming_webhook_create_at", "IncomingWebhooks", "CreateAt")
	s.CreateIndexIfNotExists("idx_incoming_webhook_delete_at", "IncomingWebhooks", "DeleteAt")

	s.CreateIndexIfNotExists("idx_outgoing_webhook_update_at", "OutgoingWebhooks", "UpdateAt")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_create_at", "OutgoingWebhooks", "CreateAt")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_delete_at", "OutgoingWebhooks", "DeleteAt")
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

	if err := s.GetMaster().Insert(webhook); err != nil {
		return nil, errors.Wrapf(err, "failed to save IncomingWebhook with id=%s", webhook.Id)
	}

	return webhook, nil

}

func (s SqlWebhookStore) UpdateIncoming(hook *model.IncomingWebhook) (*model.IncomingWebhook, error) {
	hook.UpdateAt = model.GetMillis()

	if _, err := s.GetMaster().Update(hook); err != nil {
		return nil, errors.Wrapf(err, "failed to update IncomingWebhook with id=%s", hook.Id)
	}
	return hook, nil
}

func (s SqlWebhookStore) GetIncoming(id string, allowFromCache bool) (*model.IncomingWebhook, error) {
	var webhook model.IncomingWebhook
	if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM IncomingWebhooks WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("IncomingWebhook", id)
		}
		return nil, errors.Wrapf(err, "failed to get IncomingWebhook with id=%s", id)
	}

	return &webhook, nil
}

func (s SqlWebhookStore) DeleteIncoming(webhookId string, time int64) error {
	_, err := s.GetMaster().Exec("Update IncomingWebhooks SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": webhookId})
	if err != nil {
		return errors.Wrapf(err, "failed to update IncomingWebhook with id=%s", webhookId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteIncomingByUser(userId string) error {
	_, err := s.GetMaster().Exec("DELETE FROM IncomingWebhooks WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return errors.Wrapf(err, "failed to delete IncomingWebhook with userId=%s", userId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteIncomingByChannel(channelId string) error {
	_, err := s.GetMaster().Exec("DELETE FROM IncomingWebhooks WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return errors.Wrapf(err, "failed to delete IncomingWebhook with channelId=%s", channelId)
	}

	return nil
}

func (s SqlWebhookStore) GetIncomingList(offset, limit int) ([]*model.IncomingWebhook, error) {
	return s.GetIncomingListByUser("", offset, limit)
}

func (s SqlWebhookStore) GetIncomingListByUser(userId string, offset, limit int) ([]*model.IncomingWebhook, error) {
	var webhooks []*model.IncomingWebhook

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

	if _, err := s.GetReplica().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find IncomingWebhooks")
	}

	return webhooks, nil

}

func (s SqlWebhookStore) GetIncomingByTeamByUser(teamId string, userId string, offset, limit int) ([]*model.IncomingWebhook, error) {
	var webhooks []*model.IncomingWebhook

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

	if _, err := s.GetReplica().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find IncomingWebhoook with teamId=%s", teamId)
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetIncomingByTeam(teamId string, offset, limit int) ([]*model.IncomingWebhook, error) {
	return s.GetIncomingByTeamByUser(teamId, "", offset, limit)
}

func (s SqlWebhookStore) GetIncomingByChannel(channelId string) ([]*model.IncomingWebhook, error) {
	var webhooks []*model.IncomingWebhook

	if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM IncomingWebhooks WHERE ChannelId = :ChannelId AND DeleteAt = 0", map[string]interface{}{"ChannelId": channelId}); err != nil {
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

	if err := s.GetMaster().Insert(webhook); err != nil {
		return nil, errors.Wrapf(err, "failed to save OutgoingWebhook with id=%s", webhook.Id)
	}

	return webhook, nil
}

func (s SqlWebhookStore) GetOutgoing(id string) (*model.OutgoingWebhook, error) {

	var webhook model.OutgoingWebhook

	if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM OutgoingWebhooks WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("OutgoingWebhook", id)
		}

		return nil, errors.Wrapf(err, "failed to get OutgoingWebhook with id=%s", id)
	}

	return &webhook, nil
}

func (s SqlWebhookStore) GetOutgoingListByUser(userId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	var webhooks []*model.OutgoingWebhook

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

	if _, err := s.GetReplica().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find OutgoingWebhooks")
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetOutgoingList(offset, limit int) ([]*model.OutgoingWebhook, error) {
	return s.GetOutgoingListByUser("", offset, limit)

}

func (s SqlWebhookStore) GetOutgoingByChannelByUser(channelId string, userId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	var webhooks []*model.OutgoingWebhook

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

	if _, err := s.GetReplica().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find OutgoingWebhooks")
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetOutgoingByChannel(channelId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	return s.GetOutgoingByChannelByUser(channelId, "", offset, limit)
}

func (s SqlWebhookStore) GetOutgoingByTeamByUser(teamId string, userId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	var webhooks []*model.OutgoingWebhook

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

	if _, err := s.GetReplica().Select(&webhooks, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find OutgoingWebhooks")
	}

	return webhooks, nil
}

func (s SqlWebhookStore) GetOutgoingByTeam(teamId string, offset, limit int) ([]*model.OutgoingWebhook, error) {
	return s.GetOutgoingByTeamByUser(teamId, "", offset, limit)
}

func (s SqlWebhookStore) DeleteOutgoing(webhookId string, time int64) error {
	_, err := s.GetMaster().Exec("Update OutgoingWebhooks SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": webhookId})
	if err != nil {
		return errors.Wrapf(err, "failed to update OutgoingWebhook with id=%s", webhookId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteOutgoingByUser(userId string) error {
	_, err := s.GetMaster().Exec("DELETE FROM OutgoingWebhooks WHERE CreatorId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return errors.Wrapf(err, "failed to delete OutgoingWebhook with creatorId=%s", userId)
	}

	return nil
}

func (s SqlWebhookStore) PermanentDeleteOutgoingByChannel(channelId string) error {
	_, err := s.GetMaster().Exec("DELETE FROM OutgoingWebhooks WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return errors.Wrapf(err, "failed to delete OutgoingWebhook with channelId=%s", channelId)
	}

	s.ClearCaches()

	return nil
}

func (s SqlWebhookStore) UpdateOutgoing(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, error) {
	hook.UpdateAt = model.GetMillis()

	if _, err := s.GetMaster().Update(hook); err != nil {
		return nil, errors.Wrapf(err, "failed to update OutgoingWebhook with id=%s", hook.Id)
	}

	return hook, nil
}

func (s SqlWebhookStore) AnalyticsIncomingCount(teamId string) (int64, error) {
	query :=
		`SELECT
			COUNT(*)
		FROM
			IncomingWebhooks
		WHERE
			DeleteAt = 0`

	if teamId != "" {
		query += " AND TeamId = :TeamId"
	}

	v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return 0, errors.Wrap(err, "failed to count IncomingWebhooks")
	}

	return v, nil
}

func (s SqlWebhookStore) AnalyticsOutgoingCount(teamId string) (int64, error) {
	query :=
		`SELECT
			COUNT(*)
		FROM
			OutgoingWebhooks
		WHERE
			DeleteAt = 0`

	if teamId != "" {
		query += " AND TeamId = :TeamId"
	}

	v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return 0, errors.Wrap(err, "failed to count OutgoingWebhooks")
	}

	return v, nil
}
