// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"sync"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type SqlDraftStore struct {
	*SqlStore
	metrics            einterfaces.MetricsInterface
	maxDraftSizeOnce   sync.Once
	maxDraftSizeCached int
}

func draftSliceColumns() []string {
	return []string{
		"CreateAt",
		"UpdateAt",
		"DeleteAt",
		"Message",
		"RootId",
		"ChannelId",
		"UserId",
		"FileIds",
		"Props",
		"Priority",
	}
}

func draftToSlice(draft *model.Draft) []any {
	return []any{
		draft.CreateAt,
		draft.UpdateAt,
		draft.DeleteAt,
		draft.Message,
		draft.RootId,
		draft.ChannelId,
		draft.UserId,
		model.ArrayToJSON(draft.FileIds),
		model.StringInterfaceToJSON(draft.Props),
		model.StringInterfaceToJSON(draft.Priority),
	}
}

func newSqlDraftStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.DraftStore {
	return &SqlDraftStore{
		SqlStore:           sqlStore,
		metrics:            metrics,
		maxDraftSizeCached: model.PostMessageMaxRunesV1,
	}
}

func (s *SqlDraftStore) Get(userId, channelId, rootId string, includeDeleted bool) (*model.Draft, error) {
	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": channelId,
			"RootId":    rootId,
		})

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	dt := model.Draft{}
	err := s.GetReplica().GetBuilder(&dt, query)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Draft", channelId)
		}
		return nil, errors.Wrapf(err, "failed to find draft with channelid = %s", channelId)
	}

	return &dt, nil
}

func (s *SqlDraftStore) Upsert(draft *model.Draft) (*model.Draft, error) {
	draft.PreSave()
	maxDraftSize := s.GetMaxDraftSize()
	if err := draft.IsValid(maxDraftSize); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().Insert("Drafts").Columns(draftSliceColumns()...).Values(draftToSlice(draft)...)

	if s.DriverName() == model.DatabaseDriverMysql {
		builder = builder.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE  UpdateAt = ?, Message = ?, Props = ?, FileIds = ?, Priority = ?, DeleteAt = ?", draft.UpdateAt, draft.Message, draft.Props, draft.FileIds, draft.Priority, 0))
	} else {
		builder = builder.SuffixExpr(sq.Expr("ON CONFLICT (UserId, ChannelId, RootId) DO UPDATE SET UpdateAt = ?, Message = ?, Props = ?, FileIds = ?, Priority = ?, DeleteAt = ?", draft.UpdateAt, draft.Message, draft.Props, draft.FileIds, draft.Priority, 0))
	}

	query, args, err := builder.ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "save_draft_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to upsert Draft")
	}

	return draft, nil
}

func (s *SqlDraftStore) GetDraftsForUser(userID, teamID string) ([]*model.Draft, error) {
	var drafts []*model.Draft

	query := s.getQueryBuilder().
		Select(
			"Drafts.CreateAt",
			"Drafts.UpdateAt",
			"Drafts.Message",
			"Drafts.RootId",
			"Drafts.ChannelId",
			"Drafts.UserId",
			"Drafts.FileIds",
			"Drafts.Props",
			"Drafts.Priority",
		).
		From("Drafts").
		InnerJoin("ChannelMembers ON ChannelMembers.ChannelId = Drafts.ChannelId").
		Where(sq.And{
			sq.Eq{"Drafts.DeleteAt": 0},
			sq.Eq{"Drafts.UserId": userID},
			sq.Eq{"ChannelMembers.UserId": userID},
		}).
		OrderBy("Drafts.UpdateAt DESC")

	if teamID != "" {
		query = query.
			Join("Channels ON Drafts.ChannelId = Channels.Id").
			Where(sq.Or{
				sq.Eq{"Channels.TeamId": teamID},
				sq.Eq{"Channels.TeamId": ""},
			})
	}

	err := s.GetReplica().SelectBuilder(&drafts, query)

	if err != nil {
		return nil, errors.Wrap(err, "failed to get user drafts")
	}

	return drafts, nil
}

func (s *SqlDraftStore) Delete(userID, channelID, rootID string) error {
	query := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{
			"UserId":    userID,
			"ChannelId": channelID,
			"RootId":    rootID,
		})

	sql, args, err := query.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert to sql")
	}

	_, err = s.GetMaster().Exec(sql, args...)

	if err != nil {
		return errors.Wrap(err, "failed to delete Draft")
	}

	return nil
}

// DeleteDraftsAssociatedWithPost deletes all drafts associated with a post.
func (s *SqlDraftStore) DeleteDraftsAssociatedWithPost(channelID, rootID string) error {
	query := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{
			"ChannelId": channelID,
			"RootId":    rootID,
		})

	sql, args, err := query.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert to sql")
	}

	_, err = s.GetMaster().Exec(sql, args...)

	if err != nil {
		return errors.Wrap(err, "failed to delete Draft")
	}

	return nil
}

// GetMaxDraftSize returns the maximum number of runes that may be stored in a post.
func (s *SqlDraftStore) GetMaxDraftSize() int {
	s.maxDraftSizeOnce.Do(func() {
		s.maxDraftSizeCached = s.determineMaxDraftSize()
	})
	return s.maxDraftSizeCached
}

func (s *SqlDraftStore) determineMaxDraftSize() int {
	var maxDraftSizeBytes int32

	if s.DriverName() == model.DatabaseDriverPostgres {
		// The Draft.Message column in Postgres has historically been VARCHAR(4000), but
		// may be manually enlarged to support longer drafts.
		if err := s.GetReplica().Get(&maxDraftSizeBytes, `
			SELECT
				COALESCE(character_maximum_length, 0)
			FROM
				information_schema.columns
			WHERE
				table_name = 'drafts'
			AND	column_name = 'message'
		`); err != nil {
			mlog.Warn("Unable to determine the maximum supported draft size", mlog.Err(err))
		}
	} else if s.DriverName() == model.DatabaseDriverMysql {
		// The Draft.Message column in MySQL has historically been TEXT, with a maximum
		// limit of 65535.
		if err := s.GetReplica().Get(&maxDraftSizeBytes, `
			SELECT
				COALESCE(CHARACTER_MAXIMUM_LENGTH, 0)
			FROM
				INFORMATION_SCHEMA.COLUMNS
			WHERE
				table_schema = DATABASE()
			AND	table_name = 'Drafts'
			AND	column_name = 'Message'
			LIMIT 0, 1
		`); err != nil {
			mlog.Warn("Unable to determine the maximum supported draft size", mlog.Err(err))
		}
	} else {
		mlog.Warn("No implementation found to determine the maximum supported draft size")
	}

	// Assume a worst-case representation of four bytes per rune.
	maxDraftSize := int(maxDraftSizeBytes) / 4

	mlog.Info("Draft.Message has size restrictions", mlog.Int("max_characters", maxDraftSize), mlog.Int("max_bytes", maxDraftSizeBytes))

	return maxDraftSize
}

func (s *SqlDraftStore) GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt int64, userId string) (int64, string, error) {
	var drafts []struct {
		CreateAt int64
		UserId   string
	}

	query := s.getQueryBuilder().
		Select("CreateAt", "UserId").
		From("Drafts").
		Where(sq.Or{
			sq.Gt{"CreateAt": createAt},
			sq.And{
				sq.Eq{"CreateAt": createAt},
				sq.Gt{"UserId": userId},
			},
		}).
		OrderBy("CreateAt", "UserId ASC").
		Limit(100)

	err := s.GetReplica().SelectBuilder(&drafts, query)
	if err != nil {
		return 0, "", errors.Wrap(err, "failed to get the list of drafts")
	}

	if len(drafts) == 0 {
		return 0, "", nil
	}

	lastElement := drafts[len(drafts)-1]
	return lastElement.CreateAt, lastElement.UserId, nil
}

func (s *SqlDraftStore) DeleteEmptyDraftsByCreateAtAndUserId(createAt int64, userId string) error {
	var builder Builder
	if s.DriverName() == model.DatabaseDriverPostgres {
		builder = s.getQueryBuilder().
			Delete("Drafts d").
			PrefixExpr(s.getQueryBuilder().Select().
				Prefix("WITH dd AS (").
				Columns("UserId", "ChannelId", "RootId").
				From("Drafts").
				Where(sq.Or{
					sq.Gt{"CreateAt": createAt},
					sq.And{
						sq.Eq{"CreateAt": createAt},
						sq.Gt{"UserId": userId},
					},
				}).
				OrderBy("CreateAt", "UserId").
				Limit(100).
				Suffix(")"),
			).
			Using("dd").
			Where("d.UserId = dd.UserId").
			Where("d.ChannelId = dd.ChannelId").
			Where("d.RootId = dd.RootId").
			Where("d.Message = ''")
	} else if s.DriverName() == model.DatabaseDriverMysql {
		builder = s.getQueryBuilder().
			Delete("Drafts d").
			What("d.*").
			JoinClause(s.getQueryBuilder().Select().
				Prefix("INNER JOIN (").
				Columns("UserId, ChannelId, RootId").
				From("Drafts").
				Where(sq.And{
					sq.Or{
						sq.Gt{"CreateAt": createAt},
						sq.And{
							sq.Eq{"CreateAt": createAt},
							sq.Gt{"UserId": userId},
						},
					},
				}).
				OrderBy("CreateAt", "UserId").
				Limit(100).
				Suffix(") dj ON (d.UserId = dj.UserId AND d.ChannelId = dj.ChannelId AND d.RootId = dj.RootId)"),
			).Where(sq.Eq{"Message": ""})
	}

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to delete empty drafts")
	}

	return nil
}

func (s *SqlDraftStore) DeleteOrphanDraftsByCreateAtAndUserId(createAt int64, userId string) error {
	var builder Builder
	if s.DriverName() == model.DatabaseDriverPostgres {
		builder = s.getQueryBuilder().
			Delete("Drafts d").
			PrefixExpr(s.getQueryBuilder().Select().
				Prefix("WITH dd AS (").
				Columns("UserId", "ChannelId", "RootId").
				From("Drafts").
				Where(sq.Or{
					sq.Gt{"CreateAt": createAt},
					sq.And{
						sq.Eq{"CreateAt": createAt},
						sq.Gt{"UserId": userId},
					},
				}).
				OrderBy("CreateAt", "UserId").
				Limit(100).
				Suffix(")"),
			).
			Using("dd").
			Where("d.UserId = dd.UserId").
			Where("d.ChannelId = dd.ChannelId").
			Where("d.RootId = dd.RootId").
			Suffix("AND (d.RootId IN (SELECT Id FROM Posts WHERE DeleteAt <> 0) OR NOT EXISTS (SELECT 1 FROM Posts WHERE Posts.Id = d.RootId))")
	} else if s.DriverName() == model.DatabaseDriverMysql {
		builder = s.getQueryBuilder().
			Delete("Drafts d").
			What("d.*").
			JoinClause(s.getQueryBuilder().Select().
				Prefix("INNER JOIN (").
				Columns("UserId, ChannelId, RootId").
				From("Drafts").
				Where(sq.And{
					sq.Or{
						sq.Gt{"CreateAt": createAt},
						sq.And{
							sq.Eq{"CreateAt": createAt},
							sq.Gt{"UserId": userId},
						},
					},
				}).
				OrderBy("CreateAt", "UserId").
				Limit(100).
				Suffix(") dj ON (d.UserId = dj.UserId AND d.ChannelId = dj.ChannelId AND d.RootId = dj.RootId)"),
			).
			Suffix("AND (d.RootId IN (SELECT Id FROM Posts WHERE DeleteAt <> 0) OR NOT EXISTS (SELECT 1 FROM Posts WHERE Posts.Id = d.RootId))")
	}

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to delete orphan drafts")
	}

	return nil
}
