// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"maps"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

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
func (s *SqlAutoTranslationStore) IsChannelEnabled(channelID string) (bool, error) {
	query := s.getQueryBuilder().
		Select("AutoTranslation").
		From("Channels").
		Where(sq.Eq{"Id": channelID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, errors.Wrap(err, "failed to build query for IsChannelEnabled")
	}

	var enabled bool
	if err := s.GetReplica().Get(&enabled, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return false, store.NewErrNotFound("Channel", channelID)
		}
		return false, errors.Wrapf(err, "failed to get channel enabled status for channel_id=%s", channelID)
	}

	return enabled, nil
}

func (s *SqlAutoTranslationStore) SetChannelEnabled(channelID string, enabled bool) error {
	query := s.getQueryBuilder().
		Update("Channels").
		Set("AutoTranslation", enabled).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": channelID})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to set channel enabled for channel_id=%s", channelID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected for SetChannelEnabled")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("Channel", channelID)
	}

	return nil
}

func (s *SqlAutoTranslationStore) IsUserEnabled(userID, channelID string) (bool, error) {
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
		return false, errors.Wrapf(err, "failed to get user enabled status for user_id=%s, channel_id=%s", userID, channelID)
	}

	return enabled, nil
}

func (s *SqlAutoTranslationStore) SetUserEnabled(userID, channelID string, enabled bool) error {
	query := s.getQueryBuilder().
		Update("ChannelMembers").
		Set("AutoTranslation", enabled).
		Where(sq.Eq{"UserId": userID, "ChannelId": channelID})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to set user enabled for user_id=%s, channel_id=%s", userID, channelID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected for SetUserEnabled")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("ChannelMember", userID+":"+channelID)
	}

	return nil
}

func (s *SqlAutoTranslationStore) GetUserLanguage(userID, channelID string) (string, error) {
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
		return "", errors.Wrapf(err, "failed to get user language for user_id=%s, channel_id=%s", userID, channelID)
	}

	return locale, nil
}

func (s *SqlAutoTranslationStore) GetActiveDestinationLanguages(channelID, excludeUserID string, filterUserIDs []string) ([]string, error) {
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
		return nil, errors.Wrapf(err, "failed to get active destination languages for channel_id=%s", channelID)
	}

	return languages, nil
}

func (s *SqlAutoTranslationStore) Get(objectType, objectID, dstLang string) (*model.Translation, error) {
	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"ObjectType": objectType, "ObjectId": objectID, "DstLang": dstLang})

	var translation Translation
	if err := s.GetReplica().GetBuilder(&translation, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, errors.Wrapf(err, "failed to get translation for object_id=%s, dst_lang=%s", objectID, dstLang)
	}

	meta, err := translation.Meta.ToMap()
	var translationTypeStr string
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse translation meta for object_id=%s", objectID)
	}

	if v, ok := meta["type"]; ok {
		if s, ok := v.(string); ok {
			translationTypeStr = s
		}
	}

	result := &model.Translation{
		ObjectID:   translation.ObjectID,
		ObjectType: objectType,
		Lang:       translation.DstLang,
		Type:       model.TranslationType(translationTypeStr),
		Confidence: translation.Confidence,
		State:      model.TranslationState(translation.State),
		NormHash:   translation.NormHash,
		Meta:       meta,
	}

	if result.Type == model.TranslationTypeObject {
		result.ObjectJSON = json.RawMessage(translation.Text)
	} else {
		result.Text = translation.Text
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) GetBatch(objectType string, objectIDs []string, dstLang string) (map[string]*model.Translation, error) {
	if len(objectIDs) == 0 {
		return make(map[string]*model.Translation), nil
	}

	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"ObjectType": objectType, "ObjectId": objectIDs, "DstLang": dstLang})

	var translations []Translation
	if err := s.GetReplica().SelectBuilder(&translations, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get batch translations for dst_lang=%s", dstLang)
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

		modelT := &model.Translation{
			ObjectID:   t.ObjectID,
			ObjectType: objectType,
			Lang:       t.DstLang,
			Type:       model.TranslationType(translationTypeStr),
			Confidence: t.Confidence,
			State:      model.TranslationState(t.State),
			NormHash:   t.NormHash,
			Meta:       meta,
			UpdateAt:   t.UpdateAt,
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

func (s *SqlAutoTranslationStore) GetAllForObject(objectType, objectID string) ([]*model.Translation, error) {
	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"ObjectType": objectType, "ObjectId": objectID})

	var translations []Translation
	if err := s.GetReplica().SelectBuilder(&translations, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get all translations for object_id=%s", objectID)
	}

	result := make([]*model.Translation, 0, len(translations))
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

		modelT := &model.Translation{
			ObjectID:   t.ObjectID,
			ObjectType: objectType,
			Lang:       t.DstLang,
			Type:       model.TranslationType(translationTypeStr),
			Confidence: t.Confidence,
			State:      model.TranslationState(t.State),
			NormHash:   t.NormHash,
			Meta:       meta,
			UpdateAt:   t.UpdateAt,
		}

		if modelT.Type == model.TranslationTypeObject {
			modelT.ObjectJSON = json.RawMessage(t.Text)
		} else {
			modelT.Text = t.Text
		}

		result = append(result, modelT)
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) Save(translation *model.Translation) error {
	if err := translation.IsValid(); err != nil {
		return err
	}

	now := model.GetMillis()

	var err error
	text := translation.Text
	if translation.Type == model.TranslationTypeObject && len(translation.ObjectJSON) > 0 {
		text = string(translation.ObjectJSON)
	}

	objectType := translation.ObjectType
	if objectType == "" {
		objectType = model.TranslationObjectTypePost
	}

	objectID := translation.ObjectID

	// Preserve existing Meta fields and add/override "type"
	metaMap := make(map[string]any)
	if translation.Meta != nil {
		// Copy existing Meta fields (e.g., "src_lang", "error", etc.)
		maps.Copy(metaMap, translation.Meta)
	}
	// Always set "type" field
	metaMap["type"] = string(translation.Type)

	metaBytes, err := json.Marshal(metaMap)
	if err != nil {
		return errors.Wrap(err, "failed to marshal translation meta")
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
		Suffix(`ON CONFLICT (ObjectId, ObjectType, dstLang)
				DO UPDATE SET
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
		return errors.Wrapf(err, "failed to save translation for object_id=%s, lang=%s", objectID, dstLang)
	}

	return nil
}

func (s *SqlAutoTranslationStore) GetAllByStatePage(state model.TranslationState, offset int, limit int) ([]*model.Translation, error) {
	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"State": string(state)}).
		OrderBy("UpdateAt ASC").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	var translations []Translation
	if err := s.GetReplica().SelectBuilder(&translations, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get translations by state=%s", state)
	}

	result := make([]*model.Translation, 0, len(translations))
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
			objectType = model.TranslationObjectTypePost
		}

		modelT := &model.Translation{
			ObjectID:   t.ObjectID,
			ObjectType: objectType,
			Lang:       t.DstLang,
			Type:       model.TranslationType(translationTypeStr),
			Confidence: t.Confidence,
			State:      model.TranslationState(t.State),
			NormHash:   t.NormHash,
			Meta:       meta,
			UpdateAt:   t.UpdateAt,
		}

		if modelT.Type == model.TranslationTypeObject {
			modelT.ObjectJSON = json.RawMessage(t.Text)
		} else {
			modelT.Text = t.Text
		}

		result = append(result, modelT)
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) GetByStateOlderThan(state model.TranslationState, olderThanMillis int64, limit int) ([]*model.Translation, error) {
	query := s.getQueryBuilder().
		Select("ObjectType", "ObjectId", "DstLang", "ProviderId", "NormHash", "Text", "Confidence", "Meta", "State", "UpdateAt").
		From("Translations").
		Where(sq.Eq{"State": string(state)}).
		Where(sq.Lt{"UpdateAt": olderThanMillis}).
		OrderBy("UpdateAt ASC").
		Limit(uint64(limit))

	var translations []Translation
	if err := s.GetReplica().SelectBuilder(&translations, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get translations by state=%s older than %d", state, olderThanMillis)
	}

	result := make([]*model.Translation, 0, len(translations))
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
			objectType = model.TranslationObjectTypePost
		}

		modelT := &model.Translation{
			ObjectID:   t.ObjectID,
			ObjectType: objectType,
			Lang:       t.DstLang,
			Type:       model.TranslationType(translationTypeStr),
			Confidence: t.Confidence,
			State:      model.TranslationState(t.State),
			NormHash:   t.NormHash,
			Meta:       meta,
			UpdateAt:   t.UpdateAt,
		}

		if modelT.Type == model.TranslationTypeObject {
			modelT.ObjectJSON = json.RawMessage(t.Text)
		} else {
			modelT.Text = t.Text
		}

		result = append(result, modelT)
	}

	return result, nil
}

func (s *SqlAutoTranslationStore) ClearCaches() {}

func (s *SqlAutoTranslationStore) InvalidateUserAutoTranslation(userID, channelID string) {}

func (s *SqlAutoTranslationStore) InvalidateUserLocaleCache(userID string) {}
