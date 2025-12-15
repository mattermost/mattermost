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
		draft.WikiId,
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
			"Drafts.Type",
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

// Page draft content methods - Unified PageContent model (drafts stored in PageContents with status='draft')

// CreatePageDraft creates a new page draft in the PageContents table
func (s *SqlDraftStore) CreatePageDraft(content *model.PageContent) (*model.PageContent, error) {
	// Status is derived from UserId - drafts have non-empty UserId
	content.PreSave()

	if err := content.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, err := content.GetDocumentJSON()
	if err != nil {
		return nil, errors.Wrap(err, "failed to serialize PageContent content")
	}

	builder := s.getQueryBuilder().Insert("PageContents").
		Columns("PageId", "UserId", "WikiId", "Title", "Content", "SearchText", "BaseUpdateAt", "CreateAt", "UpdateAt", "DeleteAt").
		Values(content.PageId, content.UserId, content.WikiId, content.Title, contentJSON, content.SearchText, content.BaseUpdateAt, content.CreateAt, content.UpdateAt, 0)

	_, err = s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create page draft with pageId=%s, userId=%s", content.PageId, content.UserId)
	}

	return s.GetPageDraft(content.PageId, content.UserId)
}

// UpsertPageDraftContent creates or updates a page draft with optimistic locking.
// If lastUpdateAt == 0, creates or updates a draft for a new page.
// If lastUpdateAt > 0, tries to update existing draft; if no draft exists, creates one
// with BaseUpdateAt set to lastUpdateAt (for editing existing published pages).
func (s *SqlDraftStore) UpsertPageDraftContent(pageId, userId, wikiId, contentStr, title string, lastUpdateAt int64) (*model.PageContent, error) {
	now := model.GetMillis()

	// Validate content is valid TipTap JSON before attempting to store
	// This prevents PostgreSQL JSONB errors and ensures data integrity
	validatedContent := &model.PageContent{}
	if err := validatedContent.SetDocumentJSON(contentStr); err != nil {
		return nil, store.NewErrInvalidInput("PageContent", "content", err.Error())
	}
	// Get the validated JSON string to ensure proper formatting
	validatedContentStr, err := validatedContent.GetDocumentJSON()
	if err != nil {
		return nil, errors.Wrap(err, "failed to serialize validated content")
	}

	// If lastUpdateAt == 0, this is a draft for a new page (not yet published)
	// Try to update existing draft first, create if it doesn't exist
	if lastUpdateAt == 0 {
		// Try to update existing draft first (handles case where draft was created via POST endpoint)
		// UserId != '' means it's a draft (status derived from UserId)
		result, err := s.GetMaster().Exec(`
			UPDATE PageContents
			SET Content = $1, Title = $2, UpdateAt = $3
			WHERE PageId = $4
			  AND UserId = $5
			  AND UserId != ''`,
			validatedContentStr, title, now, pageId, userId)

		if err != nil {
			return nil, errors.Wrap(err, "failed to update draft")
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			// Draft was updated successfully
			return s.GetPageDraft(pageId, userId)
		}

		// No existing draft, create a new one
		// UserId being set means it's a draft (status derived from UserId)
		content := &model.PageContent{
			PageId: pageId,
			UserId: userId,
			WikiId: wikiId,
			Title:  title,
		}
		if err := content.SetDocumentJSON(contentStr); err != nil {
			return nil, errors.Wrap(err, "failed to parse content JSON")
		}
		return s.CreatePageDraft(content)
	}

	// Try to update existing draft with optimistic locking
	// UserId != '' means it's a draft (status derived from UserId)
	result, err := s.GetMaster().Exec(`
		UPDATE PageContents
		SET Content = $1, Title = $2, UpdateAt = $3
		WHERE PageId = $4
		  AND UserId = $5
		  AND UserId != ''
		  AND UpdateAt = $6`,
		validatedContentStr, title, now, pageId, userId, lastUpdateAt)

	if err != nil {
		return nil, errors.Wrap(err, "failed to save draft")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// Check why update failed: no draft exists, or version conflict
		// Query for the user's draft row (UserId = userId, which is non-empty = draft)
		query := s.getQueryBuilder().
			Select("UpdateAt").
			From("PageContents").
			Where(sq.Eq{"PageId": pageId, "UserId": userId})

		queryString, args, err := query.ToSql()
		if err != nil {
			// No draft exists - create one for editing an existing page
			return s.createDraftForExistingPage(pageId, userId, wikiId, validatedContentStr, title, lastUpdateAt)
		}

		var updateAt int64
		err = s.GetReplica().QueryRow(queryString, args...).Scan(&updateAt)
		if err != nil {
			if err == sql.ErrNoRows {
				// No draft exists yet - create one for editing an existing page
				return s.createDraftForExistingPage(pageId, userId, wikiId, validatedContentStr, title, lastUpdateAt)
			}
			return nil, errors.Wrap(err, "failed to check existing draft")
		}

		// Draft exists but UpdateAt doesn't match - version conflict
		if updateAt != lastUpdateAt {
			return nil, store.NewErrConflict("PageContent", errors.New("version_conflict"), "updateat mismatch")
		}
		// Should not reach here - create draft as fallback
		return s.createDraftForExistingPage(pageId, userId, wikiId, validatedContentStr, title, lastUpdateAt)
	}

	return s.GetPageDraft(pageId, userId)
}

// createDraftForExistingPage creates a draft for editing an existing published page.
// BaseUpdateAt is set to the page's EditAt for conflict detection when publishing.
func (s *SqlDraftStore) createDraftForExistingPage(pageId, userId, wikiId, contentStr, title string, baseUpdateAt int64) (*model.PageContent, error) {
	// UserId being set means it's a draft (status derived from UserId)
	content := &model.PageContent{
		PageId:       pageId,
		UserId:       userId,
		WikiId:       wikiId,
		Title:        title,
		BaseUpdateAt: baseUpdateAt,
	}
	if err := content.SetDocumentJSON(contentStr); err != nil {
		return nil, errors.Wrap(err, "failed to parse content JSON")
	}
	return s.CreatePageDraft(content)
}

// GetPageDraft retrieves a draft by pageId and userId
func (s *SqlDraftStore) GetPageDraft(pageId, userId string) (*model.PageContent, error) {
	// UserId != '' means it's a draft (status derived from UserId)
	// We query by specific userId which is non-empty, so we're getting a draft
	// Include EXISTS subquery to check if a published version exists
	query := s.getQueryBuilder().
		Select(
			"PageId", "UserId", "WikiId", "Title", "Content", "SearchText", "BaseUpdateAt", "CreateAt", "UpdateAt", "DeleteAt",
			"EXISTS(SELECT 1 FROM PageContents pc2 WHERE pc2.PageId = PageContents.PageId AND pc2.UserId = '') AS HasPublishedVersion",
		).
		From("PageContents").
		Where(sq.Eq{
			"PageId": pageId,
			"UserId": userId,
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_get_tosql")
	}

	var content model.PageContent
	var contentJSON string

	if err := s.GetReplica().QueryRow(queryString, args...).Scan(
		&content.PageId,
		&content.UserId,
		&content.WikiId,
		&content.Title,
		&contentJSON,
		&content.SearchText,
		&content.BaseUpdateAt,
		&content.CreateAt,
		&content.UpdateAt,
		&content.DeleteAt,
		&content.HasPublishedVersion,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageContent", pageId)
		}
		return nil, errors.Wrapf(err, "failed to get page draft with pageId=%s, userId=%s", pageId, userId)
	}

	if err := content.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse PageContent content")
	}

	return &content, nil
}

// DeletePageDraft removes a draft from PageContents
func (s *SqlDraftStore) DeletePageDraft(pageId, userId string) error {
	// UserId != '' means it's a draft (status derived from UserId)
	// We query by specific userId which is non-empty, so we're deleting a draft
	query := s.getQueryBuilder().
		Delete("PageContents").
		Where(sq.Eq{
			"PageId": pageId,
			"UserId": userId,
		})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete page draft with pageId=%s, userId=%s", pageId, userId)
	}

	return s.checkRowsAffected(result, "PageContent", pageId)
}

// GetPageDraftsForUser retrieves all drafts for a user in a wiki
func (s *SqlDraftStore) GetPageDraftsForUser(userId, wikiId string) ([]*model.PageContent, error) {
	// UserId != '' means it's a draft (status derived from UserId)
	// We query by specific userId which is non-empty, so we're getting drafts
	// Include EXISTS subquery to check if a published version exists for each draft
	query := s.getQueryBuilder().
		Select(
			"PageId", "UserId", "WikiId", "Title", "Content", "SearchText", "BaseUpdateAt", "CreateAt", "UpdateAt", "DeleteAt",
			"EXISTS(SELECT 1 FROM PageContents pc2 WHERE pc2.PageId = PageContents.PageId AND pc2.UserId = '') AS HasPublishedVersion",
		).
		From("PageContents").
		Where(sq.Eq{
			"UserId": userId,
			"WikiId": wikiId,
		}).
		OrderBy("UpdateAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_drafts_get_for_user_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get page drafts for userId=%s, wikiId=%s", userId, wikiId)
	}
	defer rows.Close()

	contents := []*model.PageContent{}

	for rows.Next() {
		var content model.PageContent
		var contentJSON sql.NullString

		err = rows.Scan(
			&content.PageId,
			&content.UserId,
			&content.WikiId,
			&content.Title,
			&contentJSON,
			&content.SearchText,
			&content.BaseUpdateAt,
			&content.CreateAt,
			&content.UpdateAt,
			&content.DeleteAt,
			&content.HasPublishedVersion,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageContent row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = content.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageContent content")
			}
		}

		contents = append(contents, &content)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageContent rows")
	}

	return contents, nil
}

// GetActiveEditorsForPage retrieves drafts for a page that have been recently updated
func (s *SqlDraftStore) GetActiveEditorsForPage(pageId string, minUpdateAt int64) ([]*model.PageContent, error) {
	// UserId != '' means it's a draft (status derived from UserId)
	query := s.getQueryBuilder().
		Select("PageId", "UserId", "WikiId", "Title", "Content", "SearchText", "BaseUpdateAt", "CreateAt", "UpdateAt", "DeleteAt").
		From("PageContents").
		Where(sq.And{
			sq.Eq{"PageId": pageId},
			sq.NotEq{"UserId": ""},
			sq.GtOrEq{"UpdateAt": minUpdateAt},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_get_active_editors_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get active editors for pageId=%s", pageId)
	}
	defer rows.Close()

	contents := []*model.PageContent{}

	for rows.Next() {
		var content model.PageContent
		var contentJSON sql.NullString

		err = rows.Scan(
			&content.PageId,
			&content.UserId,
			&content.WikiId,
			&content.Title,
			&contentJSON,
			&content.SearchText,
			&content.BaseUpdateAt,
			&content.CreateAt,
			&content.UpdateAt,
			&content.DeleteAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageContent row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = content.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageContent content")
			}
		}

		contents = append(contents, &content)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageContent rows")
	}

	return contents, nil
}

// PublishPageDraft atomically transitions a draft to published state
func (s *SqlDraftStore) PublishPageDraft(pageId, userId string) (*model.PageContent, error) {
	now := model.GetMillis()

	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin transaction")
	}
	defer finalizeTransactionX(tx, &err)

	// Step 1: Delete old published row if exists (UserId = '' means published)
	_, err = tx.Exec(`DELETE FROM PageContents WHERE PageId = $1 AND UserId = ''`, pageId)
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete old published row")
	}

	// Step 2: Flip draft → published by setting UserId = ''
	// (UserId != '' means draft, UserId = '' means published)
	var content model.PageContent
	var contentJSON string
	err = tx.QueryRow(`
		UPDATE PageContents
		SET UserId = '', UpdateAt = $1
		WHERE PageId = $2 AND UserId = $3 AND UserId != ''
		RETURNING PageId, UserId, WikiId, Title, Content, SearchText, BaseUpdateAt, CreateAt, UpdateAt, DeleteAt`,
		now, pageId, userId).Scan(
		&content.PageId,
		&content.UserId,
		&content.WikiId,
		&content.Title,
		&contentJSON,
		&content.SearchText,
		&content.BaseUpdateAt,
		&content.CreateAt,
		&content.UpdateAt,
		&content.DeleteAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageContent", pageId)
		}
		return nil, errors.Wrap(err, "failed to publish draft")
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit transaction")
	}

	if err := content.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse published content")
	}

	return &content, nil
}

// CreateDraftFromPublished copies published content to a new draft for editing
func (s *SqlDraftStore) CreateDraftFromPublished(pageId, userId string) (*model.PageContent, error) {
	// Check if user already has a draft
	existing, err := s.GetPageDraft(pageId, userId)
	if err == nil {
		return existing, nil // Return existing draft
	}

	now := model.GetMillis()

	// Copy from published to new draft row
	// UserId = '' means published (source), UserId = $1 (non-empty) means draft (destination)
	_, err = s.GetMaster().Exec(`
		INSERT INTO PageContents (PageId, UserId, WikiId, Title, Content, SearchText, BaseUpdateAt, CreateAt, UpdateAt, DeleteAt)
		SELECT PageId, $1, WikiId, Title, Content, SearchText, UpdateAt, $2, $2, 0
		FROM PageContents
		WHERE PageId = $3 AND UserId = ''`,
		userId, now, pageId)

	if err != nil {
		return nil, errors.Wrap(err, "failed to create draft from published")
	}

	return s.GetPageDraft(pageId, userId)
}

// PermanentDeletePageDraftsByUser removes all page drafts for a user
func (s *SqlDraftStore) PermanentDeletePageDraftsByUser(userId string) error {
	// UserId != '' means it's a draft (status derived from UserId)
	// Deleting by userId (non-empty) already ensures we're deleting drafts only
	query := s.getQueryBuilder().
		Delete("PageContents").
		Where(sq.Eq{
			"UserId": userId,
		})

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete page drafts for userId=%s", userId)
	}

	return nil
}

// PermanentDeletePageContentsByWiki removes all page content (drafts and published) for a wiki
func (s *SqlDraftStore) PermanentDeletePageContentsByWiki(wikiId string) error {
	query := s.getQueryBuilder().
		Delete("PageContents").
		Where(sq.Eq{"WikiId": wikiId})

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete page contents for wikiId=%s", wikiId)
	}

	return nil
}
