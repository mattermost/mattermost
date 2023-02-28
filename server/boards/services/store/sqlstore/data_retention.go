// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package sqlstore

import (
	"database/sql"
	"strings"
	"time"

	"github.com/pkg/errors"

	sq "github.com/Masterminds/squirrel"
	_ "github.com/lib/pq" // postgres driver

	"github.com/mattermost/mattermost-server/v6/boards/model"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

type RetentionTableDeletionInfo struct {
	Table         string
	PrimaryKeys   []string
	BoardIDColumn string
}

func (s *SQLStore) runDataRetention(db sq.BaseRunner, globalRetentionDate int64, batchSize int64) (int64, error) {
	s.logger.Info("Start Boards Data Retention",
		mlog.String("Global Retention Date", time.Unix(globalRetentionDate/1000, 0).String()),
		mlog.Int64("Raw Date", globalRetentionDate))
	deleteTables := []RetentionTableDeletionInfo{
		{
			Table:         "blocks",
			PrimaryKeys:   []string{"id"},
			BoardIDColumn: "board_id",
		},
		{
			Table:         "blocks_history",
			PrimaryKeys:   []string{"id"},
			BoardIDColumn: "board_id",
		},
		{
			Table:         "boards",
			PrimaryKeys:   []string{"id"},
			BoardIDColumn: "id",
		},
		{
			Table:         "boards_history",
			PrimaryKeys:   []string{"id"},
			BoardIDColumn: "id",
		},
		{
			Table:         "board_members",
			PrimaryKeys:   []string{"board_id"},
			BoardIDColumn: "board_id",
		},
		{
			Table:         "board_members_history",
			PrimaryKeys:   []string{"board_id"},
			BoardIDColumn: "board_id",
		},
		{
			Table:         "sharing",
			PrimaryKeys:   []string{"id"},
			BoardIDColumn: "id",
		},
		{
			Table:         "category_boards",
			PrimaryKeys:   []string{"id"},
			BoardIDColumn: "board_id",
		},
	}

	subBuilder := s.getQueryBuilder(db).
		Select("board_id, MAX(update_at) AS maxDate").
		From(s.tablePrefix + "blocks").
		GroupBy("board_id")

	subQuery, _, _ := subBuilder.ToSql()

	builder := s.getQueryBuilder(db).
		Select("id").
		From(s.tablePrefix + "boards").
		LeftJoin("( " + subQuery + " ) As subquery ON (subquery.board_id = id)").
		Where(sq.Lt{"maxDate": globalRetentionDate}).
		Where(sq.NotEq{"team_id": "0"}).
		Where(sq.Eq{"is_template": false})

	rows, err := builder.Query()
	if err != nil {
		s.logger.Error(`dataRetention subquery ERROR`, mlog.Err(err))
		return 0, err
	}
	defer s.CloseRows(rows)
	deleteIds, err := idsFromRows(rows)
	if err != nil {
		return 0, err
	}

	totalAffected := 0
	if len(deleteIds) > 0 {
		for _, table := range deleteTables {
			affected, err := s.genericRetentionPoliciesDeletion(db, table, deleteIds, batchSize)
			if err != nil {
				return int64(totalAffected), err
			}
			totalAffected += int(affected)
		}
	}
	s.logger.Info("Complete Boards Data Retention",
		mlog.Int("Total deletion ids", len(deleteIds)),
		mlog.Int("TotalAffected", totalAffected))
	return int64(totalAffected), nil
}

func idsFromRows(rows *sql.Rows) ([]string, error) {
	deleteIds := []string{}
	for rows.Next() {
		var boardID string
		err := rows.Scan(
			&boardID,
		)
		if err != nil {
			return nil, err
		}
		deleteIds = append(deleteIds, boardID)
	}
	return deleteIds, nil
}

// genericRetentionPoliciesDeletion actually executes the DELETE query
// using a sq.SelectBuilder which selects the rows to delete.
func (s *SQLStore) genericRetentionPoliciesDeletion(
	db sq.BaseRunner,
	info RetentionTableDeletionInfo,
	deleteIds []string,
	batchSize int64,
) (int64, error) {
	whereClause := info.BoardIDColumn + " IN ('" + strings.Join(deleteIds, "','") + "')"
	deleteQuery := s.getQueryBuilder(db).
		Delete(s.tablePrefix + info.Table).
		Where(whereClause)

	if batchSize > 0 {
		deleteQuery.Limit(uint64(batchSize))
		primaryKeysStr := "(" + strings.Join(info.PrimaryKeys, ",") + ")"
		if s.dbType != model.MysqlDBType {
			selectQuery := s.getQueryBuilder(db).
				Select(primaryKeysStr).
				From(s.tablePrefix + info.Table).
				Where(whereClause).
				Limit(uint64(batchSize))

			selectString, _, _ := selectQuery.ToSql()

			deleteQuery = s.getQueryBuilder(db).
				Delete(s.tablePrefix + info.Table).
				Where(primaryKeysStr + " IN (" + selectString + ")")
		}
	}

	var totalRowsAffected int64
	var batchRowsAffected int64
	for {
		result, err := deleteQuery.Exec()
		if err != nil {
			return 0, errors.Wrap(err, "failed to delete "+info.Table)
		}

		batchRowsAffected, err = result.RowsAffected()
		if err != nil {
			return 0, errors.Wrap(err, "failed to get rows affected for "+info.Table)
		}
		totalRowsAffected += batchRowsAffected
		if batchRowsAffected != batchSize {
			break
		}
	}
	return totalRowsAffected, nil
}
