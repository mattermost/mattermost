// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"maps"
	"strings"
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
		"WikiId",
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
		draft.WikiId,
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

// channelDraftsOnlyCondition returns a SQL condition to filter for channel drafts only.
// Page drafts store WikiId in ChannelId field, so they won't match the Channels table join.
// This method centralizes the discrimination logic used across multiple queries.
func (s *SqlDraftStore) channelDraftsOnlyCondition() string {
	return "ChannelId IN (SELECT Id FROM Channels)"
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

	builder := s.getQueryBuilder().Insert("Drafts").
		Columns(draftSliceColumns()...).
		Values(draftToSlice(draft)...).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, channelid, rootid) DO UPDATE SET UpdateAt = ?, Message = ?, Props = ?, FileIds = ?, Priority = ?, DeleteAt = ?", draft.UpdateAt, draft.Message, model.StringInterfaceToJSON(draft.Props), model.ArrayToJSON(draft.FileIds), model.StringInterfaceToJSON(draft.Priority), 0))

	query, args, err := builder.ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "save_draft_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to upsert Draft")
	}

	return draft, nil
}

// GetDraftsForUser retrieves channel drafts for a user within a team.
// Page drafts are automatically excluded because they store WikiId in ChannelId field,
// which won't match any ChannelMembers row (natural discrimination via join).
func (s *SqlDraftStore) GetDraftsForUser(userID, teamID string) ([]*model.Draft, error) {
	var drafts []*model.Draft

	query := s.getQueryBuilder().
		Select(
			"Drafts.CreateAt",
			"Drafts.UpdateAt",
			"Drafts.Message",
			"Drafts.RootId",
			"Drafts.ChannelId",
			"Drafts.WikiId",
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

func (s *SqlDraftStore) PermanentDeleteByUser(userID string) error {
	query := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{
			"UserId": userID,
		})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "PermanentDeleteByUser: failed to delete drafts for user: %s", userID)
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
			Suffix("AND d." + s.channelDraftsOnlyCondition() + " AND (d.RootId IN (SELECT Id FROM Posts WHERE DeleteAt <> 0) OR NOT EXISTS (SELECT 1 FROM Posts WHERE Posts.Id = d.RootId))")
	}

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to delete orphan drafts")
	}

	return nil
}

// extractDraftIdFromCompositeRootId extracts the draftId from a composite "wikiId:draftId" RootId.
// If the RootId doesn't contain ":", it returns the RootId unchanged.
func extractDraftIdFromCompositeRootId(rootId string) string {
	parts := strings.Split(rootId, ":")
	if len(parts) == 2 {
		return parts[1]
	}
	return rootId
}

// GetPageDraft retrieves a draft for a specific page using wiki-scoped composite key.
// Page drafts reuse the Drafts table:
// - ChannelId stores actual channel ID (from wiki.ChannelId)
// - RootId stores composite key: "wikiId:draftId" in DB, but returns just draftId to API
// - WikiId stores wiki ID for queries
// Use draft.IsPageDraft() to programmatically distinguish draft types.
func (s *SqlDraftStore) GetPageDraft(userId, wikiId, draftId string) (*model.Draft, error) {
	wiki, err := s.Wiki().Get(wikiId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get wiki with id = %s", wikiId)
	}

	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"ChannelId": wiki.ChannelId},
			sq.Eq{"WikiId": wikiId},
			sq.Eq{"RootId": wikiId + ":" + draftId},
			sq.Eq{"DeleteAt": 0},
		})

	dt := model.Draft{}
	err = s.GetReplica().GetBuilder(&dt, query)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Draft", wikiId+"/"+draftId)
		}
		return nil, errors.Wrapf(err, "failed to find page draft with wikiId = %s, draftId = %s", wikiId, draftId)
	}

	mlog.Debug("GetPageDraft: retrieved from DB",
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId),
		mlog.String("channel_id", wiki.ChannelId),
		mlog.String("message", dt.Message),
		mlog.Int("message_length", len(dt.Message)))

	// Extract draftId from composite RootId before returning
	dt.RootId = extractDraftIdFromCompositeRootId(dt.RootId)

	return &dt, nil
}

// UpsertPageDraft creates or updates a page draft using wiki-scoped composite key
func (s *SqlDraftStore) UpsertPageDraft(userId, wikiId, draftId, message string) (*model.Draft, error) {
	wiki, err := s.Wiki().Get(wikiId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get wiki with id = %s", wikiId)
	}

	draft := &model.Draft{
		UserId:    userId,
		ChannelId: wiki.ChannelId,
		WikiId:    wikiId,
		RootId:    wikiId + ":" + draftId,
		Message:   message,
		Props:     make(map[string]any),
		FileIds:   []string{},
	}

	result, err := s.Upsert(draft)
	if err != nil {
		return nil, err
	}

	result.RootId = extractDraftIdFromCompositeRootId(result.RootId)
	return result, nil
}

// UpsertPageDraftWithMetadata creates or updates a page draft with title and page_id
func (s *SqlDraftStore) UpsertPageDraftWithMetadata(userId, wikiId, draftId, message, title, pageId string, additionalProps map[string]any) (*model.Draft, error) {
	wiki, err := s.Wiki().Get(wikiId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get wiki with id = %s", wikiId)
	}

	props := make(map[string]any)
	if title != "" {
		props["title"] = title
	}
	if pageId != "" {
		props["page_id"] = pageId
	}
	maps.Copy(props, additionalProps)

	draft := &model.Draft{
		UserId:    userId,
		ChannelId: wiki.ChannelId,
		WikiId:    wikiId,
		RootId:    wikiId + ":" + draftId,
		Message:   message,
		Props:     props,
		FileIds:   []string{},
	}

	result, err := s.Upsert(draft)
	if err != nil {
		return nil, err
	}

	result.RootId = extractDraftIdFromCompositeRootId(result.RootId)
	return result, nil
}

// DeletePageDraft deletes a draft for a specific page using wiki-scoped composite key
func (s *SqlDraftStore) DeletePageDraft(userId, wikiId, draftId string) error {
	wiki, err := s.Wiki().Get(wikiId)
	if err != nil {
		return errors.Wrapf(err, "failed to get wiki with id = %s", wikiId)
	}

	query := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"ChannelId": wiki.ChannelId},
			sq.Eq{"WikiId": wikiId},
			sq.Eq{"RootId": wikiId + ":" + draftId},
		})

	sql, args, err := query.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert to sql")
	}

	_, err = s.GetMaster().Exec(sql, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete page draft")
	}

	return nil
}

// GetPageDraftsForWiki retrieves all page drafts for a specific wiki
func (s *SqlDraftStore) GetPageDraftsForWiki(userId, wikiId string) ([]*model.Draft, error) {
	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"WikiId": wikiId},
			sq.Like{"RootId": wikiId + ":%"},
			sq.Eq{"DeleteAt": 0},
		})

	// Debug: log the SQL query
	sql, args, _ := query.ToSql()
	mlog.Debug("GetPageDraftsForWiki SQL", mlog.String("sql", sql), mlog.Any("args", args))

	var drafts []*model.Draft
	err := s.GetReplica().SelectBuilder(&drafts, query)
	if err != nil {
		mlog.Error("GetPageDraftsForWiki failed", mlog.Err(err))
		return nil, errors.Wrap(err, "failed to get page drafts for wiki")
	}

	// Extract draftId from composite RootId for each draft before returning
	for _, draft := range drafts {
		draft.RootId = extractDraftIdFromCompositeRootId(draft.RootId)
	}

	mlog.Debug("GetPageDraftsForWiki result", mlog.Int("count", len(drafts)))

	return drafts, nil
}
