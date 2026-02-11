package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelSyncStore struct {
	*SqlStore
}

func newSqlChannelSyncStore(sqlStore *SqlStore) store.ChannelSyncStore {
	return &SqlChannelSyncStore{SqlStore: sqlStore}
}

// channelSyncLayoutRow is a helper for scanning the ChannelSyncLayouts table.
// Categories is stored as JSONB in the DB but scanned as a string.
type channelSyncLayoutRow struct {
	TeamId     string `db:"teamid"`
	Categories string `db:"categories"`
	UpdateAt   int64  `db:"updateat"`
	UpdateBy   string `db:"updateby"`
}

func (s *SqlChannelSyncStore) GetLayout(teamId string) (*model.ChannelSyncLayout, error) {
	query := s.getQueryBuilder().
		Select("TeamId AS teamid", "Categories AS categories", "UpdateAt AS updateat", "UpdateBy AS updateby").
		From("ChannelSyncLayouts").
		Where(sq.Eq{"TeamId": teamId})

	var row channelSyncLayoutRow
	err := s.GetReplica().GetBuilder(&row, query)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	layout := &model.ChannelSyncLayout{
		TeamId:   row.TeamId,
		UpdateAt: row.UpdateAt,
		UpdateBy: row.UpdateBy,
	}

	if err := json.Unmarshal([]byte(row.Categories), &layout.Categories); err != nil {
		return nil, err
	}

	return layout, nil
}

func (s *SqlChannelSyncStore) SaveLayout(layout *model.ChannelSyncLayout) error {
	categoriesJSON, err := json.Marshal(layout.Categories)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder().
		Insert("ChannelSyncLayouts").
		Columns("TeamId", "Categories", "UpdateAt", "UpdateBy").
		Values(layout.TeamId, string(categoriesJSON), layout.UpdateAt, layout.UpdateBy).
		SuffixExpr(sq.Expr(
			"ON CONFLICT (TeamId) DO UPDATE SET Categories = ?, UpdateAt = ?, UpdateBy = ?",
			string(categoriesJSON), layout.UpdateAt, layout.UpdateBy,
		))

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return err
	}

	return nil
}

func (s *SqlChannelSyncStore) DeleteLayout(teamId string) error {
	query := s.getQueryBuilder().
		Delete("ChannelSyncLayouts").
		Where(sq.Eq{"TeamId": teamId})

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return err
	}
	return nil
}

// channelSyncDismissalRow is a helper for scanning dismissals.
type channelSyncDismissalRow struct {
	ChannelId string `db:"channelid"`
}

func (s *SqlChannelSyncStore) GetDismissals(userId string, teamId string) ([]string, error) {
	query := s.getQueryBuilder().
		Select("ChannelId AS channelid").
		From("ChannelSyncDismissals").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"TeamId": teamId},
		})

	var rows []channelSyncDismissalRow
	if err := s.GetReplica().SelectBuilder(&rows, query); err != nil {
		return nil, err
	}

	channelIds := make([]string, len(rows))
	for i, r := range rows {
		channelIds[i] = r.ChannelId
	}
	return channelIds, nil
}

func (s *SqlChannelSyncStore) SaveDismissal(dismissal *model.ChannelSyncDismissal) error {
	query := s.getQueryBuilder().
		Insert("ChannelSyncDismissals").
		Columns("UserId", "ChannelId", "TeamId").
		Values(dismissal.UserId, dismissal.ChannelId, dismissal.TeamId).
		SuffixExpr(sq.Expr("ON CONFLICT DO NOTHING"))

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return err
	}
	return nil
}

func (s *SqlChannelSyncStore) DeleteDismissal(userId string, channelId string, teamId string) error {
	query := s.getQueryBuilder().
		Delete("ChannelSyncDismissals").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"ChannelId": channelId},
			sq.Eq{"TeamId": teamId},
		})

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return err
	}
	return nil
}

func (s *SqlChannelSyncStore) DeleteDismissalsForChannel(channelId string) error {
	query := s.getQueryBuilder().
		Delete("ChannelSyncDismissals").
		Where(sq.Eq{"ChannelId": channelId})

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return err
	}
	return nil
}
