// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPlatformNotificationStore struct {
	*SqlStore
}

func platformNotificationSliceColumns() []string {
	return []string{
		"Id",
		"UserId",
		"PostId",
		"ChannelId",
		"TeamId",
		"RecordedAt",
		"ReadAt",
		"ChannelDisplayName",
		"ContextLabel",
		"PermalinkUrl",
		"IsThreadReply",
		"IsMention",
		"IsDirectMessage",
		"SenderUserId",
		"ThreadRootId",
		"ReplyCount",
		"ParticipantUserIds",
		"PreviewBody",
	}
}

func platformNotificationToSlice(notification *model.PlatformNotification) []any {
	return []any{
		notification.Id,
		notification.UserId,
		notification.PostId,
		notification.ChannelId,
		notification.TeamId,
		notification.RecordedAt,
		notification.ReadAt,
		notification.ChannelDisplayName,
		notification.ContextLabel,
		notification.PermalinkUrl,
		notification.IsThreadReply,
		notification.IsMention,
		notification.IsDirectMessage,
		notification.SenderUserId,
		notification.ThreadRootId,
		notification.ReplyCount,
		model.ArrayToJSON(notification.ParticipantUserIds),
		notification.PreviewBody,
	}
}

func newSqlPlatformNotificationStore(sqlStore *SqlStore) store.PlatformNotificationStore {
	return &SqlPlatformNotificationStore{SqlStore: sqlStore}
}

func (s *SqlPlatformNotificationStore) Upsert(notification *model.PlatformNotification) (*model.PlatformNotification, error) {
	notification.PreSave()
	if err := notification.IsValid(); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().Insert("UserPlatformNotifications").
		Columns(platformNotificationSliceColumns()...).
		Values(platformNotificationToSlice(notification)...).
		SuffixExpr(sq.Expr(`ON CONFLICT (UserId, Id) DO UPDATE SET
			PostId = EXCLUDED.PostId,
			ChannelId = EXCLUDED.ChannelId,
			TeamId = EXCLUDED.TeamId,
			RecordedAt = EXCLUDED.RecordedAt,
			ReadAt = EXCLUDED.ReadAt,
			ChannelDisplayName = EXCLUDED.ChannelDisplayName,
			ContextLabel = EXCLUDED.ContextLabel,
			PermalinkUrl = EXCLUDED.PermalinkUrl,
			IsThreadReply = EXCLUDED.IsThreadReply,
			IsMention = EXCLUDED.IsMention,
			IsDirectMessage = EXCLUDED.IsDirectMessage,
			SenderUserId = EXCLUDED.SenderUserId,
			ThreadRootId = EXCLUDED.ThreadRootId,
			ReplyCount = EXCLUDED.ReplyCount,
			ParticipantUserIds = EXCLUDED.ParticipantUserIds,
			PreviewBody = EXCLUDED.PreviewBody`))

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "failed to upsert platform notification")
	}

	if err := s.trimToMaxPerUser(notification.UserId); err != nil {
		return nil, err
	}

	return notification, nil
}

func (s *SqlPlatformNotificationStore) ReplaceAllForUser(userID string, notifications []*model.PlatformNotification) error {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	deleteBuilder := s.getQueryBuilder().
		Delete("UserPlatformNotifications").
		Where(sq.Eq{"UserId": userID})
	if _, err = transaction.ExecBuilder(deleteBuilder); err != nil {
		return errors.Wrap(err, "failed to delete platform notifications for user")
	}

	if len(notifications) > model.PlatformNotificationMaxPerUser {
		notifications = notifications[:model.PlatformNotificationMaxPerUser]
	}

	for _, notification := range notifications {
		notification.UserId = userID
		notification.PreSave()
		if appErr := notification.IsValid(); appErr != nil {
			return appErr
		}

		insertBuilder := s.getQueryBuilder().Insert("UserPlatformNotifications").
			Columns(platformNotificationSliceColumns()...).
			Values(platformNotificationToSlice(notification)...)
		if _, err = transaction.ExecBuilder(insertBuilder); err != nil {
			return errors.Wrap(err, "failed to insert platform notification")
		}
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlPlatformNotificationStore) GetForUser(userID string) ([]*model.PlatformNotification, error) {
	query := s.getQueryBuilder().
		Select(platformNotificationSliceColumns()...).
		From("UserPlatformNotifications").
		Where(sq.Eq{"UserId": userID}).
		OrderBy("RecordedAt DESC").
		Limit(uint64(model.PlatformNotificationMaxPerUser))

	var notifications []*model.PlatformNotification
	if err := s.GetReplica().SelectBuilder(&notifications, query); err != nil {
		return nil, errors.Wrap(err, "failed to get platform notifications for user")
	}

	return notifications, nil
}

func (s *SqlPlatformNotificationStore) Delete(userID, id string) error {
	builder := s.getQueryBuilder().
		Delete("UserPlatformNotifications").
		Where(sq.Eq{"UserId": userID, "Id": id})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "failed to delete platform notification")
	}

	return nil
}

func (s *SqlPlatformNotificationStore) DeleteAllForUser(userID string) error {
	builder := s.getQueryBuilder().
		Delete("UserPlatformNotifications").
		Where(sq.Eq{"UserId": userID})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "failed to delete platform notifications for user")
	}

	return nil
}

func (s *SqlPlatformNotificationStore) PermanentDeleteByUser(userID string) error {
	return s.DeleteAllForUser(userID)
}

func (s *SqlPlatformNotificationStore) trimToMaxPerUser(userID string) error {
	query, args, err := s.getQueryBuilder().
		Delete("UserPlatformNotifications").
		Where(sq.Expr(`UserId = ? AND Id IN (
			SELECT Id FROM UserPlatformNotifications
			WHERE UserId = ?
			ORDER BY RecordedAt DESC
			OFFSET ?
		)`, userID, userID, model.PlatformNotificationMaxPerUser)).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build trim platform notifications query")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to trim platform notifications for user")
	}

	return nil
}
