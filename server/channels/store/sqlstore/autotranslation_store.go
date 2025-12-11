// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlAutoTranslationStore struct {
	*SqlStore
}

type TranslationMeta json.RawMessage

type Translation struct {
	ObjectType string
	ObjectID   string
	DstLang    string
	ProviderID string
	NormHash   string
	Text       string
	Confidence *float64
	Meta       TranslationMeta
	State      string
	UpdateAt   int64
}

func (m *TranslationMeta) ToMap() (map[string]any, error) {
	if m == nil {
		return nil, nil
	}
	var result map[string]any
	if err := json.Unmarshal(*m, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func newSqlAutoTranslationStore(sqlStore *SqlStore) store.AutoTranslationStore {
	return &SqlAutoTranslationStore{
		SqlStore: sqlStore,
	}
}

// IsChannelEnabled checks if auto-translation is enabled for a channel
// Uses the existing Channel cache instead of maintaining a separate cache
// Thus this method is really for completeness; callers should use the Channel cache
func (s *SqlAutoTranslationStore) IsChannelEnabled(channelID string) (bool, *model.AppError) {
	query := s.getQueryBuilder().
		Select("AutoTranslation").
		From("Channels").
		Where(sq.Eq{"Id": channelID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlAutoTranslationStore.IsChannelEnabled",
			"store.sql_autotranslation.query_build_error", nil, err.Error(), 500)
	}

	var enabled bool
	if err := s.GetReplica().Get(&enabled, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return false, model.NewAppError("SqlAutoTranslationStore.IsChannelEnabled",
				"store.sql_autotranslation.channel_not_found", nil, "channel_id="+channelID, 404)
		}
		return false, model.NewAppError("SqlAutoTranslationStore.IsChannelEnabled",
			"store.sql_autotranslation.get_channel_enabled.app_error", nil, err.Error(), 500)
	}

	return enabled, nil
}

func (s *SqlAutoTranslationStore) SetChannelEnabled(channelID string, enabled bool) *model.AppError {
	query := s.getQueryBuilder().
		Update("Channels").
		Set("AutoTranslation", enabled).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": channelID})

	result, err := s.GetMaster().ExecBuilder(query)
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
		Select("cm.AutoTranslation").
		From("ChannelMembers cm").
		Join("Channels c ON cm.Channelid = c.id").
		Where(sq.Eq{"cm.UserId": userID, "cm.ChannelId": channelID}).
		Where("c.AutoTranslation = true")

	var enabled bool
	if err := s.GetReplica().GetBuilder(&enabled, query); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, model.NewAppError("SqlAutoTranslationStore.IsUserEnabled",
			"store.sql_autotranslation.get_user_enabled.app_error", nil, err.Error(), 500)
	}

	return enabled, nil
}

func (s *SqlAutoTranslationStore) SetUserEnabled(userID, channelID string, enabled bool) *model.AppError {
	query := s.getQueryBuilder().
		Update("ChannelMembers").
		Set("AutoTranslation", enabled).
		Where(sq.Eq{"UserId": userID, "ChannelId": channelID})

	result, err := s.GetMaster().ExecBuilder(query)
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
			"user_id="+userID+", channel_id="+channelID, 404)
	}

	return nil
}

func (s *SqlAutoTranslationStore) GetUserLanguage(userID, channelID string) (string, *model.AppError) {
	query := s.getQueryBuilder().
		Select("u.Locale").
		From("Users u").
		Join("ChannelMembers cm ON u.Id = cm.UserId").
		Join("Channels c ON cm.ChannelId = c.Id").
		Where(sq.Eq{"u.Id": userID, "c.Id": channelID}).
		Where("c.AutoTranslation = true").
		Where("cm.AutoTranslation = true")

	var locale string
	if err := s.GetReplica().GetBuilder(&locale, query); err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", model.NewAppError("SqlAutoTranslationStore.GetUserLanguage",
			"store.sql_autotranslation.get_user_language.app_error", nil, err.Error(), 500)
	}

	return locale, nil
}

func (s *SqlAutoTranslationStore) GetActiveDestinationLanguages(channelID, excludeUserID string, filterUserIDs []string) ([]string, *model.AppError) {
	query := s.getQueryBuilder().
		Select("DISTINCT u.Locale").
		From("ChannelMembers cm").
		Join("Channels c ON c.Id = cm.ChannelId").
		Join("Users u ON u.Id = cm.UserId").
		Where(sq.Eq{"cm.ChannelId": channelID}).
		Where("c.AutoTranslation = true").
		Where("cm.AutoTranslation = true")

	// Filter to specific user IDs if provided (e.g., users with active WebSocket connections)
	// When filterUserIDs is non-nil and non-empty, squirrel converts it to an IN clause
	// Example: WHERE cm.userid IN ('id1', 'id2', 'id3')
	if len(filterUserIDs) > 0 {
		query = query.Where(sq.Eq{"cm.userid": filterUserIDs})
	}

	// Exclude specific user if provided (e.g., the message author)
	// This works together with the filter above via SQL AND logic
	// Example: WHERE cm.userid IN (...) AND cm.userid != 'excludedId'
	if excludeUserID != "" {
		query = query.Where(sq.NotEq{"cm.userid": excludeUserID})
	}

	var languages []string
	if err := s.GetReplica().SelectBuilder(&languages, query); err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.GetActiveDestinationLanguages",
			"store.sql_autotranslation.get_active_languages.app_error", nil, err.Error(), 500)
	}

	return languages, nil
}

func (s *SqlAutoTranslationStore) Get(objectID, dstLang string) (*model.Translation, *model.AppError) {
	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"ObjectId": objectID, "DstLang": dstLang})

	var translation Translation
	if err := s.GetReplica().GetBuilder(&translation, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, model.NewAppError("SqlAutoTranslationStore.Get",
			"store.sql_autotranslation.get.app_error", nil, err.Error(), 500)
	}

	meta, err := translation.Meta.ToMap()
	var translationTypeStr string
	if err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.Get",
			"store.sql_autotranslation.meta_json.app_error", nil, err.Error(), 500)
	}

	if v, ok := meta["type"]; ok {
		if s, ok := v.(string); ok {
			translationTypeStr = s
		}
	}

	// Default objectType to "post" if not set
	objectType := translation.ObjectType
	if objectType == "" {
		objectType = "post"
	}

	result := &model.Translation{
		ObjectID:   translation.ObjectID,
		ObjectType: objectType,
		Lang:       translation.DstLang,
		Type:       model.TranslationType(translationTypeStr),
		Confidence: translation.Confidence,
		State:      model.TranslationState(translation.State),
		NormHash:   translation.NormHash,
	}

	if result.Type == model.TranslationTypeObject {
		result.ObjectJSON = json.RawMessage(translation.Text)
	} else {
		result.Text = translation.Text
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) GetBatch(objectIDs []string, dstLang string) (map[string]*model.Translation, *model.AppError) {
	if len(objectIDs) == 0 {
		return make(map[string]*model.Translation), nil
	}

	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"ObjectId": objectIDs, "DstLang": dstLang})

	var translations []Translation
	if err := s.GetReplica().SelectBuilder(&translations, query); err != nil {
		return nil, model.NewAppError("SqlAutoTranslationStore.GetBatch",
			"store.sql_autotranslation.get_batch.app_error", nil, err.Error(), 500)
	}

	result := make(map[string]*model.Translation, len(translations))
	for _, t := range translations {
		var translationTypeStr string

		meta, err := t.Meta.ToMap()
		if err != nil {
			// Log error but continue with other translations
			continue
		}

		if v, ok := meta["type"]; ok {
			if s, ok := v.(string); ok {
				translationTypeStr = s
			}
		}

		// Default objectType to "post" if not set
		objectType := t.ObjectType
		if objectType == "" {
			objectType = "post"
		}

		modelT := &model.Translation{
			ObjectID:   t.ObjectID,
			ObjectType: objectType,
			Lang:       t.DstLang,
			Type:       model.TranslationType(translationTypeStr),
			Confidence: t.Confidence,
			State:      model.TranslationState(t.State),
			NormHash:   t.NormHash,
		}

		if modelT.Type == model.TranslationTypeObject {
			modelT.ObjectJSON = json.RawMessage(t.Text)
		} else {
			modelT.Text = t.Text
		}

		result[t.ObjectID] = modelT
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) Save(translation *model.Translation) *model.AppError {
	if err := translation.IsValid(); err != nil {
		return err
	}

	now := model.GetMillis()

	var err error
	text := translation.Text
	if translation.Type == model.TranslationTypeObject && len(translation.ObjectJSON) > 0 {
		text = string(translation.ObjectJSON)
	}

	var objectType *string
	if translation.ObjectType != "" {
		objectType = &translation.ObjectType
	}

	objectID := translation.ObjectID

	// Preserve existing Meta fields and add/override "type"
	metaMap := make(map[string]any)
	if translation.Meta != nil {
		// Copy existing Meta fields (e.g., "src_lang", "error", etc.)
		for k, v := range translation.Meta {
			metaMap[k] = v
		}
	}
	// Always set "type" field
	metaMap["type"] = string(translation.Type)

	metaBytes, err := json.Marshal(metaMap)
	if err != nil {
		return model.NewAppError("SqlAutoTranslationStore.Save",
			"store.sql_autotranslation.save.meta_json.app_error", nil, err.Error(), 500)
	}

	// Apply binary flag if enabled (required for PostgreSQL JSONB with binary_parameters=yes)
	if s.IsBinaryParamEnabled() {
		metaBytes = AppendBinaryFlag(metaBytes)
	}

	dstLang := translation.Lang
	providerID := translation.Provider
	confidence := translation.Confidence

	query := s.getQueryBuilder().
		Insert("Translations").
		Columns("ObjectId", "DstLang", "ObjectType", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		Values(objectID, dstLang, objectType, providerID, translation.NormHash, text, confidence, metaBytes, string(translation.State), now).
		Suffix(`ON CONFLICT (ObjectId, dstLang)
				DO UPDATE SET
					ObjectType = EXCLUDED.ObjectType,
					ProviderId = EXCLUDED.ProviderId,
					NormHash = EXCLUDED.NormHash,
					Text = EXCLUDED.Text,
					Confidence = EXCLUDED.Confidence,
					Meta = EXCLUDED.Meta,
					State = EXCLUDED.State,
					UpdateAt = EXCLUDED.UpdateAt
					WHERE Translations.NormHash IS DISTINCT FROM EXCLUDED.NormHash
					   OR Translations.State != EXCLUDED.State`)

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return model.NewAppError("SqlAutoTranslationStore.Save",
			"store.sql_autotranslation.save.app_error", nil, err.Error(), 500)
	}

	return nil
}

func (s *SqlAutoTranslationStore) ClearCaches() {}

func (s *SqlAutoTranslationStore) InvalidateUserAutoTranslation(userID, channelID string) {}

func (s *SqlAutoTranslationStore) InvalidateUserLocaleCache(userID string) {}
