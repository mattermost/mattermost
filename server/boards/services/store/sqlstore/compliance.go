package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v6/boards/model"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (s *SQLStore) getBoardsForCompliance(db sq.BaseRunner, opts model.QueryBoardsForComplianceOptions) ([]*model.Board, bool, error) {
	query := s.getQueryBuilder(db).
		Select(boardFields("b.")...).
		From(s.tablePrefix + "boards as b")

	if opts.TeamID != "" {
		query = query.Where(sq.Eq{"b.team_id": opts.TeamID})
	}

	if opts.Page != 0 {
		query = query.Offset(uint64(opts.Page * opts.PerPage))
	}

	if opts.PerPage > 0 {
		// N+1 to check if there's a next page for pagination
		query = query.Limit(uint64(opts.PerPage) + 1)
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBoardsForCompliance ERROR`, mlog.Err(err))
		return nil, false, err
	}
	defer s.CloseRows(rows)

	boards, err := s.boardsFromRows(rows)
	if err != nil {
		return nil, false, err
	}

	var hasMore bool
	if opts.PerPage > 0 && len(boards) > opts.PerPage {
		boards = boards[0:opts.PerPage]
		hasMore = true
	}
	return boards, hasMore, nil
}

func (s *SQLStore) getBoardsComplianceHistory(db sq.BaseRunner, opts model.QueryBoardsComplianceHistoryOptions) ([]*model.BoardHistory, bool, error) {
	queryDescendentLastUpdate := s.getQueryBuilder(db).
		Select("MAX(blk1.update_at)").
		From(s.tablePrefix + "blocks_history as blk1").
		Where("blk1.board_id=bh.id")

	if !opts.IncludeDeleted {
		queryDescendentLastUpdate.Where(sq.Eq{"blk1.delete_at": 0})
	}

	sqlDescendentLastUpdate, _, _ := queryDescendentLastUpdate.ToSql()

	queryDescendentFirstUpdate := s.getQueryBuilder(db).
		Select("MIN(blk2.update_at)").
		From(s.tablePrefix + "blocks_history as blk2").
		Where("blk2.board_id=bh.id")

	if !opts.IncludeDeleted {
		queryDescendentFirstUpdate.Where(sq.Eq{"blk2.delete_at": 0})
	}

	sqlDescendentFirstUpdate, _, _ := queryDescendentFirstUpdate.ToSql()

	query := s.getQueryBuilder(db).
		Select(
			"bh.id",
			"bh.team_id",
			"CASE WHEN bh.delete_at=0 THEN false ELSE true END AS isDeleted",
			"COALESCE(("+sqlDescendentLastUpdate+"),0) as decendentLastUpdateAt",
			"COALESCE(("+sqlDescendentFirstUpdate+"),0) as decendentFirstUpdateAt",
			"bh.created_by",
			"bh.modified_by",
		).
		From(s.tablePrefix + "boards_history as bh")

	if !opts.IncludeDeleted {
		// filtering out deleted boards; join with boards table to ensure no history
		// for deleted boards are returned. Deleted boards won't exist in boards table.
		query = query.Join(s.tablePrefix + "boards as b ON b.id=bh.id")
	}

	query = query.Where(sq.Gt{"bh.update_at": opts.ModifiedSince}).
		GroupBy("bh.id", "bh.team_id", "bh.delete_at", "bh.created_by", "bh.modified_by").
		OrderBy("decendentLastUpdateAt desc", "bh.id")

	if opts.TeamID != "" {
		query = query.Where(sq.Eq{"bh.team_id": opts.TeamID})
	}

	if opts.Page != 0 {
		query = query.Offset(uint64(opts.Page * opts.PerPage))
	}

	if opts.PerPage > 0 {
		// N+1 to check if there's a next page for pagination
		query = query.Limit(uint64(opts.PerPage) + 1)
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBoardsComplianceHistory ERROR`, mlog.Err(err))
		return nil, false, err
	}
	defer s.CloseRows(rows)

	history, err := s.boardsHistoryFromRows(rows)
	if err != nil {
		return nil, false, err
	}

	var hasMore bool
	if opts.PerPage > 0 && len(history) > opts.PerPage {
		history = history[0:opts.PerPage]
		hasMore = true
	}
	return history, hasMore, nil
}

func (s *SQLStore) getBlocksComplianceHistory(db sq.BaseRunner, opts model.QueryBlocksComplianceHistoryOptions) ([]*model.BlockHistory, bool, error) {
	query := s.getQueryBuilder(db).
		Select(
			"bh.id",
			"brd.team_id",
			"bh.board_id",
			"bh.type",
			"CASE WHEN bh.delete_at=0 THEN false ELSE true END AS isDeleted",
			"max(bh.update_at) as lastUpdateAt",
			"min(bh.update_at) as firstUpdateAt",
			"bh.created_by",
			"bh.modified_by",
		).
		From(s.tablePrefix + "blocks_history as bh").
		Join(s.tablePrefix + "boards_history as brd on brd.id=bh.board_id")

	if !opts.IncludeDeleted {
		// filtering out deleted blocks; join with blocks table to ensure no history
		// for deleted blocks are returned. Deleted blocks won't exist in blocks table.
		query = query.Join(s.tablePrefix + "blocks as b ON b.id=bh.id")
	}

	query = query.Where(sq.Gt{"bh.update_at": opts.ModifiedSince}).
		GroupBy("bh.id", "brd.team_id", "bh.board_id", "bh.type", "bh.delete_at", "bh.created_by", "bh.modified_by").
		OrderBy("lastUpdateAt desc", "bh.id")

	if opts.TeamID != "" {
		query = query.Where(sq.Eq{"brd.team_id": opts.TeamID})
	}

	if opts.BoardID != "" {
		query = query.Where(sq.Eq{"bh.board_id": opts.BoardID})
	}

	if opts.Page != 0 {
		query = query.Offset(uint64(opts.Page * opts.PerPage))
	}

	if opts.PerPage > 0 {
		// N+1 to check if there's a next page for pagination
		query = query.Limit(uint64(opts.PerPage) + 1)
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlocksComplianceHistory ERROR`, mlog.Err(err))
		return nil, false, err
	}
	defer s.CloseRows(rows)

	history, err := s.blocksHistoryFromRows(rows)
	if err != nil {
		return nil, false, err
	}

	var hasMore bool
	if opts.PerPage > 0 && len(history) > opts.PerPage {
		history = history[0:opts.PerPage]
		hasMore = true
	}
	return history, hasMore, nil
}

func (s *SQLStore) boardsHistoryFromRows(rows *sql.Rows) ([]*model.BoardHistory, error) {
	history := []*model.BoardHistory{}

	for rows.Next() {
		boardHistory := &model.BoardHistory{}

		err := rows.Scan(
			&boardHistory.ID,
			&boardHistory.TeamID,
			&boardHistory.IsDeleted,
			&boardHistory.DescendantLastUpdateAt,
			&boardHistory.DescendantFirstUpdateAt,
			&boardHistory.CreatedBy,
			&boardHistory.LastModifiedBy,
		)
		if err != nil {
			s.logger.Error("boardsHistoryFromRows scan error", mlog.Err(err))
			return nil, err
		}

		history = append(history, boardHistory)
	}
	return history, nil
}

func (s *SQLStore) blocksHistoryFromRows(rows *sql.Rows) ([]*model.BlockHistory, error) {
	history := []*model.BlockHistory{}

	for rows.Next() {
		blockHistory := &model.BlockHistory{}

		err := rows.Scan(
			&blockHistory.ID,
			&blockHistory.TeamID,
			&blockHistory.BoardID,
			&blockHistory.Type,
			&blockHistory.IsDeleted,
			&blockHistory.LastUpdateAt,
			&blockHistory.FirstUpdateAt,
			&blockHistory.CreatedBy,
			&blockHistory.LastModifiedBy,
		)
		if err != nil {
			s.logger.Error("blocksHistoryFromRows scan error", mlog.Err(err))
			return nil, err
		}

		history = append(history, blockHistory)
	}
	return history, nil
}
