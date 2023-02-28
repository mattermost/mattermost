package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (s *SQLStore) getUserCategoryBoards(db sq.BaseRunner, userID, teamID string) ([]model.CategoryBoards, error) {
	categories, err := s.getUserCategories(db, userID, teamID)
	if err != nil {
		return nil, err
	}

	userCategoryBoards := []model.CategoryBoards{}
	for _, category := range categories {
		boardMetadata, err := s.getCategoryBoardAttributes(db, category.ID)
		if err != nil {
			return nil, err
		}

		userCategoryBoard := model.CategoryBoards{
			Category:      category,
			BoardMetadata: boardMetadata,
		}

		userCategoryBoards = append(userCategoryBoards, userCategoryBoard)
	}

	return userCategoryBoards, nil
}

func (s *SQLStore) getCategoryBoardAttributes(db sq.BaseRunner, categoryID string) ([]model.CategoryBoardMetadata, error) {
	query := s.getQueryBuilder(db).
		Select("board_id, COALESCE(hidden, false)").
		From(s.tablePrefix + "category_boards").
		Where(sq.Eq{
			"category_id": categoryID,
		}).
		OrderBy("sort_order")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("getCategoryBoards error fetching categoryblocks", mlog.String("categoryID", categoryID), mlog.Err(err))
		return nil, err
	}

	return s.categoryBoardsFromRows(rows)
}

func (s *SQLStore) addUpdateCategoryBoard(db sq.BaseRunner, userID, categoryID string, boardIDsParam []string) error {
	// we need to de-duplicate this array as Postgres failes to
	// handle upsert if there are multiple incoming rows
	// that conflict the same existing row.
	// For example, having the entry "1" in DB and trying to upsert "1" and "1" will fail
	// as there are multiple duplicates of the same "1".
	//
	// Source: https://stackoverflow.com/questions/42994373/postgresql-on-conflict-cannot-affect-row-a-second-time
	boardIDs := utils.DedupeStringArr(boardIDsParam)

	if len(boardIDs) == 0 {
		return nil
	}

	query := s.getQueryBuilder(db).
		Insert(s.tablePrefix+"category_boards").
		Columns(
			"id",
			"user_id",
			"category_id",
			"board_id",
			"create_at",
			"update_at",
			"sort_order",
			"hidden",
		)

	now := utils.GetMillis()
	for _, boardID := range boardIDs {
		query = query.Values(
			utils.NewID(utils.IDTypeNone),
			userID,
			categoryID,
			boardID,
			now,
			now,
			0,
			false,
		)
	}

	if s.dbType == model.MysqlDBType {
		query = query.Suffix(
			"ON DUPLICATE KEY UPDATE category_id = ?",
			categoryID,
		)
	} else {
		query = query.Suffix(
			`ON CONFLICT (user_id, board_id)
			 DO UPDATE SET category_id = EXCLUDED.category_id, update_at = EXCLUDED.update_at`,
		)
	}

	if _, err := query.Exec(); err != nil {
		return fmt.Errorf(
			"store addUpdateCategoryBoard: failed to upsert user-board-category userID: %s, categoryID: %s, board_count: %d, error: %w",
			userID, categoryID, len(boardIDs), err,
		)
	}

	return nil
}

func (s *SQLStore) categoryBoardsFromRows(rows *sql.Rows) ([]model.CategoryBoardMetadata, error) {
	metadata := []model.CategoryBoardMetadata{}

	for rows.Next() {
		datum := model.CategoryBoardMetadata{}
		err := rows.Scan(&datum.BoardID, &datum.Hidden)

		if err != nil {
			s.logger.Error("categoryBoardsFromRows row scan error", mlog.Err(err))
			return nil, err
		}

		metadata = append(metadata, datum)
	}

	return metadata, nil
}

func (s *SQLStore) reorderCategoryBoards(db sq.BaseRunner, categoryID string, newBoardsOrder []string) ([]string, error) {
	if len(newBoardsOrder) == 0 {
		return nil, nil
	}

	updateCase := sq.Case("board_id")
	for i, boardID := range newBoardsOrder {
		updateCase = updateCase.When("'"+boardID+"'", sq.Expr(fmt.Sprintf("%d", i+model.CategoryBoardsSortOrderGap)))
	}
	updateCase.Else("sort_order")

	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"category_boards").
		Set("sort_order", updateCase).
		Where(sq.Eq{
			"category_id": categoryID,
		})

	if _, err := query.Exec(); err != nil {
		s.logger.Error(
			"reorderCategoryBoards failed to update category board order",
			mlog.String("category_id", categoryID),
			mlog.Err(err),
		)

		return nil, err
	}

	return newBoardsOrder, nil
}

func (s *SQLStore) setBoardVisibility(db sq.BaseRunner, userID, categoryID, boardID string, visible bool) error {
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"category_boards").
		Set("hidden", !visible).
		Where(sq.Eq{
			"user_id":     userID,
			"category_id": categoryID,
			"board_id":    boardID,
		})

	if _, err := query.Exec(); err != nil {
		s.logger.Error(
			"SQLStore setBoardVisibility: failed to update board visibility",
			mlog.String("user_id", userID),
			mlog.String("board_id", boardID),
			mlog.Bool("visible", visible),
			mlog.Err(err),
		)

		return err
	}

	return nil
}
