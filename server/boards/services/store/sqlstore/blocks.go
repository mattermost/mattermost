// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v6/boards/utils"

	sq "github.com/Masterminds/squirrel"
	_ "github.com/lib/pq" // postgres driver

	"github.com/mattermost/mattermost-server/v6/boards/model"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	maxSearchDepth = 50
	descClause     = " DESC "
)

type ErrEmptyBoardID struct{}

func (re ErrEmptyBoardID) Error() string {
	return "boardID is empty"
}

type ErrLimitExceeded struct{ max int }

func (le ErrLimitExceeded) Error() string {
	return fmt.Sprintf("limit exceeded (max=%d)", le.max)
}

func (s *SQLStore) timestampToCharField(name string, as string) string {
	switch s.dbType {
	case model.MysqlDBType:
		return fmt.Sprintf("date_format(%s, '%%Y-%%m-%%d %%H:%%i:%%S') AS %s", name, as)
	case model.PostgresDBType:
		return fmt.Sprintf("to_char(%s, 'YYYY-MM-DD HH:MI:SS.MS') AS %s", name, as)
	default:
		return fmt.Sprintf("%s AS %s", name, as)
	}
}

func (s *SQLStore) blockFields(tableAlias string) []string {
	if tableAlias != "" && !strings.HasSuffix(tableAlias, ".") {
		tableAlias += "."
	}

	return []string{
		tableAlias + "id",
		tableAlias + "parent_id",
		tableAlias + "created_by",
		tableAlias + "modified_by",
		tableAlias + s.escapeField("schema"),
		tableAlias + "type",
		tableAlias + "title",
		"COALESCE(" + tableAlias + "fields, '{}')",
		s.timestampToCharField(tableAlias+"insert_at", "insertAt"),
		tableAlias + "create_at",
		tableAlias + "update_at",
		tableAlias + "delete_at",
		"COALESCE(" + tableAlias + "board_id, '0')",
	}
}

func (s *SQLStore) getBlocks(db sq.BaseRunner, opts model.QueryBlocksOptions) ([]*model.Block, error) {
	query := s.getQueryBuilder(db).
		Select(s.blockFields("")...).
		From(s.tablePrefix + "blocks")

	if opts.BoardID != "" {
		query = query.Where(sq.Eq{"board_id": opts.BoardID})
	}

	if opts.ParentID != "" {
		query = query.Where(sq.Eq{"parent_id": opts.ParentID})
	}

	if opts.BlockType != "" && opts.BlockType != model.TypeUnknown {
		query = query.Where(sq.Eq{"type": opts.BlockType})
	}

	if opts.Page != 0 {
		query = query.Offset(uint64(opts.Page * opts.PerPage))
	}

	if opts.PerPage > 0 {
		query = query.Limit(uint64(opts.PerPage))
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getBlocks ERROR`, mlog.Err(err))

		return nil, err
	}
	defer s.CloseRows(rows)

	return s.blocksFromRows(rows)
}

func (s *SQLStore) getBlocksWithParentAndType(db sq.BaseRunner, boardID, parentID string, blockType string) ([]*model.Block, error) {
	opts := model.QueryBlocksOptions{
		BoardID:   boardID,
		ParentID:  parentID,
		BlockType: model.BlockType(blockType),
	}
	return s.getBlocks(db, opts)
}

func (s *SQLStore) getBlocksWithParent(db sq.BaseRunner, boardID, parentID string) ([]*model.Block, error) {
	opts := model.QueryBlocksOptions{
		BoardID:  boardID,
		ParentID: parentID,
	}
	return s.getBlocks(db, opts)
}

func (s *SQLStore) getBlocksByIDs(db sq.BaseRunner, ids []string) ([]*model.Block, error) {
	query := s.getQueryBuilder(db).
		Select(s.blockFields("")...).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": ids})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlocksByIDs ERROR`, mlog.Err(err))

		return nil, err
	}
	defer s.CloseRows(rows)

	blocks, err := s.blocksFromRows(rows)
	if err != nil {
		return nil, err
	}

	if len(blocks) != len(ids) {
		return blocks, model.NewErrNotAllFound("block", ids)
	}

	return blocks, nil
}

func (s *SQLStore) getBlocksWithType(db sq.BaseRunner, boardID, blockType string) ([]*model.Block, error) {
	opts := model.QueryBlocksOptions{
		BoardID:   boardID,
		BlockType: model.BlockType(blockType),
	}
	return s.getBlocks(db, opts)
}

// getSubTree2 returns blocks within 2 levels of the given blockID.
func (s *SQLStore) getSubTree2(db sq.BaseRunner, boardID string, blockID string, opts model.QuerySubtreeOptions) ([]*model.Block, error) {
	query := s.getQueryBuilder(db).
		Select(s.blockFields("")...).
		From(s.tablePrefix + "blocks").
		Where(sq.Or{sq.Eq{"id": blockID}, sq.Eq{"parent_id": blockID}}).
		Where(sq.Eq{"board_id": boardID}).
		OrderBy("insert_at, update_at")

	if opts.BeforeUpdateAt != 0 {
		query = query.Where(sq.LtOrEq{"update_at": opts.BeforeUpdateAt})
	}

	if opts.AfterUpdateAt != 0 {
		query = query.Where(sq.GtOrEq{"update_at": opts.AfterUpdateAt})
	}

	if opts.Limit != 0 {
		query = query.Limit(opts.Limit)
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getSubTree ERROR`, mlog.Err(err))

		return nil, err
	}
	defer s.CloseRows(rows)

	return s.blocksFromRows(rows)
}

func (s *SQLStore) getBlocksForBoard(db sq.BaseRunner, boardID string) ([]*model.Block, error) {
	opts := model.QueryBlocksOptions{
		BoardID: boardID,
	}
	return s.getBlocks(db, opts)
}

func (s *SQLStore) blocksFromRows(rows *sql.Rows) ([]*model.Block, error) {
	results := []*model.Block{}

	for rows.Next() {
		var block model.Block
		var fieldsJSON string
		var modifiedBy sql.NullString
		var insertAt sql.NullString

		err := rows.Scan(
			&block.ID,
			&block.ParentID,
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
			&block.BoardID)
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

func (s *SQLStore) insertBlock(db sq.BaseRunner, block *model.Block, userID string) error {
	if block.BoardID == "" {
		return ErrEmptyBoardID{}
	}

	fieldsJSON, err := json.Marshal(block.Fields)
	if err != nil {
		return err
	}

	existingBlock, err := s.getBlock(db, block.ID)
	if err != nil && !model.IsErrNotFound(err) {
		return err
	}

	block.UpdateAt = utils.GetMillis()
	block.ModifiedBy = userID

	insertQuery := s.getQueryBuilder(db).Insert("").
		Columns(
			"channel_id",
			"id",
			"parent_id",
			"created_by",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"fields",
			"create_at",
			"update_at",
			"delete_at",
			"board_id",
		)

	insertQueryValues := map[string]interface{}{
		"channel_id":            "",
		"id":                    block.ID,
		"parent_id":             block.ParentID,
		s.escapeField("schema"): block.Schema,
		"type":                  block.Type,
		"title":                 block.Title,
		"fields":                fieldsJSON,
		"delete_at":             block.DeleteAt,
		"created_by":            userID,
		"modified_by":           block.ModifiedBy,
		"create_at":             utils.GetMillis(),
		"update_at":             block.UpdateAt,
		"board_id":              block.BoardID,
	}

	if existingBlock != nil {
		// block with ID exists, so this is an update operation
		query := s.getQueryBuilder(db).Update(s.tablePrefix+"blocks").
			Where(sq.Eq{"id": block.ID}).
			Where(sq.Eq{"board_id": block.BoardID}).
			Set("parent_id", block.ParentID).
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

func (s *SQLStore) patchBlock(db sq.BaseRunner, blockID string, blockPatch *model.BlockPatch, userID string) error {
	existingBlock, err := s.getBlock(db, blockID)
	if err != nil {
		return err
	}

	block := blockPatch.Patch(existingBlock)
	return s.insertBlock(db, block, userID)
}

func (s *SQLStore) patchBlocks(db sq.BaseRunner, blockPatches *model.BlockPatchBatch, userID string) error {
	for i, blockID := range blockPatches.BlockIDs {
		err := s.patchBlock(db, blockID, &blockPatches.BlockPatches[i], userID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLStore) insertBlocks(db sq.BaseRunner, blocks []*model.Block, userID string) error {
	for _, block := range blocks {
		if block.BoardID == "" {
			return ErrEmptyBoardID{}
		}
	}
	for i := range blocks {
		err := s.insertBlock(db, blocks[i], userID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLStore) deleteBlock(db sq.BaseRunner, blockID string, modifiedBy string) error {
	return s.deleteBlockAndChildren(db, blockID, modifiedBy, false)
}

func (s *SQLStore) deleteBlockAndChildren(db sq.BaseRunner, blockID string, modifiedBy string, keepChildren bool) error {
	block, err := s.getBlock(db, blockID)
	if model.IsErrNotFound(err) {
		s.logger.Warn("deleteBlock block not found", mlog.String("block_id", blockID))
		return nil // deleting non-exiting block is not considered an error (for now)
	}
	if err != nil {
		return err
	}

	fieldsJSON, err := json.Marshal(block.Fields)
	if err != nil {
		return err
	}

	now := utils.GetMillis()
	insertQuery := s.getQueryBuilder(db).Insert(s.tablePrefix+"blocks_history").
		Columns(
			"board_id",
			"id",
			"parent_id",
			s.escapeField("schema"),
			"type",
			"title",
			"fields",
			"modified_by",
			"create_at",
			"update_at",
			"delete_at",
			"created_by",
		).
		Values(
			block.BoardID,
			block.ID,
			block.ParentID,
			block.Schema,
			block.Type,
			block.Title,
			fieldsJSON,
			modifiedBy,
			block.CreateAt,
			now,
			now,
			block.CreatedBy,
		)

	if _, err := insertQuery.Exec(); err != nil {
		return err
	}

	deleteQuery := s.getQueryBuilder(db).
		Delete(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": blockID})

	if _, err := deleteQuery.Exec(); err != nil {
		return err
	}

	if keepChildren {
		return nil
	}

	return s.deleteBlockChildren(db, block.BoardID, block.ID, modifiedBy)
}

func (s *SQLStore) undeleteBlock(db sq.BaseRunner, blockID string, modifiedBy string) error {
	blocks, err := s.getBlockHistory(db, blockID, model.QueryBlockHistoryOptions{Limit: 1, Descending: true})
	if err != nil {
		return err
	}

	if len(blocks) == 0 {
		s.logger.Warn("undeleteBlock block not found", mlog.String("block_id", blockID))
		return nil // undeleting non-exiting block is not considered an error (for now)
	}
	block := blocks[0]

	if block.DeleteAt == 0 {
		s.logger.Warn("undeleteBlock block not deleted", mlog.String("block_id", block.ID))
		return nil // undeleting not deleted block is not considered an error (for now)
	}

	fieldsJSON, err := json.Marshal(block.Fields)
	if err != nil {
		return err
	}

	now := utils.GetMillis()
	columns := []string{
		"board_id",
		"channel_id",
		"id",
		"parent_id",
		s.escapeField("schema"),
		"type",
		"title",
		"fields",
		"modified_by",
		"create_at",
		"update_at",
		"delete_at",
		"created_by",
	}

	values := []interface{}{
		block.BoardID,
		"",
		block.ID,
		block.ParentID,
		block.Schema,
		block.Type,
		block.Title,
		fieldsJSON,
		modifiedBy,
		block.CreateAt,
		now,
		0,
		block.CreatedBy,
	}
	insertHistoryQuery := s.getQueryBuilder(db).Insert(s.tablePrefix + "blocks_history").
		Columns(columns...).
		Values(values...)
	insertQuery := s.getQueryBuilder(db).Insert(s.tablePrefix + "blocks").
		Columns(columns...).
		Values(values...)

	if _, err := insertHistoryQuery.Exec(); err != nil {
		return err
	}

	if _, err := insertQuery.Exec(); err != nil {
		return err
	}

	return s.undeleteBlockChildren(db, block.BoardID, block.ID, modifiedBy)
}

func (s *SQLStore) getBlockCountsByType(db sq.BaseRunner) (map[string]int64, error) {
	query := s.getQueryBuilder(db).
		Select(
			"type",
			"COUNT(*) AS count",
		).
		From(s.tablePrefix + "blocks").
		GroupBy("type")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlockCountsByType ERROR`, mlog.Err(err))

		return nil, err
	}
	defer s.CloseRows(rows)

	m := make(map[string]int64)

	for rows.Next() {
		var blockType string
		var count int64

		err := rows.Scan(&blockType, &count)
		if err != nil {
			s.logger.Error("Failed to fetch block count", mlog.Err(err))
			return nil, err
		}
		m[blockType] = count
	}
	return m, nil
}

func (s *SQLStore) getBoardCount(db sq.BaseRunner) (int64, error) {
	query := s.getQueryBuilder(db).
		Select("COUNT(*) AS count").
		From(s.tablePrefix + "boards").
		Where(sq.Eq{"delete_at": 0}).
		Where(sq.Eq{"is_template": false})

	row := query.QueryRow()

	var count int64
	err := row.Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *SQLStore) getBlock(db sq.BaseRunner, blockID string) (*model.Block, error) {
	query := s.getQueryBuilder(db).
		Select(s.blockFields("")...).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": blockID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlock ERROR`, mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	blocks, err := s.blocksFromRows(rows)
	if err != nil {
		return nil, err
	}

	if len(blocks) == 0 {
		return nil, model.NewErrNotFound("block ID=" + blockID)
	}

	return blocks[0], nil
}

func (s *SQLStore) getBlockHistory(db sq.BaseRunner, blockID string, opts model.QueryBlockHistoryOptions) ([]*model.Block, error) {
	var order string
	if opts.Descending {
		order = descClause
	}

	query := s.getQueryBuilder(db).
		Select(s.blockFields("")...).
		From(s.tablePrefix + "blocks_history").
		Where(sq.Eq{"id": blockID}).
		OrderBy("insert_at " + order + ", update_at" + order)

	if opts.BeforeUpdateAt != 0 {
		query = query.Where(sq.Lt{"update_at": opts.BeforeUpdateAt})
	}

	if opts.AfterUpdateAt != 0 {
		query = query.Where(sq.Gt{"update_at": opts.AfterUpdateAt})
	}

	if opts.Limit != 0 {
		query = query.Limit(opts.Limit)
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlockHistory ERROR`, mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	return s.blocksFromRows(rows)
}

func (s *SQLStore) getBlockHistoryDescendants(db sq.BaseRunner, boardID string, opts model.QueryBlockHistoryOptions) ([]*model.Block, error) {
	var order string
	if opts.Descending {
		order = descClause
	}

	query := s.getQueryBuilder(db).
		Select(s.blockFields("")...).
		From(s.tablePrefix + "blocks_history").
		Where(sq.Eq{"board_id": boardID}).
		OrderBy("insert_at " + order + ", update_at" + order)

	if opts.BeforeUpdateAt != 0 {
		query = query.Where(sq.Lt{"update_at": opts.BeforeUpdateAt})
	}

	if opts.AfterUpdateAt != 0 {
		query = query.Where(sq.Gt{"update_at": opts.AfterUpdateAt})
	}

	if opts.Limit != 0 {
		query = query.Limit(opts.Limit)
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlockHistoryDescendants ERROR`, mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	return s.blocksFromRows(rows)
}

// getBlockHistoryNewestChildren returns the newest (latest) version child blocks for the
// specified parent from the blocks_history table. This includes any deleted children.
func (s *SQLStore) getBlockHistoryNewestChildren(db sq.BaseRunner, parentID string, opts model.QueryBlockHistoryChildOptions) ([]*model.Block, bool, error) {
	// as we're joining 2 queries, we need to avoid numbered
	// placeholders until the join is done, so we use the default
	// question mark placeholder here
	builder := s.getQueryBuilder(db).PlaceholderFormat(sq.Question)

	sub := builder.
		Select("bh2.id", "MAX(bh2.insert_at) AS max_insert_at").
		From(s.tablePrefix + "blocks_history AS bh2").
		Where(sq.Eq{"bh2.parent_id": parentID}).
		GroupBy("bh2.id")

	if opts.AfterUpdateAt != 0 {
		sub = sub.Where(sq.Gt{"bh2.update_at": opts.AfterUpdateAt})
	}

	if opts.BeforeUpdateAt != 0 {
		sub = sub.Where(sq.Lt{"bh2.update_at": opts.BeforeUpdateAt})
	}

	subQuery, subArgs, err := sub.ToSql()
	if err != nil {
		return nil, false, fmt.Errorf("getBlockHistoryNewestChildren unable to generate subquery: %w", err)
	}

	query := s.getQueryBuilder(db).
		Select(s.blockFields("bh")...).
		From(s.tablePrefix+"blocks_history AS bh").
		InnerJoin("("+subQuery+") AS sub ON bh.id=sub.id AND bh.insert_at=sub.max_insert_at", subArgs...)

	if opts.Page != 0 {
		query = query.Offset(uint64(opts.Page * opts.PerPage))
	}

	if opts.PerPage > 0 {
		// limit+1 to detect if more records available
		query = query.Limit(uint64(opts.PerPage + 1))
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, false, fmt.Errorf("getBlockHistoryNewestChildren unable to generate sql: %w", err)
	}

	// if we're using postgres, we need to replace the question mark
	// placeholder with the numbered dollar one, now that the full
	// query is built
	if s.dbType == model.PostgresDBType {
		var rErr error
		sql, rErr = sq.Dollar.ReplacePlaceholders(sql)
		if rErr != nil {
			return nil, false, fmt.Errorf("getBlockHistoryNewestChildren unable to replace sql placeholders: %w", rErr)
		}
	}

	rows, err := db.Query(sql, args...)
	if err != nil {
		s.logger.Error(`getBlockHistoryNewestChildren ERROR`, mlog.Err(err))
		return nil, false, err
	}
	defer s.CloseRows(rows)

	blocks, err := s.blocksFromRows(rows)
	if err != nil {
		return nil, false, err
	}

	hasMore := false
	if opts.PerPage > 0 && len(blocks) > opts.PerPage {
		blocks = blocks[:opts.PerPage]
		hasMore = true
	}
	return blocks, hasMore, nil
}

// getBoardAndCardByID returns the first parent of type `card` and first parent of type `board` for the block specified by ID.
// `board` and/or `card` may return nil without error if the block does not belong to a board or card.
func (s *SQLStore) getBoardAndCardByID(db sq.BaseRunner, blockID string) (board *model.Board, card *model.Block, err error) {
	// use block_history to fetch block in case it was deleted and no longer exists in blocks table.
	opts := model.QueryBlockHistoryOptions{
		Limit:      1,
		Descending: true,
	}

	blocks, err := s.getBlockHistory(db, blockID, opts)
	if err != nil {
		return nil, nil, err
	}

	if len(blocks) == 0 {
		return nil, nil, model.NewErrNotFound("block history BlockID=" + blockID)
	}

	return s.getBoardAndCard(db, blocks[0])
}

// getBoardAndCard returns the first parent of type `card` and and the `board` for the specified block.
// `board` and/or `card` may return nil without error if the block does not belong to a board or card.
func (s *SQLStore) getBoardAndCard(db sq.BaseRunner, block *model.Block) (board *model.Board, card *model.Block, err error) {
	var count int // don't let invalid blocks hierarchy cause infinite loop.
	iter := block

	// use block_history to fetch blocks in case they were deleted and no longer exist in blocks table.
	opts := model.QueryBlockHistoryOptions{
		Limit:      1,
		Descending: true,
	}

	for {
		count++
		if card == nil && iter.Type == model.TypeCard {
			card = iter
		}

		if iter.ParentID == "" || card != nil || count > maxSearchDepth {
			break
		}

		blocks, err2 := s.getBlockHistory(db, iter.ParentID, opts)
		if err2 != nil {
			return nil, nil, err2
		}
		if len(blocks) == 0 {
			return board, card, nil
		}
		iter = blocks[0]
	}
	board, err = s.getBoard(db, block.BoardID)
	if err != nil {
		return nil, nil, err
	}
	return board, card, nil
}

func (s *SQLStore) replaceBlockID(db sq.BaseRunner, currentID, newID, workspaceID string) error {
	runUpdateForBlocksAndHistory := func(query sq.UpdateBuilder) error {
		if _, err := query.Table(s.tablePrefix + "blocks").Exec(); err != nil {
			return err
		}

		if _, err := query.Table(s.tablePrefix + "blocks_history").Exec(); err != nil {
			return err
		}

		return nil
	}

	baseQuery := s.getQueryBuilder(db).
		Where(sq.Eq{"workspace_id": workspaceID})

	// update ID
	updateIDQ := baseQuery.Update("").
		Set("id", newID).
		Where(sq.Eq{"id": currentID})

	if errID := runUpdateForBlocksAndHistory(updateIDQ); errID != nil {
		s.logger.Error(`replaceBlockID ERROR`, mlog.Err(errID))
		return errID
	}

	// update BoardID
	updateBoardIDQ := baseQuery.Update("").
		Set("board_id", newID).
		Where(sq.Eq{"board_id": currentID})

	if errBoardID := runUpdateForBlocksAndHistory(updateBoardIDQ); errBoardID != nil {
		s.logger.Error(`replaceBlockID ERROR`, mlog.Err(errBoardID))
		return errBoardID
	}

	// update ParentID
	updateParentIDQ := baseQuery.Update("").
		Set("parent_id", newID).
		Where(sq.Eq{"parent_id": currentID})

	if errParentID := runUpdateForBlocksAndHistory(updateParentIDQ); errParentID != nil {
		s.logger.Error(`replaceBlockID ERROR`, mlog.Err(errParentID))
		return errParentID
	}

	// update parent contentOrder
	updateContentOrder := baseQuery.Update("")
	if s.dbType == model.PostgresDBType {
		updateContentOrder = updateContentOrder.
			Set("fields", sq.Expr("REPLACE(fields::text, ?, ?)::json", currentID, newID)).
			Where(sq.Like{"fields->>'contentOrder'": "%" + currentID + "%"}).
			Where(sq.Eq{"type": model.TypeCard})
	} else {
		updateContentOrder = updateContentOrder.
			Set("fields", sq.Expr("REPLACE(fields, ?, ?)", currentID, newID)).
			Where(sq.Like{"fields": "%" + currentID + "%"}).
			Where(sq.Eq{"type": model.TypeCard})
	}

	if errParentID := runUpdateForBlocksAndHistory(updateContentOrder); errParentID != nil {
		s.logger.Error(`replaceBlockID ERROR`, mlog.Err(errParentID))
		return errParentID
	}

	return nil
}

func (s *SQLStore) duplicateBlock(db sq.BaseRunner, boardID string, blockID string, userID string, asTemplate bool) ([]*model.Block, error) {
	blocks, err := s.getSubTree2(db, boardID, blockID, model.QuerySubtreeOptions{})
	if err != nil {
		return nil, err
	}
	if len(blocks) == 0 {
		message := fmt.Sprintf("block subtree BoardID=%s BlockID=%s", boardID, blockID)
		return nil, model.NewErrNotFound(message)
	}

	var rootBlock *model.Block
	allBlocks := []*model.Block{}
	for _, block := range blocks {
		if block.Type == model.TypeComment {
			continue
		}
		if block.ID == blockID {
			if block.Fields == nil {
				block.Fields = make(map[string]interface{})
			}
			block.Fields["isTemplate"] = asTemplate
			rootBlock = block
		} else {
			allBlocks = append(allBlocks, block)
		}
	}
	allBlocks = append([]*model.Block{rootBlock}, allBlocks...)

	allBlocks = model.GenerateBlockIDs(allBlocks, nil)
	if err := s.insertBlocks(db, allBlocks, userID); err != nil {
		return nil, err
	}
	return allBlocks, nil
}

func (s *SQLStore) deleteBlockChildren(db sq.BaseRunner, boardID string, parentID string, modifiedBy string) error {
	now := utils.GetMillis()

	selectQuery := s.getQueryBuilder(db).
		Select(
			"board_id",
			"id",
			"parent_id",
			s.escapeField("schema"),
			"type",
			"title",
			"fields",
			"'"+modifiedBy+"'",
			"create_at",
			s.castInt(now, "update_at"),
			s.castInt(now, "delete_at"),
			"created_by",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"board_id": boardID})

	if parentID != "" {
		selectQuery = selectQuery.Where(sq.Eq{"parent_id": parentID})
	}

	insertQuery := s.getQueryBuilder(db).
		Insert(s.tablePrefix+"blocks_history").
		Columns(
			"board_id",
			"id",
			"parent_id",
			s.escapeField("schema"),
			"type",
			"title",
			"fields",
			"modified_by",
			"create_at",
			"update_at",
			"delete_at",
			"created_by",
		).Select(selectQuery)

	if _, err := insertQuery.Exec(); err != nil {
		return err
	}

	deleteQuery := s.getQueryBuilder(db).
		Delete(s.tablePrefix + "blocks").
		Where(sq.Eq{"board_id": boardID})

	if parentID != "" {
		deleteQuery = deleteQuery.Where(sq.Eq{"parent_id": parentID})
	}

	if _, err := deleteQuery.Exec(); err != nil {
		return err
	}

	return nil
}

func (s *SQLStore) undeleteBlockChildren(db sq.BaseRunner, boardID string, parentID string, modifiedBy string) error {
	if boardID == "" {
		return ErrEmptyBoardID{}
	}

	where := fmt.Sprintf("board_id='%s'", boardID)
	if parentID != "" {
		where += fmt.Sprintf(" AND parent_id='%s'", parentID)
	}

	selectQuery := s.getQueryBuilder(db).
		Select(
			"bh.board_id",
			"'' AS channel_id",
			"bh.id",
			"bh.parent_id",
			"bh.schema",
			"bh.type",
			"bh.title",
			"bh.fields",
			"'"+modifiedBy+"' AS modified_by",
			"bh.create_at",
			s.castInt(utils.GetMillis(), "update_at"),
			s.castInt(0, "delete_at"),
			"bh.created_by",
		).
		From(fmt.Sprintf(`
				%sblocks_history AS bh,
				(SELECT id, max(insert_at) AS max_insert_at FROM %sblocks_history WHERE %s GROUP BY id) AS sub`,
			s.tablePrefix, s.tablePrefix, where)).
		Where("bh.id=sub.id").
		Where("bh.insert_at=sub.max_insert_at").
		Where(sq.NotEq{"bh.delete_at": 0})

	columns := []string{
		"board_id",
		"channel_id",
		"id",
		"parent_id",
		s.escapeField("schema"),
		"type",
		"title",
		"fields",
		"modified_by",
		"create_at",
		"update_at",
		"delete_at",
		"created_by",
	}

	insertQuery := s.getQueryBuilder(db).Insert(s.tablePrefix + "blocks").
		Columns(columns...).
		Select(selectQuery)

	insertHistoryQuery := s.getQueryBuilder(db).Insert(s.tablePrefix + "blocks_history").
		Columns(columns...).
		Select(selectQuery)

	sql, args, err := insertQuery.ToSql()
	s.logger.Trace("undeleteBlockChildren - insertQuery",
		mlog.String("sql", sql),
		mlog.Array("args", args),
		mlog.Err(err),
	)

	sql, args, err = insertHistoryQuery.ToSql()
	s.logger.Trace("undeleteBlockChildren - insertHistoryQuery",
		mlog.String("sql", sql),
		mlog.Array("args", args),
		mlog.Err(err),
	)

	// insert into blocks table must happen before history table, otherwise the history
	// table will be changed and the second query will fail to find the same records.
	result, err := insertQuery.Exec()
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	s.logger.Debug("undeleteBlockChildren - insertQuery", mlog.Int64("rows_affected", rowsAffected))

	result, err = insertHistoryQuery.Exec()
	if err != nil {
		return err
	}
	rowsAffected, _ = result.RowsAffected()
	s.logger.Debug("undeleteBlockChildren - insertHistoryQuery", mlog.Int64("rows_affected", rowsAffected))

	return nil
}
