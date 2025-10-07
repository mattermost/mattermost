// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlAutoTranslationStore struct {
	*SqlStore
}

type Translation struct {
	ObjectType        string         `db:"object_type"`
	ObjectID          string         `db:"object_id"`
	DstLang           string         `db:"dst_lang"`
	ProviderID        string         `db:"provider_id"`
	NormHash          string         `db:"norm_hash"`
	Text              string         `db:"text"`
	Confidence        *float64       `db:"confidence"`
	Meta              map[string]any `db:"meta"`
	UpdateAt          int64          `db:"updateat"`
	ContentSearchText *string        `db:"content_search_text"`
}

func newSqlAutoTranslationStore(sqlStore *SqlStore) store.AutoTranslationStore {
	return &SqlAutoTranslationStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlAutoTranslationStore) IsChannelEnabled(channelID string) (bool, *model.AppError) {
	query := s.getQueryBuilder().
		Select("COALESCE((props->'autotranslation'->>'enabled')::boolean, false)").
		From("channels").
		Where(sq.Eq{"id": channelID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlAutoTranslationStore.IsChannelEnabled",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	var enabled *bool
	if err := s.GetReplica().Get(&enabled, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return false, model.NewAppError("SqlAutoTranslationStore.IsChannelEnabled",
				"store.sql_autotranslation.channel_not_found", nil, "channel_id="+channelID, 404)
		}
		return false, model.NewAppError("SqlAutoTranslationStore.IsChannelEnabled",
			"store.sql_autotranslation.get_channel_enabled.app_error", nil, err.Error(), 500)
	}

	if enabled == nil {
		return false, nil
	}

	return *enabled, nil
}

func (s *SqlAutoTranslationStore) SetChannelEnabled(channelID string, enabled bool) *model.AppError {
	enabledJSON := "false"
	if enabled {
		enabledJSON = "true"
	}

	query := s.getQueryBuilder().
		Update("channels").
		Set("props", sq.Expr("jsonb_set(COALESCE(props, '{}'::jsonb), '{autotranslation,enabled}', ?::jsonb)", enabledJSON)).
		Where(sq.Eq{"id": channelID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.SetChannelEnabled",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.SetChannelEnabled",
			"store.sql_autotranslation.set_channel_enabled.app_error", nil, err.Error(), 500)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.SetChannelEnabled",
			"store.sql_autotranslation.set_channel_enabled.app_error", nil, err.Error(), 500)
	}

	if rowsAffected == 0 {
		return model.NewAppError("SqlAutoTranslationStore.SetChannelEnabled",
			"store.sql_autotranslation.channel_not_found", nil, "channel_id="+channelID, 404)
	}

	return nil
}

func (s *SqlAutoTranslationStore) IsUserEnabled(userID, channelID string) (bool, *model.AppError) {
	query := s.getQueryBuilder().
		Select("COALESCE((cm.props->'autotranslation'->>'enabled')::boolean, false)").
		From("channelmembers cm").
		Join("channels c ON cm.channelid = c.id").
		Where(sq.Eq{"cm.userid": userID, "cm.channelid": channelID}).
		Where("COALESCE((c.props->'autotranslation'->>'enabled')::boolean, false) = true")

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlAutoTranslationStore.IsUserEnabled",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	var enabled *bool
	if err := s.GetReplica().Get(&enabled, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}

		return false, model.NewAppError("SqlAutoTranslationStore.IsUserEnabled",
			"store.sql_autotranslation.get_user_enabled.app_error", nil, err.Error(), 500)
	}

	if enabled == nil {
		return false, nil
	}

	return *enabled, nil
}

func (s *SqlAutoTranslationStore) SetUserEnabled(userID, channelID string, enabled bool) *model.AppError {
	enabledJSON := "false"
	if enabled {
		enabledJSON = "true"
	}

	query := s.getQueryBuilder().
		Update("channelmembers").
		Set("props", sq.Expr("jsonb_set(COALESCE(props, '{}'::jsonb), '{autotranslation,enabled}', ?::jsonb)", enabledJSON)).
		Where(sq.Eq{"userid": userID, "channelid": channelID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.SetUserEnabled",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.SetUserEnabled",
			"store.sql_autotranslation.set_user_enabled.app_error", nil, err.Error(), 500)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.SetUserEnabled",
			"store.sql_autotranslation.set_user_enabled.app_error", nil, err.Error(), 500)
	}

	if rowsAffected == 0 {
		return model.NewAppError("SqlAutoTranslationStore.SetUserEnabled",
			"store.sql_autotranslation.member_not_found", nil,
			fmt.Sprintf("user_id=%s, channel_id=%s", userID, channelID), 404)
	}

	return nil
}

func (s *SqlAutoTranslationStore) GetUserLanguage(userID, channelID string) (string, *model.AppError) {
	query := s.getQueryBuilder().
		Select("u.locale").
		From("users u").
		Join("channelmembers cm ON u.id = cm.userid").
		Join("channels c ON cm.channelid = c.id").
		Where(sq.Eq{"u.id": userID, "c.id": channelID}).
		Where("COALESCE((c.props->'autotranslation'->>'enabled')::boolean, false) = true").
		Where("COALESCE((cm.props->'autotranslation'->>'enabled')::boolean, false) = true")

	queryString, args, err := query.ToSql()
	if err != nil {
		return "", model.NewAppError("SqlAutoTranslationStore.GetUserLanguage",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	var locale string
	if err := s.GetReplica().Get(&locale, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", model.NewAppError("SqlAutoTranslationStore.GetUserLanguage",
			"store.sql_autotranslation.get_user_language.app_error", nil, err.Error(), 500)
	}

	return locale, nil
}

func (s *SqlAutoTranslationStore) GetActiveDestinationLanguages(channelID, excludeUserID string, filterUserIDs *[]string) ([]string, *model.AppError) {
	query := s.getQueryBuilder().
		Select("DISTINCT u.locale").
		From("channelmembers cm").
		Join("channels c ON c.id = cm.channelid").
		Join("users u ON u.id = cm.userid").
		Where(sq.Eq{"cm.channelid": channelID}).
		Where("COALESCE((c.props->'autotranslation'->>'enabled')::boolean, false) = true").
		Where("COALESCE((cm.props->'autotranslation'->>'enabled')::boolean, false) = true")

	// Filter to specific user IDs if provided (e.g., users with active WebSocket connections)
	// When filterUserIDs is non-nil and non-empty, squirrel converts it to an IN clause
	// Example: WHERE cm.userid IN ('id1', 'id2', 'id3')
	if filterUserIDs != nil && len(*filterUserIDs) > 0 {
		query = query.Where(sq.Eq{"cm.userid": *filterUserIDs})
	}

	// Exclude specific user if provided (e.g., the message author)
	// This works together with the filter above via SQL AND logic
	// Example: WHERE cm.userid IN (...) AND cm.userid != 'excludedId'
	if excludeUserID != "" {
		query = query.Where(sq.NotEq{"cm.userid": excludeUserID})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.GetActiveDestinationLanguages",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	var languages []string
	if err := s.GetReplica().Select(&languages, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.GetActiveDestinationLanguages",
			"store.sql_autotranslation.get_active_languages.app_error", nil, err.Error(), 500)
	}

	return languages, nil
}

func (s *SqlAutoTranslationStore) Get(objectType, objectID, dstLang string) (*model.Translation, *model.AppError) {
	query := s.getQueryBuilder().
		Select("object_type", "object_id", "dst_lang", "provider_id", "norm_hash", "text", "confidence", "meta", "updateat").
		From("translations").
		Where(sq.Eq{"object_type": objectType, "object_id": objectID, "dst_lang": dstLang})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.Get",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	var translation Translation
	if err := s.GetReplica().Get(&translation, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, model.NewAppError("SqlAutoTranslationStore.Get",
			"store.sql_autotranslation.get.app_error", nil, err.Error(), 500)
	}

	var translationTypeStr string
	if v, ok := translation.Meta["type"]; ok {
		if s, ok := v.(string); ok {
			translationTypeStr = s
		}
	}
	result := &model.Translation{
		ObjectID:   translation.ObjectID,
		ObjectType: translation.ObjectType,
		Lang:       translation.DstLang,
		Type:       model.TranslationType(translationTypeStr),
		Text:       translation.Text,
		Confidence: translation.Confidence,
		State:      model.TranslationStateReady,
		NormHash:   &translation.NormHash,
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) Save(translation *model.Translation) *model.AppError {
	now := model.GetMillis()

	var metaJSON []byte
	var err error
	if translation.Meta != nil {
		metaJSON, err = json.Marshal(translation.Meta)
		if err != nil {
			return model.NewAppError("SqlAutoTranslationStore.Save",
				"store.sql_autotranslation.save.meta_marshal_error", nil, err.Error(), 500)
		}
	}

	contentSearchText := translation.Text
	if translation.Type == model.TranslationTypeObject && len(translation.ObjectJSON) > 0 {
		contentSearchText = string(translation.ObjectJSON)
	}

	objectType := string(translation.Type)
	objectID := translation.ObjectID
	dstLang := translation.Lang
	providerID := translation.Provider
	normHash := ""
	if translation.NormHash != nil {
		normHash = *translation.NormHash
	}
	text := contentSearchText
	confidence := translation.Confidence

	query := s.getQueryBuilder().
		Insert("translations").
		Columns("object_type", "object_id", "dst_lang", "provider_id", "norm_hash", "text", "confidence", "meta", "updateat", "content_search_text").
		Values(objectType, objectID, dstLang, providerID, normHash, text, confidence, metaJSON, now, contentSearchText).
		Suffix(`ON CONFLICT (object_type, object_id, dst_lang)
				DO UPDATE SET
					provider_id = EXCLUDED.provider_id,
					norm_hash = EXCLUDED.norm_hash,
					text = EXCLUDED.text,
					confidence = EXCLUDED.confidence,
					meta = EXCLUDED.meta,
					updateat = EXCLUDED.updateat,
					content_search_text = EXCLUDED.content_search_text`)

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.Save",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlAutoTranslationStore.Save",
			"store.sql_autotranslation.save.app_error", nil, err.Error(), 500)
	}

	return nil
}

func (s *SqlAutoTranslationStore) Search(dstLang, searchTerm string, limit int) ([]*model.Translation, *model.AppError) {
	ftsQuery := s.getQueryBuilder().
		Select("object_type", "object_id", "dst_lang", "text", "confidence", "meta").
		Column("ts_rank(to_tsvector('simple', COALESCE(content_search_text, text)), plainto_tsquery('simple', ?)) AS score", searchTerm).
		From("translations").
		Where(sq.Eq{"dst_lang": dstLang}).
		Where("to_tsvector('simple', COALESCE(content_search_text, text)) @@ plainto_tsquery('simple', ?)", searchTerm).
		OrderBy("score DESC").
		Limit(uint64(limit))

	queryString, args, err := ftsQuery.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.Search",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	type searchResult struct {
		ObjectType string         `db:"object_type"`
		ObjectID   string         `db:"object_id"`
		DstLang    string         `db:"dst_lang"`
		Text       string         `db:"text"`
		Confidence *float64       `db:"confidence"`
		Score      float64        `db:"score"`
		Meta       map[string]any `db:"meta"`
	}

	var results []searchResult
	if err := s.GetReplica().Select(&results, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.Search",
			"store.sql_autotranslation.search.app_error", nil, err.Error(), 500)
	}

	// Fallback to trigram similarity search if FTS returns no results
	if len(results) == 0 {
		trigramQuery := s.getQueryBuilder().
			Select("object_type", "object_id", "dst_lang", "text", "confidence").
			Column("similarity(COALESCE(content_search_text, text), ?) AS score", searchTerm).
			From("translations").
			Where(sq.Eq{"dst_lang": dstLang}).
			Where("COALESCE(content_search_text, text) ILIKE '%' || ? || '%'", searchTerm).
			OrderBy("score DESC").
			Limit(uint64(limit))

		queryString, args, err := trigramQuery.ToSql()
		if err != nil {
			return nil, model.NewAppError("SqlAutoTranslationStore.Search",
				"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
		}

		if err := s.GetReplica().Select(&results, queryString, args...); err != nil {
			return nil, model.NewAppError("SqlAutoTranslationStore.Search",
				"store.sql_autotranslation.search_trigram.app_error", nil, err.Error(), 500)
		}
	}

	translations := make([]*model.Translation, len(results))
	for i, result := range results {
		translations[i] = &model.Translation{
			ObjectID:   result.ObjectID,
			ObjectType: result.ObjectType,
			Lang:       result.DstLang,
			Type:       model.TranslationType(result.Meta["type"].(string)),
			Text:       result.Text,
			Confidence: result.Confidence,
			State:      model.TranslationStateReady,
		}
	}

	return translations, nil
}
