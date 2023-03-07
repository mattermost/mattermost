// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"errors"
	"fmt"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

var (
	ErrUnsupportedDatabaseType = errors.New("database type is unsupported")
)

// removeDefaultTemplates deletes all the default templates and their children.
func (s *SQLStore) removeDefaultTemplates(db sq.BaseRunner, boards []*model.Board) error {
	count := 0
	for _, board := range boards {
		if board.CreatedBy != model.SystemUserID {
			continue
		}
		// default template deletion does not need to go to blocks_history
		deleteQuery := s.getQueryBuilder(db).
			Delete(s.tablePrefix + "boards").
			Where(sq.Eq{"id": board.ID}).
			Where(sq.Eq{"is_template": true})

		if _, err := deleteQuery.Exec(); err != nil {
			return fmt.Errorf("cannot delete default template %s: %w", board.ID, err)
		}

		deleteQuery = s.getQueryBuilder(db).
			Delete(s.tablePrefix + "blocks").
			Where(sq.Or{
				sq.Eq{"parent_id": board.ID},
				sq.Eq{"root_id": board.ID},
				sq.Eq{"board_id": board.ID},
			})

		if _, err := deleteQuery.Exec(); err != nil {
			return fmt.Errorf("cannot delete default template %s: %w", board.ID, err)
		}

		s.logger.Trace("removed default template block",
			mlog.String("board_id", board.ID),
		)
		count++
	}

	s.logger.Debug("Removed default templates", mlog.Int("count", count))

	return nil
}

// getTemplateBoards fetches all template boards .
func (s *SQLStore) getTemplateBoards(db sq.BaseRunner, teamID, userID string) ([]*model.Board, error) {
	query := s.getQueryBuilder(db).
		Select(boardFields("")...).
		From(s.tablePrefix+"boards as b").
		LeftJoin(s.tablePrefix+"board_members as bm on b.id = bm.board_id and bm.user_id = ?", userID).
		Where(sq.Eq{"is_template": true}).
		Where(sq.Eq{"b.team_id": teamID}).
		Where(sq.Or{
			// this is to include public templates even if there is not board_member entry
			sq.And{
				sq.Eq{"bm.board_id": nil},
				sq.Eq{"b.type": model.BoardTypeOpen},
			},
			sq.And{
				sq.NotEq{"bm.board_id": nil},
			},
		})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getTemplateBoards ERROR`, mlog.Err(err))
		return nil, err
	}
	defer s.CloseRows(rows)

	userTemplates, err := s.boardsFromRows(rows)
	if err != nil {
		return nil, err
	}

	return userTemplates, nil
}
