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
	return "ChannelId IN (SELECT Id FROM Channels) AND (WikiId IS NULL OR WikiId = '')"
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

func (s *SqlDraftStore) GetManyByRootIds(userId, channelId string, rootIds []string, includeDeleted bool) ([]*model.Draft, error) {
	if len(rootIds) == 0 {
		return []*model.Draft{}, nil
	}

	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": channelId,
			"RootId":    rootIds,
		})

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	drafts := []*model.Draft{}
	err := s.GetReplica().SelectBuilder(&drafts, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get drafts with userId=%s channelId=%s rootIds=%v", userId, channelId, rootIds)
	}

	return drafts, nil
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

// UpsertPageDraft upserts a page draft, preserving CreateAt on updates
func (s *SqlDraftStore) UpsertPageDraft(draft *model.Draft) (*model.Draft, error) {
	draft.PreSave()

	maxDraftSize := s.GetMaxDraftSize()
	if err := draft.IsValid(maxDraftSize); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().Insert("Drafts").
		Columns(draftSliceColumns()...).
		Values(draftToSlice(draft)...).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, channelid, rootid) DO UPDATE SET UpdateAt = ?, Message = ?, Props = ?, FileIds = ?, Priority = ?, DeleteAt = ? RETURNING CreateAt, UpdateAt", draft.UpdateAt, draft.Message, model.StringInterfaceToJSON(draft.Props), model.ArrayToJSON(draft.FileIds), model.StringInterfaceToJSON(draft.Priority), 0))

	query, args, err := builder.ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "save_draft_tosql")
	}

	// Use QueryRow to get the RETURNING values (actual DB timestamps)
	var createAt, updateAt int64
	if err = s.GetMaster().QueryRow(query, args...).Scan(&createAt, &updateAt); err != nil {
		return nil, errors.Wrap(err, "failed to upsert Draft")
	}

	// Update draft with actual DB values (preserves CreateAt for existing drafts)
	draft.CreateAt = createAt
	draft.UpdateAt = updateAt

	return draft, nil
}

func (s *SqlDraftStore) UpsertPageDraftT(transaction *sqlxTxWrapper, draft *model.Draft) (*model.Draft, error) {
	draft.PreSave()

	maxDraftSize := s.GetMaxDraftSize()
	if err := draft.IsValid(maxDraftSize); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().Insert("Drafts").
		Columns(draftSliceColumns()...).
		Values(draftToSlice(draft)...).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, channelid, rootid) DO UPDATE SET UpdateAt = ?, Message = ?, Props = ?, FileIds = ?, Priority = ?, DeleteAt = ? RETURNING CreateAt, UpdateAt", draft.UpdateAt, draft.Message, model.StringInterfaceToJSON(draft.Props), model.ArrayToJSON(draft.FileIds), model.StringInterfaceToJSON(draft.Priority), 0))

	query, args, err := builder.ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "save_draft_tosql")
	}

	// Use QueryRow to get the RETURNING values (actual DB timestamps)
	var createAt, updateAt int64
	if err = transaction.QueryRow(query, args...).Scan(&createAt, &updateAt); err != nil {
		return nil, errors.Wrap(err, "failed to upsert Draft")
	}

	// Update draft with actual DB values (preserves CreateAt for existing drafts)
	draft.CreateAt = createAt
	draft.UpdateAt = updateAt

	return draft, nil
}

// GetDraftsForUser retrieves channel drafts for a user within a team.
// Page drafts are automatically excluded because they store WikiId in ChannelId field,
// which won't match any ChannelMembers row (natural discrimination via join).
func (s *SqlDraftStore) GetDraftsForUser(userID, teamID string) ([]*model.Draft, error) {
	drafts := []*model.Draft{}

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

func (s *SqlDraftStore) DeleteT(transaction *sqlxTxWrapper, userID, channelID, rootID string) error {
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

	_, err = transaction.Exec(sql, args...)

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

func (s *SqlDraftStore) UpdatePropsOnly(userId, wikiId, draftId string, props map[string]any, expectedUpdateAt int64) error {
	propsJSON := model.StringInterfaceToJSON(props)
	newUpdateAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("Drafts").
		Set("Props", propsJSON).
		Set("UpdateAt", newUpdateAt).
		Where(sq.Eq{
			"UserId":   userId,
			"WikiId":   wikiId,
			"RootId":   draftId,
			"UpdateAt": expectedUpdateAt,
		})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to update props for draft userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return errors.New("draft was modified by another process or does not exist")
	}

	return nil
}

// PageDraftContent methods - DraftStore owns both Drafts and PageDraftContents tables (MM pattern)

func (s *SqlDraftStore) UpsertPageDraftContent(content *model.PageDraftContent) (*model.PageDraftContent, error) {
	content.PreSave()

	if err := content.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, err := content.GetDocumentJSON()
	if err != nil {
		return nil, errors.Wrap(err, "failed to serialize PageDraftContent content")
	}

	builder := s.getQueryBuilder().Insert("PageDraftContents").
		Columns("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		Values(content.UserId, content.WikiId, content.DraftId, content.Title, contentJSON, content.CreateAt, content.UpdateAt).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, wikiid, draftid) DO UPDATE SET Title = ?, Content = ?, UpdateAt = ? RETURNING UserId, WikiId, DraftId, Title, Content, CreateAt, UpdateAt",
			content.Title, contentJSON, content.UpdateAt))

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_upsert_tosql")
	}

	var result model.PageDraftContent
	var resultContentJSON string

	err = s.GetMaster().QueryRow(query, args...).Scan(
		&result.UserId,
		&result.WikiId,
		&result.DraftId,
		&result.Title,
		&resultContentJSON,
		&result.CreateAt,
		&result.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to upsert PageDraftContent with userId=%s, wikiId=%s, draftId=%s", content.UserId, content.WikiId, content.DraftId)
	}

	if err := result.SetDocumentJSON(resultContentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to deserialize returned content")
	}

	return &result, nil
}

func (s *SqlDraftStore) UpsertPageDraftContentT(transaction *sqlxTxWrapper, content *model.PageDraftContent) (*model.PageDraftContent, error) {
	content.PreSave()

	if err := content.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, err := content.GetDocumentJSON()
	if err != nil {
		return nil, errors.Wrap(err, "failed to serialize PageDraftContent content")
	}

	builder := s.getQueryBuilder().Insert("PageDraftContents").
		Columns("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		Values(content.UserId, content.WikiId, content.DraftId, content.Title, contentJSON, content.CreateAt, content.UpdateAt).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, wikiid, draftid) DO UPDATE SET Title = ?, Content = ?, UpdateAt = ? RETURNING UserId, WikiId, DraftId, Title, Content, CreateAt, UpdateAt",
			content.Title, contentJSON, content.UpdateAt))

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_upsert_tosql")
	}

	var result model.PageDraftContent
	var resultContentJSON string

	err = transaction.QueryRow(query, args...).Scan(
		&result.UserId,
		&result.WikiId,
		&result.DraftId,
		&result.Title,
		&resultContentJSON,
		&result.CreateAt,
		&result.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to upsert PageDraftContent with userId=%s, wikiId=%s, draftId=%s", content.UserId, content.WikiId, content.DraftId)
	}

	if err := result.SetDocumentJSON(resultContentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to deserialize returned content")
	}

	return &result, nil
}

// UpsertPageDraftWithTransaction saves both PageDraftContent and Draft in a single transaction
// Following MM pattern: one store owns multiple related tables, manages transaction internally
func (s *SqlDraftStore) UpsertPageDraftWithTransaction(content *model.PageDraftContent, draft *model.Draft) (*model.PageDraftContent, *model.Draft, error) {
	var err error
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	savedContent, err := s.UpsertPageDraftContentT(transaction, content)
	if err != nil {
		return nil, nil, errors.Wrap(err, "upsert_content")
	}

	savedDraft, err := s.UpsertPageDraftT(transaction, draft)
	if err != nil {
		return nil, nil, errors.Wrap(err, "upsert_draft")
	}

	if err = transaction.Commit(); err != nil {
		return nil, nil, errors.Wrap(err, "commit_transaction")
	}

	return savedContent, savedDraft, nil
}

func (s *SqlDraftStore) GetPageDraftContent(userId, wikiId, draftId string) (*model.PageDraftContent, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		From("PageDraftContents").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_get_tosql")
	}

	var content model.PageDraftContent
	var contentJSON string

	if err := s.GetReplica().QueryRow(queryString, args...).Scan(
		&content.UserId,
		&content.WikiId,
		&content.DraftId,
		&content.Title,
		&contentJSON,
		&content.CreateAt,
		&content.UpdateAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageDraftContent", draftId)
		}
		return nil, errors.Wrapf(err, "failed to get PageDraftContent with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	if err := content.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse PageDraftContent content")
	}

	return &content, nil
}

func (s *SqlDraftStore) DeletePageDraftContent(userId, wikiId, draftId string) error {
	query := s.getQueryBuilder().
		Delete("PageDraftContents").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete PageDraftContent with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	return s.checkRowsAffected(result, "PageDraftContent", draftId)
}

func (s *SqlDraftStore) DeletePageDraftContentT(transaction *sqlxTxWrapper, userId, wikiId, draftId string) error {
	query := s.getQueryBuilder().
		Delete("PageDraftContents").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	result, err := transaction.ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete PageDraftContent with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	return s.checkRowsAffected(result, "PageDraftContent", draftId)
}

// DeletePageDraftWithTransaction deletes both PageDraftContent and Draft in a single transaction
// Following MM pattern: one store owns multiple related tables, manages transaction internally
func (s *SqlDraftStore) DeletePageDraftWithTransaction(userId, wikiId, channelId, draftId string) error {
	var err error
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	err = s.DeletePageDraftContentT(transaction, userId, wikiId, draftId)
	if err != nil {
		return errors.Wrap(err, "delete_content")
	}

	err = s.DeleteT(transaction, userId, channelId, draftId)
	if err != nil {
		return errors.Wrap(err, "delete_draft")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlDraftStore) GetPageDraftContentsForWiki(userId, wikiId string) ([]*model.PageDraftContent, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		From("PageDraftContents").
		Where(sq.Eq{
			"UserId": userId,
			"WikiId": wikiId,
		}).
		OrderBy("UpdateAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_get_for_wiki_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PageDraftContents for userId=%s, wikiId=%s", userId, wikiId)
	}
	defer rows.Close()

	contents := []*model.PageDraftContent{}

	for rows.Next() {
		var content model.PageDraftContent
		var contentJSON sql.NullString

		err = rows.Scan(
			&content.UserId,
			&content.WikiId,
			&content.DraftId,
			&content.Title,
			&contentJSON,
			&content.CreateAt,
			&content.UpdateAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageDraftContent row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = content.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageDraftContent content")
			}
		}

		contents = append(contents, &content)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageDraftContent rows")
	}

	return contents, nil
}

func (s *SqlDraftStore) GetActiveEditorsForPage(pageId string, minUpdateAt int64) ([]*model.PageDraftContent, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		From("PageDraftContents").
		Where(sq.And{
			sq.Eq{"DraftId": pageId},
			sq.GtOrEq{"UpdateAt": minUpdateAt},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_get_active_editors_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get active editors for pageId=%s", pageId)
	}
	defer rows.Close()

	contents := []*model.PageDraftContent{}

	for rows.Next() {
		var content model.PageDraftContent
		var contentJSON sql.NullString

		err = rows.Scan(
			&content.UserId,
			&content.WikiId,
			&content.DraftId,
			&content.Title,
			&contentJSON,
			&content.CreateAt,
			&content.UpdateAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageDraftContent row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = content.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageDraftContent content")
			}
		}

		contents = append(contents, &content)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageDraftContent rows")
	}

	return contents, nil
}
