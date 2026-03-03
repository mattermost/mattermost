// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
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
		"UserId",
		"FileIds",
		"Props",
		"Priority",
		"Type",
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
		draft.Type,
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
	err := s.GetMaster().GetBuilder(&dt, query)

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
		SuffixExpr(sq.Expr("ON CONFLICT (userid, channelid, rootid) DO UPDATE SET UpdateAt = ?, Message = ?, Props = ?, FileIds = ?, Priority = ?, Type = ?, DeleteAt = ?", draft.UpdateAt, draft.Message, model.StringInterfaceToJSON(draft.Props), model.ArrayToJSON(draft.FileIds), model.StringInterfaceToJSON(draft.Priority), draft.Type, 0))

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

	if err := draft.BaseIsValid(); err != nil {
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

	if err := draft.BaseIsValid(); err != nil {
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
			"Drafts.UserId",
			"Drafts.FileIds",
			"Drafts.Props",
			"Drafts.Priority",
			"COALESCE(Drafts.Type, '') AS Type",
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

	// The Draft.Message column has historically been VARCHAR(4000), but
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

	// Assume a worst-case representation of four bytes per rune.
	// When column is TEXT (no character_maximum_length), fall back to the same limit as posts.
	maxDraftSize := max(int(maxDraftSizeBytes)/4, model.PostMessageMaxRunesV2)

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
	builder := s.getQueryBuilder().
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
		Where("d.Message = ''").
		Where("d." + s.channelDraftsOnlyCondition())

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to delete empty drafts")
	}

	return nil
}

func (s *SqlDraftStore) DeleteOrphanDraftsByCreateAtAndUserId(createAt int64, userId string) error {
	builder := s.getQueryBuilder().
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
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    draftId,
			"UpdateAt":  expectedUpdateAt,
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

// BatchUpdateDraftParentId updates all drafts in a wiki that have the specified old parent ID.
// Returns the list of updated drafts for WebSocket broadcasting.
// Uses a single UPDATE query with RETURNING for efficiency.
func (s *SqlDraftStore) BatchUpdateDraftParentId(userId, wikiId, oldParentId, newParentId string) ([]*model.Draft, error) {
	newUpdateAt := model.GetMillis()

	// Use PostgreSQL JSONB operators to find drafts with matching parent_id and update in a single query
	// Drafts.Props is VARCHAR (not JSONB), so cast to jsonb for JSON operations, then back to text
	// Props::jsonb->>'page_parent_id' extracts the value as text for comparison
	// jsonb_set updates the value at the specified path
	rows, err := s.GetMaster().Query(`
		UPDATE Drafts
		SET Props = jsonb_set(Props::jsonb, '{page_parent_id}', to_jsonb($1::text))::text,
		    UpdateAt = $2
		WHERE UserId = $3
		  AND ChannelId = $4
		  AND Props::jsonb->>'page_parent_id' = $5
		  AND DeleteAt = 0
		RETURNING CreateAt, UpdateAt, DeleteAt, Message, RootId, ChannelId, UserId, FileIds, Props, Priority, Type`,
		newParentId, newUpdateAt, userId, wikiId, oldParentId)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to batch update draft parent IDs for userId=%s, wikiId=%s", userId, wikiId)
	}
	defer rows.Close()

	var updatedDrafts []*model.Draft
	for rows.Next() {
		var draft model.Draft
		err = rows.Scan(
			&draft.CreateAt,
			&draft.UpdateAt,
			&draft.DeleteAt,
			&draft.Message,
			&draft.RootId,
			&draft.ChannelId,
			&draft.UserId,
			&draft.FileIds,
			&draft.Props,
			&draft.Priority,
			&draft.Type,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan updated draft row")
		}
		updatedDrafts = append(updatedDrafts, &draft)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating updated draft rows")
	}

	return updatedDrafts, nil
}

// UpdateDraftParent atomically updates only the page_parent_id prop in the Drafts table.
// This is used for move operations and does not modify content or title.
// It uses a read-modify-write pattern to merge the new parent_id into existing props.
// Wrapped in a transaction to ensure atomicity under concurrent access.
func (s *SqlDraftStore) UpdateDraftParent(userId, wikiId, draftId, newParentId string) (err error) {
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Read the current draft within transaction to get its props
	getQuery := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    draftId,
			"DeleteAt":  0,
		})

	draft := model.Draft{}
	if err = transaction.GetBuilder(&draft, getQuery); err != nil {
		if err == sql.ErrNoRows {
			return store.NewErrNotFound("Draft", draftId)
		}
		return errors.Wrapf(err, "failed to get draft for move userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	// Merge the new parent_id into existing props
	props := draft.GetProps()
	if props == nil {
		props = make(map[string]any)
	}
	props[model.DraftPropsPageParentID] = newParentId

	propsJSON := model.StringInterfaceToJSON(props)
	newUpdateAt := model.GetMillis()

	// Update only the props and updateAt within transaction
	updateQuery := s.getQueryBuilder().
		Update("Drafts").
		Set("Props", propsJSON).
		Set("UpdateAt", newUpdateAt).
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    draftId,
		})

	result, err := transaction.ExecBuilder(updateQuery)
	if err != nil {
		return errors.Wrapf(err, "failed to update parent for draft userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("Draft", draftId)
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

// UpsertPageDraftContent creates or updates a page draft's content in the Drafts table.
// Content is stored in Drafts.Message as TipTap JSON.
// BaseUpdateAt is stored in Draft.Props["base_update_at"].
// On conflict (existing draft), only Message, UpdateAt, and base_update_at are updated;
// other Props keys (title, page_parent_id, etc.) are preserved via JSONB merge.
func (s *SqlDraftStore) UpsertPageDraftContent(pageId, userId, wikiId, contentStr string, lastUpdateAt int64) (*model.Draft, error) {
	if err := model.ValidateTipTapDocument(contentStr); err != nil {
		return nil, store.NewErrInvalidInput("Draft", "Message", err.Error())
	}

	now := model.GetMillis()

	draft := &model.Draft{
		UserId:    userId,
		ChannelId: wikiId,
		RootId:    pageId,
		Message:   contentStr,
		CreateAt:  now,
		UpdateAt:  now,
	}

	props := model.StringInterface{
		model.PagePropsPageID: pageId,
	}
	if lastUpdateAt > 0 {
		props["base_update_at"] = lastUpdateAt
	}
	draft.Props = props

	draft.PreSave()
	if err := draft.BaseIsValid(); err != nil {
		return nil, err
	}

	// On conflict, merge new props into existing props (preserving title, page_parent_id, etc.)
	// rather than overwriting all props.
	newPropsJSON := model.StringInterfaceToJSON(draft.Props)

	builder := s.getQueryBuilder().Insert("Drafts").
		Columns(draftSliceColumns()...).
		Values(draftToSlice(draft)...).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, channelid, rootid) DO UPDATE SET UpdateAt = ?, Message = ?, Props = (COALESCE(Drafts.Props, '{}')::jsonb || ?::jsonb)::text, DeleteAt = ? RETURNING CreateAt, UpdateAt, Props",
			draft.UpdateAt, draft.Message, newPropsJSON, 0))

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "upsert_page_draft_content_tosql")
	}

	var createAt, updateAt int64
	var propsJSON string
	if err = s.GetMaster().QueryRow(query, args...).Scan(&createAt, &updateAt, &propsJSON); err != nil {
		return nil, errors.Wrap(err, "failed to upsert page draft content")
	}

	draft.CreateAt = createAt
	draft.UpdateAt = updateAt
	if propsJSON != "" {
		draft.Props = model.StringInterfaceFromJSON(strings.NewReader(propsJSON))
	}

	return draft, nil
}

// GetPageDraft retrieves a page draft by pageId, userId, and wikiId from the Drafts table.
func (s *SqlDraftStore) GetPageDraft(pageId, userId, wikiId string) (*model.Draft, error) {
	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    pageId,
			"DeleteAt":  0,
		})

	draft := model.Draft{}
	if err := s.GetMaster().GetBuilder(&draft, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Draft", pageId)
		}
		return nil, errors.Wrapf(err, "failed to get page draft pageId=%s, userId=%s", pageId, userId)
	}

	return &draft, nil
}

// DeletePageDraft removes a page draft from the Drafts table.
func (s *SqlDraftStore) DeletePageDraft(pageId, userId, wikiId string) error {
	query := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    pageId,
		})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete page draft pageId=%s, userId=%s", pageId, userId)
	}

	return s.checkRowsAffected(result, "Draft", pageId)
}

// GetPageDraftsForUser retrieves page drafts for a user in a wiki with pagination.
func (s *SqlDraftStore) GetPageDraftsForUser(userId, wikiId string, offset, limit int) ([]*model.Draft, error) {
	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"DeleteAt":  0,
		}).
		OrderBy("UpdateAt DESC")

	if limit > 0 {
		query = query.Offset(uint64(offset)).Limit(uint64(limit))
	}

	drafts := []*model.Draft{}
	if err := s.GetMaster().SelectBuilder(&drafts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get page drafts for userId=%s, wikiId=%s", userId, wikiId)
	}

	return drafts, nil
}

// GetActiveEditorsForPage retrieves page drafts for a page that have been recently updated.
// Filters by RootId (page ID) and requires Props to contain "page_id" to exclude non-page drafts.
func (s *SqlDraftStore) GetActiveEditorsForPage(pageId string, minUpdateAt int64) ([]*model.Draft, error) {
	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.And{
			sq.Eq{"RootId": pageId},
			sq.GtOrEq{"UpdateAt": minUpdateAt},
			sq.Eq{"DeleteAt": 0},
			sq.Expr("Props::jsonb->>'page_id' IS NOT NULL"),
		})

	drafts := []*model.Draft{}
	if err := s.GetMaster().SelectBuilder(&drafts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get active editors for pageId=%s", pageId)
	}

	return drafts, nil
}

// PublishPageDraft retrieves and deletes a page draft atomically for publish.
// The caller (app layer) will copy Draft.Message into Post.Message.
func (s *SqlDraftStore) PublishPageDraft(pageId, userId, wikiId string) (*model.Draft, error) {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin transaction")
	}
	defer finalizeTransactionX(tx, &err)

	// Fetch the draft within transaction
	query := s.getQueryBuilder().
		Select(draftSliceColumns()...).
		From("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    pageId,
			"DeleteAt":  0,
		}).
		Suffix("FOR UPDATE")

	draft := model.Draft{}
	if txErr := tx.GetBuilder(&draft, query); txErr != nil {
		if txErr == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Draft", pageId)
		}
		return nil, errors.Wrap(txErr, "failed to get draft for publish")
	}

	// Delete the draft
	deleteQuery := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{
			"UserId":    userId,
			"ChannelId": wikiId,
			"RootId":    pageId,
		})
	if _, txErr := tx.ExecBuilder(deleteQuery); txErr != nil {
		return nil, errors.Wrap(txErr, "failed to delete draft after publish")
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit transaction")
	}

	return &draft, nil
}
