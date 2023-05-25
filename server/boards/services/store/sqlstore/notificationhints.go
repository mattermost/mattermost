// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

var notificationHintFields = []string{
	"block_type",
	"block_id",
	"modified_by_id",
	"create_at",
	"notify_at",
}

func valuesForNotificationHint(hint *model.NotificationHint) []interface{} {
	return []interface{}{
		hint.BlockType,
		hint.BlockID,
		hint.ModifiedByID,
		hint.CreateAt,
		hint.NotifyAt,
	}
}

func (s *SQLStore) notificationHintFromRows(rows *sql.Rows) ([]*model.NotificationHint, error) {
	hints := []*model.NotificationHint{}

	for rows.Next() {
		var hint model.NotificationHint
		err := rows.Scan(
			&hint.BlockType,
			&hint.BlockID,
			&hint.ModifiedByID,
			&hint.CreateAt,
			&hint.NotifyAt,
		)
		if err != nil {
			return nil, err
		}
		hints = append(hints, &hint)
	}
	return hints, nil
}

// upsertNotificationHint creates or updates a notification hint. When updating the `notify_at` is set
// to the current time plus `notifyFreq`.
func (s *SQLStore) upsertNotificationHint(db sq.BaseRunner, hint *model.NotificationHint, notifyFreq time.Duration) (*model.NotificationHint, error) {
	if err := hint.IsValid(); err != nil {
		return nil, err
	}

	hint.CreateAt = utils.GetMillis()

	notifyAt := utils.GetMillisForTime(time.Now().Add(notifyFreq))
	hint.NotifyAt = notifyAt

	query := s.getQueryBuilder(db).Insert(s.tablePrefix + "notification_hints").
		Columns(notificationHintFields...).
		Values(valuesForNotificationHint(hint)...)

	if s.dbType == model.MysqlDBType {
		query = query.Suffix("ON DUPLICATE KEY UPDATE notify_at = ?", notifyAt)
	} else {
		query = query.Suffix("ON CONFLICT (block_id) DO UPDATE SET notify_at = ?", notifyAt)
	}

	if _, err := query.Exec(); err != nil {
		s.logger.Error("Cannot upsert notification hint",
			mlog.String("block_id", hint.BlockID),
			mlog.Err(err),
		)
		return nil, err
	}
	return hint, nil
}

// deleteNotificationHint deletes the notification hint for the specified block.
func (s *SQLStore) deleteNotificationHint(db sq.BaseRunner, blockID string) error {
	query := s.getQueryBuilder(db).
		Delete(s.tablePrefix + "notification_hints").
		Where(sq.Eq{"block_id": blockID})

	result, err := query.Exec()
	if err != nil {
		return err
	}

	count, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if count == 0 {
		return model.NewErrNotFound("notification hint BlockID=" + blockID)
	}

	return nil
}

// getNotificationHint fetches the notification hint for the specified block.
func (s *SQLStore) getNotificationHint(db sq.BaseRunner, blockID string) (*model.NotificationHint, error) {
	query := s.getQueryBuilder(db).
		Select(notificationHintFields...).
		From(s.tablePrefix + "notification_hints").
		Where(sq.Eq{"block_id": blockID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("Cannot fetch notification hint",
			mlog.String("block_id", blockID),
			mlog.Err(err),
		)
		return nil, err
	}
	defer s.CloseRows(rows)

	hint, err := s.notificationHintFromRows(rows)
	if err != nil {
		s.logger.Error("Cannot get notification hint",
			mlog.String("block_id", blockID),
			mlog.Err(err),
		)
		return nil, err
	}
	if len(hint) == 0 {
		return nil, model.NewErrNotFound("notification hint BlockID=" + blockID)
	}
	return hint[0], nil
}

// getNextNotificationHint fetches the next scheduled notification hint. If remove is true
// then the hint is removed from the database as well, as if popping from a stack.
func (s *SQLStore) getNextNotificationHint(db sq.BaseRunner, remove bool) (*model.NotificationHint, error) {
	selectQuery := s.getQueryBuilder(db).
		Select(notificationHintFields...).
		From(s.tablePrefix + "notification_hints").
		OrderBy("notify_at").
		Limit(1)

	rows, err := selectQuery.Query()
	if err != nil {
		s.logger.Error("Cannot fetch next notification hint",
			mlog.Err(err),
		)
		return nil, err
	}
	defer s.CloseRows(rows)

	hints, err := s.notificationHintFromRows(rows)
	if err != nil {
		s.logger.Error("Cannot get next notification hint",
			mlog.Err(err),
		)
		return nil, err
	}
	if len(hints) == 0 {
		return nil, model.NewErrNotFound("next notification hint")
	}

	hint := hints[0]

	if remove {
		deleteQuery := s.getQueryBuilder(db).
			Delete(s.tablePrefix + "notification_hints").
			Where(sq.Eq{"block_id": hint.BlockID})

		result, err := deleteQuery.Exec()
		if err != nil {
			return nil, fmt.Errorf("cannot delete while getting next notification hint: %w", err)
		}
		rows, err := result.RowsAffected()
		if err != nil {
			return nil, fmt.Errorf("cannot verify delete while getting next notification hint: %w", err)
		}
		if rows == 0 {
			// another node likely has grabbed this hint for processing concurrently; let that node handle it
			// and we'll return an error here so we try again.
			return nil, model.NewErrNotFound("notification hint")
		}
	}

	return hint, nil
}
