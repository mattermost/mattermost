// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost/server/v8/boards/utils"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost/server/v8/boards/model"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func legacyBoardFields(prefix string) []string {
	// substitute new columns with `"\"\""` (empty string) so as to allow
	// row scan to continue to work with new models.

	fields := []string{
		"id",
		"team_id",
		"COALESCE(channel_id, '')",
		"COALESCE(created_by, '')",
		"modified_by",
		"type",
		"''", // substitute for minimum_role column.
		"title",
		"description",
		"icon",
		"show_description",
		"is_template",
		"template_version",
		"COALESCE(properties, '{}')",
		"COALESCE(card_properties, '[]')",
		"create_at",
		"update_at",
		"delete_at",
	}

	if prefix == "" {
		return fields
	}

	prefixedFields := make([]string, len(fields))
	for i, field := range fields {
		switch {
		case strings.HasPrefix(field, "COALESCE("):
			prefixedFields[i] = strings.Replace(field, "COALESCE(", "COALESCE("+prefix, 1)
		case field == "''":
			prefixedFields[i] = field
		default:
			prefixedFields[i] = prefix + field
		}
	}
	return prefixedFields
}

// legacyBlocksFromRows is the old getBlock version that still uses
// the old block model. This method is kept to enable the unique IDs
// data migration.
//
//nolint:unused
func (s *SQLStore) legacyBlocksFromRows(rows *sql.Rows) ([]*model.Block, error) {
	results := []*model.Block{}

	for rows.Next() {
		var block model.Block
		var fieldsJSON string
		var modifiedBy sql.NullString
		var insertAt string

		err := rows.Scan(
			&block.ID,
			&block.ParentID,
			&block.BoardID,
			&block.CreatedBy,
			&modifiedBy,
			&block.Schema,
			&block.Type,
			&block.Title,
			&fieldsJSON,
			&insertAt,
			&block.CreateAt,
			&block.UpdateAt,
			&block.DeleteAt,
			&block.WorkspaceID)
		if err != nil {
			// handle this error
			s.logger.Error(`ERROR blocksFromRows`, mlog.Err(err))

			return nil, err
		}

		if modifiedBy.Valid {
			block.ModifiedBy = modifiedBy.String
		}

		err = json.Unmarshal([]byte(fieldsJSON), &block.Fields)
		if err != nil {
			// handle this error
			s.logger.Error(`ERROR blocksFromRows fields`, mlog.Err(err))

			return nil, err
		}

		results = append(results, &block)
	}

	return results, nil
}

// getLegacyBlock is the old getBlock version that still uses the old
// block model. This method is kept to enable the unique IDs data
// migration.
//
//nolint:unused
func (s *SQLStore) getLegacyBlock(db sq.BaseRunner, workspaceID string, blockID string) (*model.Block, error) {
	query := s.getQueryBuilder(db).
		Select(
			"id",
			"parent_id",
			"root_id",
			"created_by",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"insert_at",
			"create_at",
			"update_at",
			"delete_at",
			"COALESCE(workspace_id, '0')",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": blockID}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": workspaceID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlock ERROR`, mlog.Err(err))
		return nil, err
	}

	blocks, err := s.legacyBlocksFromRows(rows)
	if err != nil {
		return nil, err
	}

	if len(blocks) == 0 {
		return nil, nil
	}

	return blocks[0], nil
}

// insertLegacyBlock is the old insertBlock version that still uses
// the old block model. This method is kept to enable the unique IDs
// data migration.
//
//nolint:unused
func (s *SQLStore) insertLegacyBlock(db sq.BaseRunner, workspaceID string, block *model.Block, userID string) error {
	if block.BoardID == "" {
		return ErrEmptyBoardID{}
	}

	fieldsJSON, err := json.Marshal(block.Fields)
	if err != nil {
		return err
	}

	existingBlock, err := s.getLegacyBlock(db, workspaceID, block.ID)
	if err != nil {
		return err
	}

	block.UpdateAt = utils.GetMillis()
	block.ModifiedBy = userID

	insertQuery := s.getQueryBuilder(db).Insert("").
		Columns(
			"workspace_id",
			"id",
			"parent_id",
			"root_id",
			"created_by",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"fields",
			"create_at",
			"update_at",
			"delete_at",
		)

	insertQueryValues := map[string]interface{}{
		"workspace_id":          workspaceID,
		"id":                    block.ID,
		"parent_id":             block.ParentID,
		"root_id":               block.BoardID,
		s.escapeField("schema"): block.Schema,
		"type":                  block.Type,
		"title":                 block.Title,
		"fields":                fieldsJSON,
		"delete_at":             block.DeleteAt,
		"created_by":            block.CreatedBy,
		"modified_by":           block.ModifiedBy,
		"create_at":             block.CreateAt,
		"update_at":             block.UpdateAt,
	}

	if existingBlock != nil {
		// block with ID exists, so this is an update operation
		query := s.getQueryBuilder(db).Update(s.tablePrefix+"blocks").
			Where(sq.Eq{"id": block.ID}).
			Where(sq.Eq{"COALESCE(workspace_id, '0')": workspaceID}).
			Set("parent_id", block.ParentID).
			Set("root_id", block.BoardID).
			Set("modified_by", block.ModifiedBy).
			Set(s.escapeField("schema"), block.Schema).
			Set("type", block.Type).
			Set("title", block.Title).
			Set("fields", fieldsJSON).
			Set("update_at", block.UpdateAt).
			Set("delete_at", block.DeleteAt)

		if _, err := query.Exec(); err != nil {
			s.logger.Error(`InsertBlock error occurred while updating existing block`, mlog.String("blockID", block.ID), mlog.Err(err))
			return err
		}
	} else {
		block.CreatedBy = userID
		block.CreateAt = utils.GetMillis()

		insertQueryValues["created_by"] = block.CreatedBy
		insertQueryValues["create_at"] = block.CreateAt
		insertQueryValues["update_at"] = block.UpdateAt
		insertQueryValues["modified_by"] = block.ModifiedBy

		query := insertQuery.SetMap(insertQueryValues).Into(s.tablePrefix + "blocks")
		if _, err := query.Exec(); err != nil {
			return err
		}
	}

	// writing block history
	query := insertQuery.SetMap(insertQueryValues).Into(s.tablePrefix + "blocks_history")
	if _, err := query.Exec(); err != nil {
		return err
	}

	return nil
}

func (s *SQLStore) getLegacyBoardsByCondition(db sq.BaseRunner, conditions ...interface{}) ([]*model.Board, error) {
	return s.getBoardsFieldsByCondition(db, legacyBoardFields(""), conditions...)
}
