// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"maps"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type propertySyncTestHelper struct {
	*TestHelper
	t         *testing.T
	groupID   string
	adminRctx request.CTX
}

func setupPropertySyncTest(t *testing.T) *propertySyncTestHelper {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	group, appErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	return &propertySyncTestHelper{
		TestHelper: th,
		t:          t,
		groupID:    group.ID,
		adminRctx:  th.emptyContextWithCallerID(th.SystemAdminUser.Id),
	}
}

func ldapAttrs(attribute string) model.StringInterface {
	return model.StringInterface{model.PropertyFieldAttrLDAP: attribute}
}

func samlAttrs(attribute string) model.StringInterface {
	return model.StringInterface{model.PropertyFieldAttrSAML: attribute}
}

// createAttribute creates a Global Attribute the way Attribute Management
// does: a template carrying attrs (the sync link, any options) and the user
// field linking to it.
func (h *propertySyncTestHelper) createAttribute(fieldType model.PropertyFieldType, attrs model.StringInterface) (template, userField *model.PropertyField) {
	h.t.Helper()
	template = h.createTemplate(fieldType, attrs)
	return template, h.linkField(template, model.PropertyFieldObjectTypeUser, nil)
}

func (h *propertySyncTestHelper) createTemplate(fieldType model.PropertyFieldType, attrs model.StringInterface) *model.PropertyField {
	h.t.Helper()
	template, appErr := h.App.CreatePropertyField(h.adminRctx, &model.PropertyField{
		GroupID:    h.groupID,
		Name:       "attr_" + model.NewId(),
		Type:       fieldType,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      attrs,
	}, false, "")
	require.Nil(h.t, appErr)
	return template
}

// linkField creates the field of objectType that links to template.
func (h *propertySyncTestHelper) linkField(template *model.PropertyField, objectType string, attrs model.StringInterface) *model.PropertyField {
	h.t.Helper()
	field, appErr := h.App.CreatePropertyField(h.adminRctx, &model.PropertyField{
		GroupID:       h.groupID,
		Name:          template.Name,
		Type:          template.Type,
		ObjectType:    objectType,
		TargetType:    template.TargetType,
		LinkedFieldID: &template.ID,
		Attrs:         attrs,
	}, false, "")
	require.Nil(h.t, appErr)
	return field
}

// createField creates a user field that links to no template.
func (h *propertySyncTestHelper) createField(fieldType model.PropertyFieldType, attrs model.StringInterface) *model.PropertyField {
	h.t.Helper()
	field, appErr := h.App.CreatePropertyField(h.adminRctx, &model.PropertyField{
		GroupID:    h.groupID,
		Name:       string(fieldType) + "_" + model.NewId(),
		Type:       fieldType,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      attrs,
	}, false, "")
	require.Nil(h.t, appErr)
	return field
}

func (h *propertySyncTestHelper) updateAttrs(field *model.PropertyField, attrs model.StringInterface) {
	h.t.Helper()
	current := h.field(field.ID)
	maps.Copy(current.Attrs, attrs)
	_, _, appErr := h.App.UpdatePropertyField(h.adminRctx, h.groupID, current, false, "")
	require.Nil(h.t, appErr)
}

func (h *propertySyncTestHelper) syncer(source string) *PropertySyncer {
	h.t.Helper()
	s, appErr := h.App.NewPropertySyncer(request.TestContext(h.t), source)
	require.Nil(h.t, appErr)
	return s
}

func (h *propertySyncTestHelper) sync(s *PropertySyncer, userID string, attrs map[string][]string, prune bool) *model.PropertySyncResult {
	h.t.Helper()
	result, appErr := s.SyncUser(request.TestContext(h.t), userID, attrs, model.PropertySyncOptions{PruneOrphanedOptions: prune})
	require.Nil(h.t, appErr)
	require.NotNil(h.t, result)
	return result
}

func (h *propertySyncTestHelper) prune(s *PropertySyncer) *model.PropertySyncPruneResult {
	h.t.Helper()
	pruned, appErr := s.PruneOrphanedOptions(request.TestContext(h.t))
	require.Nil(h.t, appErr)
	return pruned
}

func (h *propertySyncTestHelper) field(id string) *model.PropertyField {
	h.t.Helper()
	field, appErr := h.App.GetPropertyField(h.adminRctx, h.groupID, id)
	require.Nil(h.t, appErr)
	return field
}

// optionNames returns the names of the options fieldID serves, in order: its
// template's for a linked field.
func (h *propertySyncTestHelper) optionNames(fieldID string) []string {
	h.t.Helper()
	names := []string{}
	for _, option := range h.options(fieldID) {
		names = append(names, option.Name)
	}
	return names
}

func (h *propertySyncTestHelper) optionID(fieldID, name string) string {
	h.t.Helper()
	for _, option := range h.options(fieldID) {
		if option.Name == name {
			return option.ID
		}
	}
	require.Failf(h.t, "option not found", "field %s has no option named %q", fieldID, name)
	return ""
}

func (h *propertySyncTestHelper) optionIDs(fieldID string, names ...string) []string {
	h.t.Helper()
	ids := make([]string, 0, len(names))
	for _, name := range names {
		ids = append(ids, h.optionID(fieldID, name))
	}
	return ids
}

func (h *propertySyncTestHelper) options(fieldID string) model.PropertyOptions[*model.CustomProfileAttributesSelectOption] {
	h.t.Helper()
	raw := h.field(fieldID).Attrs[model.PropertyFieldAttributeOptions]
	if raw == nil {
		return nil
	}
	options, err := model.NewPropertyOptionsFromFieldAttrs[*model.CustomProfileAttributesSelectOption](raw)
	require.NoError(h.t, err)
	return options
}

// value returns the user's stored value for the field, or nil when unset.
func (h *propertySyncTestHelper) value(userID, fieldID string) json.RawMessage {
	h.t.Helper()
	values, appErr := h.App.SearchPropertyValues(h.adminRctx, h.groupID, model.PropertyValueSearchOpts{
		GroupID:    h.groupID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetIDs:  []string{userID},
		FieldID:    fieldID,
		PerPage:    10,
	})
	require.Nil(h.t, appErr)
	if len(values) == 0 {
		return nil
	}
	require.Len(h.t, values, 1)
	return values[0].Value
}

func (h *propertySyncTestHelper) valueString(userID, fieldID string) string {
	h.t.Helper()
	raw := h.value(userID, fieldID)
	if model.IsEmptyPropertyValue(raw) {
		return ""
	}
	var s string
	require.NoError(h.t, json.Unmarshal(raw, &s))
	return s
}

func (h *propertySyncTestHelper) valueStrings(userID, fieldID string) []string {
	h.t.Helper()
	raw := h.value(userID, fieldID)
	if model.IsEmptyPropertyValue(raw) {
		return nil
	}
	var s []string
	require.NoError(h.t, json.Unmarshal(raw, &s))
	return s
}

func (h *propertySyncTestHelper) setChannelValue(field *model.PropertyField, channelID, raw string) {
	h.t.Helper()
	_, appErr := h.App.UpsertPropertyValues(h.adminRctx, []*model.PropertyValue{{
		GroupID:    h.groupID,
		TargetType: model.PropertyValueTargetTypeChannel,
		TargetID:   channelID,
		FieldID:    field.ID,
		Value:      json.RawMessage(raw),
	}}, model.PropertyFieldObjectTypeChannel, channelID, "")
	require.Nil(h.t, appErr)
}

func outcomeFor(t *testing.T, result *model.PropertySyncResult, fieldID string) model.PropertySyncFieldOutcome {
	t.Helper()
	for _, f := range result.Fields {
		if f.FieldID == fieldID {
			return f
		}
	}
	require.Failf(t, "outcome not found", "no outcome for field %s", fieldID)
	return model.PropertySyncFieldOutcome{}
}

func syncedFieldIDs(result *model.PropertySyncResult) []string {
	ids := make([]string, 0, len(result.Fields))
	for _, f := range result.Fields {
		ids = append(ids, f.FieldID)
	}
	return ids
}

func TestNewPropertySyncer(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)
	user := h.BasicUser.Id

	t.Run("rejects an unknown source", func(t *testing.T) {
		_, appErr := h.App.NewPropertySyncer(request.TestContext(t), "oauth")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.property_sync.invalid_source.app_error", appErr.Id)
	})

	t.Run("syncs the user fields whose definition names its source, ordered by name", func(t *testing.T) {
		_, linkedText := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))
		_, linkedMulti := h.createAttribute(model.PropertyFieldTypeMultiselect, ldapAttrs("memberOf"))
		standalone := h.createField(model.PropertyFieldTypeSelect, ldapAttrs("department"))
		h.createAttribute(model.PropertyFieldTypeText, samlAttrs("groups"))
		h.createAttribute(model.PropertyFieldTypeText, nil)

		s := h.syncer(model.PropertySyncSourceLDAP)
		assert.True(t, s.HasMappings())
		assert.Equal(t, []string{"department", "memberOf"}, s.ExternalAttributes())

		result := h.sync(s, user, nil, false)
		assert.ElementsMatch(t, []string{linkedText.ID, linkedMulti.ID, standalone.ID}, syncedFieldIDs(result))
		names := []string{}
		for _, f := range result.Fields {
			names = append(names, f.FieldName)
		}
		assert.IsNonDecreasing(t, names)
	})

	t.Run("follows a sync link added to the template after the user field linked to it", func(t *testing.T) {
		// Attribute Management edits the template only; the user field keeps
		// the copy of the link it was created with, here none.
		template, userField := h.createAttribute(model.PropertyFieldTypeText, nil)
		h.updateAttrs(template, ldapAttrs("title"))
		require.NotContains(t, h.field(userField.ID).Attrs, model.PropertyFieldAttrLDAP)

		s := h.syncer(model.PropertySyncSourceLDAP)
		assert.Contains(t, s.ExternalAttributes(), "title")
		result := h.sync(s, user, map[string][]string{"title": {"Engineer"}}, false)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, userField.ID).Status)
		assert.Equal(t, "Engineer", h.valueString(user, userField.ID))
	})

	t.Run("a definition naming both sources is synced from AD/LDAP only", func(t *testing.T) {
		_, both := h.createAttribute(model.PropertyFieldTypeText, model.StringInterface{
			model.PropertyFieldAttrLDAP: "department",
			model.PropertyFieldAttrSAML: "department",
		})
		assert.Contains(t, syncedFieldIDs(h.sync(h.syncer(model.PropertySyncSourceLDAP), user, nil, false)), both.ID)
		assert.NotContains(t, syncedFieldIDs(h.sync(h.syncer(model.PropertySyncSourceSAML), user, nil, false)), both.ID)
	})

	t.Run("ignores fields whose type cannot be synced", func(t *testing.T) {
		legacy, err := h.Store.PropertyField().Create(&model.PropertyField{
			GroupID:    h.groupID,
			Name:       "legacy_rank_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttrLDAP:         "level",
				model.PropertyFieldAttributeOptions: []any{map[string]any{"id": model.NewId(), "name": "low", "rank": 1}},
			},
		})
		require.NoError(t, err)

		s := h.syncer(model.PropertySyncSourceLDAP)
		assert.NotContains(t, s.ExternalAttributes(), "level")
		assert.NotContains(t, syncedFieldIDs(h.sync(s, user, nil, false)), legacy.ID)
	})
}

func TestPropertySyncer_NoMappings(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)
	h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))

	s := h.syncer(model.PropertySyncSourceSAML)
	assert.False(t, s.HasMappings())
	assert.Empty(t, s.ExternalAttributes())

	result := h.sync(s, h.BasicUser.Id, map[string][]string{"department": {"x"}}, true)
	assert.Empty(t, result.Fields)
	assert.False(t, result.Changed())
}

func TestPropertySyncer_SyncUser_InvalidUser(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)
	s := h.syncer(model.PropertySyncSourceLDAP)

	_, appErr := s.SyncUser(request.TestContext(t), "not-an-id", nil, model.PropertySyncOptions{})
	require.NotNil(t, appErr)
	assert.Equal(t, "app.property_sync.invalid_user_id.app_error", appErr.Id)
}

func TestPropertySyncer_SyncUser_Text(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	_, field := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))
	emailTemplate := h.createTemplate(model.PropertyFieldTypeText, model.StringInterface{
		model.PropertyFieldAttrLDAP:      "mail",
		model.PropertyFieldAttrValueType: "email",
	})
	email := h.linkField(emailTemplate, model.PropertyFieldObjectTypeUser, model.StringInterface{model.PropertyFieldAttrValueType: "email"})
	s := h.syncer(model.PropertySyncSourceLDAP)
	user := h.BasicUser.Id

	t.Run("stores the first value and trims it", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{"department": {"  Engineering ", "Sales"}, "mail": {"a@b.com"}}, false)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, email.ID).Status)
		assert.Equal(t, "Engineering", h.valueString(user, field.ID))
		assert.Equal(t, "a@b.com", h.valueString(user, email.ID))
		assert.True(t, result.Changed())
	})

	t.Run("does not write when the value already matches", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{"department": {"Engineering"}, "mail": {"a@b.com"}}, false)
		assert.Equal(t, model.PropertySyncFieldUnchanged, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, model.PropertySyncFieldUnchanged, outcomeFor(t, result, email.ID).Status)
		assert.False(t, result.Changed())
	})

	t.Run("skips a value over the text limit and keeps the stored one", func(t *testing.T) {
		long := strings.Repeat("x", model.PropertyFieldValueTypeTextMaxLength+1)
		result := h.sync(s, user, map[string][]string{"department": {long}, "mail": {"a@b.com"}}, false)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldSkipped, outcome.Status)
		assert.Equal(t, []string{long}, outcome.DroppedValues)
		assert.NotEmpty(t, outcome.Reason)
		assert.Equal(t, "Engineering", h.valueString(user, field.ID))
	})

	t.Run("skips a value that violates the field's value_type without quoting it", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{"department": {"Engineering"}, "mail": {"not-an-email"}}, false)
		outcome := outcomeFor(t, result, email.ID)
		assert.Equal(t, model.PropertySyncFieldSkipped, outcome.Status)
		assert.Contains(t, outcome.Reason, "email")
		assert.NotContains(t, outcome.Reason, "not-an-email")
		assert.Equal(t, "a@b.com", h.valueString(user, email.ID))
	})

	t.Run("clears the value when the attribute is absent or empty", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{"mail": {"", "  "}}, false)
		assert.Equal(t, model.PropertySyncFieldCleared, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, model.PropertySyncFieldCleared, outcomeFor(t, result, email.ID).Status)
		assert.Equal(t, "", h.valueString(user, field.ID))
		assert.Equal(t, "", h.valueString(user, email.ID))

		again := h.sync(s, user, nil, false)
		assert.Equal(t, model.PropertySyncFieldUnchanged, outcomeFor(t, again, field.ID).Status)
	})
}

func TestPropertySyncer_SyncUser_Select(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	template, field := h.createAttribute(model.PropertyFieldTypeSelect, samlAttrs("department"))
	s := h.syncer(model.PropertySyncSourceSAML)
	user1, user2 := h.BasicUser.Id, h.BasicUser2.Id

	t.Run("creates the option on the template on first sight and stores its ID", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"department": {"Engineering", "ignored second value"}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 1, outcome.OptionsCreated)
		assert.Equal(t, 1, result.OptionsCreated)

		assert.Equal(t, []string{"Engineering"}, h.optionNames(template.ID))
		assert.Equal(t, []string{"Engineering"}, h.optionNames(field.ID), "the user field serves its template's options")
		assert.Equal(t, h.optionID(template.ID, "Engineering"), h.valueString(user1, field.ID))
	})

	t.Run("reuses an existing option for another user", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"department": {"Engineering"}}, true)
		assert.Equal(t, 0, outcomeFor(t, result, field.ID).OptionsCreated)
		assert.Equal(t, []string{"Engineering"}, h.optionNames(template.ID))
		assert.Equal(t, h.valueString(user1, field.ID), h.valueString(user2, field.ID))
	})

	t.Run("preserves case, so differently cased values are distinct options", func(t *testing.T) {
		h.sync(s, user2, map[string][]string{"department": {"engineering"}}, true)
		assert.Equal(t, []string{"Engineering", "engineering"}, h.optionNames(template.ID))
		assert.NotEqual(t, h.valueString(user1, field.ID), h.valueString(user2, field.ID))
	})

	t.Run("moving a user prunes the option nobody holds any more", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"department": {"Sales"}}, true)
		assert.Equal(t, 1, result.OptionsPruned)
		assert.Equal(t, []string{"Engineering", "Sales"}, h.optionNames(template.ID))
	})

	t.Run("an option still held by another user survives pruning", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"department": {"Engineering"}}, true)
		assert.Equal(t, 1, result.OptionsPruned, "Sales is orphaned")
		assert.Equal(t, []string{"Engineering"}, h.optionNames(template.ID))
		assert.Equal(t, h.valueString(user1, field.ID), h.valueString(user2, field.ID))
	})

	t.Run("absent attribute clears the value and prunes when requested", func(t *testing.T) {
		h.sync(s, user1, nil, true)
		assert.Equal(t, "", h.valueString(user1, field.ID))
		assert.Equal(t, []string{"Engineering"}, h.optionNames(template.ID), "user2 still holds it")

		result := h.sync(s, user2, map[string][]string{}, true)
		assert.Equal(t, model.PropertySyncFieldCleared, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, 1, result.OptionsPruned)
		assert.Empty(t, h.optionNames(template.ID))
	})

	t.Run("skips a value longer than an option name may be", func(t *testing.T) {
		long := strings.Repeat("x", model.CPAOptionNameMaxLength+1)
		result := h.sync(s, user1, map[string][]string{"department": {long}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldSkipped, outcome.Status)
		assert.Equal(t, []string{long}, outcome.DroppedValues)
		assert.Empty(t, h.optionNames(template.ID))
	})
}

func TestPropertySyncer_SyncUser_Multiselect(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	template, field := h.createAttribute(model.PropertyFieldTypeMultiselect, ldapAttrs("memberOf"))
	s := h.syncer(model.PropertySyncSourceLDAP)
	user1, user2 := h.BasicUser.Id, h.BasicUser2.Id

	t.Run("creates every value as an option, in source order, and stores all IDs", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {"sales", "Engineering", "Engineering", " ", "admins"}}, false)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 3, outcome.OptionsCreated)
		assert.Empty(t, outcome.DroppedValues)

		assert.Equal(t, []string{"sales", "Engineering", "admins"}, h.optionNames(template.ID))
		assert.Equal(t, h.optionIDs(template.ID, "sales", "Engineering", "admins"), h.valueStrings(user1, field.ID))
	})

	t.Run("source order does not matter", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {"Engineering", "admins", "sales"}}, false)
		assert.Equal(t, model.PropertySyncFieldUnchanged, outcomeFor(t, result, field.ID).Status)
	})

	t.Run("a second user shares options and adds new ones", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"memberOf": {"sales", "support"}}, false)
		assert.Equal(t, 1, outcomeFor(t, result, field.ID).OptionsCreated)
		assert.Equal(t, []string{"sales", "Engineering", "admins", "support"}, h.optionNames(template.ID))
		assert.Equal(t, h.optionIDs(template.ID, "sales", "support"), h.valueStrings(user2, field.ID))
	})

	t.Run("without pruning, options a user lost stay until PruneOrphanedOptions runs", func(t *testing.T) {
		orphaned := h.optionIDs(template.ID, "Engineering", "admins")
		result := h.sync(s, user1, map[string][]string{"memberOf": {"sales"}}, false)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, 0, result.OptionsPruned)
		assert.Len(t, h.optionNames(template.ID), 4)

		pruned := h.prune(s)
		require.Len(t, pruned.Fields, 1)
		assert.Equal(t, template.ID, pruned.Fields[0].FieldID, "options are pruned from the template that owns them")
		assert.Equal(t, template.Name, pruned.Fields[0].FieldName)
		assert.ElementsMatch(t, orphaned, pruned.Fields[0].OptionIDs)
		assert.Equal(t, 2, pruned.OptionsPruned())
		assert.Equal(t, []string{"sales", "support"}, h.optionNames(template.ID))

		assert.Empty(t, h.prune(s).Fields)
	})

	t.Run("with pruning, an option disappears with its last holder", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"memberOf": {"sales"}}, true)
		assert.Equal(t, 1, result.OptionsPruned)
		assert.Equal(t, []string{"sales"}, h.optionNames(template.ID))
	})

	t.Run("drops over-long values but syncs the rest", func(t *testing.T) {
		long := strings.Repeat("y", model.CPAOptionNameMaxLength+1)
		result := h.sync(s, user1, map[string][]string{"memberOf": {"sales", long, "qa"}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, []string{long}, outcome.DroppedValues)
		assert.NotEmpty(t, outcome.Reason)
		assert.Equal(t, h.optionIDs(template.ID, "sales", "qa"), h.valueStrings(user1, field.ID))
	})

	t.Run("empty attribute clears the value and prunes", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {}}, true)
		assert.Equal(t, model.PropertySyncFieldCleared, outcomeFor(t, result, field.ID).Status)
		assert.Nil(t, h.valueStrings(user1, field.ID))
		assert.Equal(t, []string{"sales"}, h.optionNames(template.ID), "user2 still holds sales; qa is gone")
	})
}

// TestPropertySyncer_SharedWithChannels covers the reason options live on the
// template: a channel field linked to the same attribute serves them, and a
// channel's value keeps an option as surely as a user's does.
func TestPropertySyncer_SharedWithChannels(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	template, userField := h.createAttribute(model.PropertyFieldTypeMultiselect, ldapAttrs("memberOf"))
	channelField := h.linkField(template, model.PropertyFieldObjectTypeChannel, nil)
	require.False(t, model.IsPropertyFieldSynced(channelField), "no sync writes channel values, so the channel field is not sync-locked")

	s := h.syncer(model.PropertySyncSourceLDAP)
	h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"dev", "ops"}}, false)

	t.Run("a channel field linked to the template offers the options the sync created", func(t *testing.T) {
		assert.Equal(t, []string{"dev", "ops"}, h.optionNames(channelField.ID))
		assert.NotContains(t, syncedFieldIDs(h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"dev", "ops"}}, false)), channelField.ID)
	})

	t.Run("a channel's value keeps an option no user holds", func(t *testing.T) {
		h.setChannelValue(channelField, h.BasicChannel.Id, `["`+h.optionID(template.ID, "ops")+`"]`)
		h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"dev"}}, false)

		assert.Empty(t, h.prune(s).Fields)
		assert.Equal(t, []string{"dev", "ops"}, h.optionNames(template.ID))
		assert.Equal(t, h.optionIDs(template.ID, "dev"), h.valueStrings(h.BasicUser.Id, userField.ID))
	})

	t.Run("the option goes once the channel lets go of it too", func(t *testing.T) {
		ops := h.optionID(template.ID, "ops")
		h.setChannelValue(channelField, h.BasicChannel.Id, `[]`)

		pruned := h.prune(s)
		require.Len(t, pruned.Fields, 1)
		assert.Equal(t, []string{ops}, pruned.Fields[0].OptionIDs)
		assert.Equal(t, []string{"dev"}, h.optionNames(channelField.ID))
	})
}

func TestPropertySyncer_StandaloneField(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	field := h.createField(model.PropertyFieldTypeMultiselect, ldapAttrs("memberOf"))
	s := h.syncer(model.PropertySyncSourceLDAP)

	h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"dev", "ops"}}, false)
	assert.Equal(t, []string{"dev", "ops"}, h.optionNames(field.ID), "a field linking to no template owns its options")
	assert.Equal(t, h.optionIDs(field.ID, "dev", "ops"), h.valueStrings(h.BasicUser.Id, field.ID))

	h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"dev"}}, false)
	pruned := h.prune(s)
	require.Len(t, pruned.Fields, 1)
	assert.Equal(t, field.ID, pruned.Fields[0].FieldID)
	assert.Equal(t, []string{"dev"}, h.optionNames(field.ID))
}

func TestPropertySyncer_OptionCap(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	nearlyFull := func(source model.StringInterface) model.StringInterface {
		options := make([]*model.CustomProfileAttributesSelectOption, 0, model.PropertySyncMaxOptionsPerField-1)
		for i := range model.PropertySyncMaxOptionsPerField - 1 {
			options = append(options, &model.CustomProfileAttributesSelectOption{Name: fmt.Sprintf("group-%03d", i)})
		}
		source[model.PropertyFieldAttributeOptions] = options
		return source
	}
	multiTemplate, multi := h.createAttribute(model.PropertyFieldTypeMultiselect, nearlyFull(ldapAttrs("memberOf")))
	singleTemplate, single := h.createAttribute(model.PropertyFieldTypeSelect, nearlyFull(ldapAttrs("department")))

	s := h.syncer(model.PropertySyncSourceLDAP)
	user := h.BasicUser.Id

	t.Run("multiselect creates up to the cap and drops the rest", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{
			"memberOf":   {"group-000", "new-a", "new-b", "new-c"},
			"department": {"group-000"},
		}, false)
		outcome := outcomeFor(t, result, multi.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 1, outcome.OptionsCreated)
		assert.Equal(t, []string{"new-b", "new-c"}, outcome.DroppedValues)
		assert.Contains(t, outcome.Reason, "maximum")
		assert.Len(t, h.options(multiTemplate.ID), model.PropertySyncMaxOptionsPerField)
		assert.Equal(t, h.optionIDs(multiTemplate.ID, "group-000", "new-a"), h.valueStrings(user, multi.ID))
	})

	t.Run("select at the cap skips an unknown value", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{"department": {"brand-new"}, "memberOf": {"group-000"}}, false)
		outcome := outcomeFor(t, result, single.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status, "one below the cap: brand-new is created")
		assert.Equal(t, 1, outcome.OptionsCreated)

		result = h.sync(s, user, map[string][]string{"department": {"another-new"}, "memberOf": {"group-000"}}, false)
		outcome = outcomeFor(t, result, single.ID)
		assert.Equal(t, model.PropertySyncFieldSkipped, outcome.Status)
		assert.Equal(t, []string{"another-new"}, outcome.DroppedValues)
		assert.Equal(t, h.optionID(singleTemplate.ID, "brand-new"), h.valueString(user, single.ID), "stored value is left alone")
	})
}

func TestPropertySyncer_ConcurrentSyncers(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	template, field := h.createAttribute(model.PropertyFieldTypeMultiselect, samlAttrs("groups"))

	// Two logins on two nodes: both syncers hold the same (empty) view of the options.
	a := h.syncer(model.PropertySyncSourceSAML)
	b := h.syncer(model.PropertySyncSourceSAML)

	h.sync(b, h.BasicUser2.Id, map[string][]string{"groups": {"shared", "only-b"}}, true)

	t.Run("a stale syncer converges on the option the other one created", func(t *testing.T) {
		result := h.sync(a, h.BasicUser.Id, map[string][]string{"groups": {"shared", "only-a"}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 1, outcome.OptionsCreated, "only-a; shared already existed")

		assert.ElementsMatch(t, []string{"shared", "only-b", "only-a"}, h.optionNames(template.ID))
		shared := h.optionID(template.ID, "shared")
		assert.Contains(t, h.valueStrings(h.BasicUser.Id, field.ID), shared)
		assert.Contains(t, h.valueStrings(h.BasicUser2.Id, field.ID), shared)
	})

	t.Run("a stale syncer does not resurrect options pruned by the other one", func(t *testing.T) {
		// b drops only-b for user2 and prunes it; a's view still has it.
		h.sync(b, h.BasicUser2.Id, map[string][]string{"groups": {"shared"}}, true)
		assert.ElementsMatch(t, []string{"shared", "only-a"}, h.optionNames(template.ID))

		result := h.sync(a, h.BasicUser.Id, map[string][]string{"groups": {"shared"}}, true)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, []string{"shared"}, h.optionNames(template.ID))
	})
}

func TestPropertySyncer_FieldIsolation(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	_, text := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))

	// Only its source plugin may change a protected field, so the sync can
	// neither provision its options nor write its values.
	none := model.PermissionLevelNone
	protectedField, err := h.Store.PropertyField().Create(&model.PropertyField{
		GroupID:         h.groupID,
		Name:            "protected_" + model.NewId(),
		Type:            model.PropertyFieldTypeMultiselect,
		ObjectType:      model.PropertyFieldObjectTypeUser,
		TargetType:      string(model.PropertyFieldTargetLevelSystem),
		Protected:       true,
		PermissionField: &none,
		Attrs: model.StringInterface{
			model.PropertyFieldAttrLDAP:       "memberOf",
			model.PropertyAttrsProtected:      true,
			model.PropertyAttrsSourcePluginID: "com.example.plugin",
		},
	})
	require.NoError(t, err)

	s := h.syncer(model.PropertySyncSourceLDAP)
	result := h.sync(s, h.BasicUser.Id, map[string][]string{"department": {"Engineering"}, "memberOf": {"x"}}, false)

	assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, text.ID).Status)
	assert.Equal(t, "Engineering", h.valueString(h.BasicUser.Id, text.ID))

	failed := outcomeFor(t, result, protectedField.ID)
	assert.Equal(t, model.PropertySyncFieldError, failed.Status)
	assert.NotEmpty(t, failed.Reason)
	assert.True(t, result.HasErrors())
}

func TestPropertySyncer_FieldDeletedDuringRun(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	_, deleted := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))
	_, kept := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("title"))
	s := h.syncer(model.PropertySyncSourceLDAP)
	require.Nil(t, h.App.DeletePropertyField(h.adminRctx, h.groupID, deleted.ID, false, ""))

	attrs := map[string][]string{"department": {"Engineering"}, "title": {"Engineer"}}
	result := h.sync(s, h.BasicUser.Id, attrs, false)
	assert.Equal(t, model.PropertySyncFieldError, outcomeFor(t, result, deleted.ID).Status)
	assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, kept.ID).Status)
	assert.Nil(t, h.value(h.BasicUser.Id, deleted.ID), "no value is written for a deleted field")

	result = h.sync(s, h.BasicUser2.Id, attrs, false)
	assert.Equal(t, []string{kept.ID}, syncedFieldIDs(result), "the deleted field is no longer synced for the rest of the run")
}

func TestPropertySyncer_AdminManagedField(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	template := h.createTemplate(model.PropertyFieldTypeMultiselect, ldapAttrs("memberOf"))
	field := h.linkField(template, model.PropertyFieldObjectTypeUser, model.StringInterface{model.PropertyFieldAttrManaged: "admin"})
	s := h.syncer(model.PropertySyncSourceLDAP)

	result := h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"a", "b"}}, true)
	assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
	assert.Equal(t, []string{"a", "b"}, h.optionNames(template.ID))
	assert.Equal(t, "admin", h.field(field.ID).Attrs[model.PropertyFieldAttrManaged])

	result = h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"a"}}, true)
	assert.Equal(t, 1, result.OptionsPruned)
	assert.Equal(t, []string{"a"}, h.optionNames(template.ID))
}

func TestPropertySyncer_PrunesOptionsAuthoredBeforeTheLink(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	template, field := h.createAttribute(model.PropertyFieldTypeSelect, model.StringInterface{
		model.PropertyFieldAttributeOptions: []*model.CustomProfileAttributesSelectOption{{Name: "Legacy"}, {Name: "Kept"}},
	})
	keptID, legacyID := h.optionID(template.ID, "Kept"), h.optionID(template.ID, "Legacy")
	_, appErr := h.App.UpsertPropertyValues(h.adminRctx, []*model.PropertyValue{{
		GroupID:    h.groupID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetID:   h.BasicUser2.Id,
		FieldID:    field.ID,
		Value:      json.RawMessage(`"` + keptID + `"`),
	}}, model.PropertyFieldObjectTypeUser, h.BasicUser2.Id, "")
	require.Nil(t, appErr)

	h.updateAttrs(template, ldapAttrs("department"))

	s := h.syncer(model.PropertySyncSourceLDAP)
	h.sync(s, h.BasicUser.Id, map[string][]string{"department": {"Kept"}}, false)
	assert.Equal(t, keptID, h.valueString(h.BasicUser.Id, field.ID), "the sync matched the admin-authored option by name")

	pruned := h.prune(s)
	require.Len(t, pruned.Fields, 1)
	assert.Equal(t, []string{legacyID}, pruned.Fields[0].OptionIDs)
	assert.Equal(t, []string{"Kept"}, h.optionNames(template.ID))
}

func TestPropertySyncer_BroadcastWithholdsRestrictedValues(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	_, field := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))

	// The API only allows a restricted access mode on a protected field, which a
	// sync cannot write; an owner-managed field can be both. A store write
	// stands in for that setup here.
	stored, err := h.Store.PropertyField().Get(request.TestContext(t), h.groupID, field.ID)
	require.NoError(t, err)
	stored.Attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModeSourceOnly
	_, err = h.Store.PropertyField().Update(h.groupID, []*model.PropertyField{stored}, nil)
	require.NoError(t, err)

	messages, closeWS := connectFakeWebSocket(t, h.TestHelper, h.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventCPAValuesUpdated})
	defer closeWS()

	s := h.syncer(model.PropertySyncSourceLDAP)
	result := h.sync(s, h.BasicUser.Id, map[string][]string{"department": {"Secret"}}, false)
	require.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)

	select {
	case event := <-messages:
		assert.Equal(t, h.BasicUser.Id, event.GetData()["user_id"])
		values, err := json.Marshal(event.GetData()["values"])
		require.NoError(t, err)
		var byField map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(values, &byField))
		assert.JSONEq(t, model.PropertyValueWithheldJSON, string(byField[field.ID]))
	case <-time.After(5 * time.Second):
		require.Fail(t, "the custom profile attribute event was not published")
	}
}

func TestPropertySyncHelpers(t *testing.T) {
	t.Run("normalizeSourceValues", func(t *testing.T) {
		assert.Equal(t, []string{}, normalizeSourceValues(nil))
		assert.Equal(t, []string{"a", "B", "c"}, normalizeSourceValues([]string{" a ", "", "B", "a", "  ", "c"}))
	})

	t.Run("propertyValueChanged", func(t *testing.T) {
		v := func(raw string) *model.PropertyValue { return &model.PropertyValue{Value: json.RawMessage(raw)} }

		assert.False(t, propertyValueChanged(model.PropertyFieldTypeText, nil, json.RawMessage(`""`)))
		assert.False(t, propertyValueChanged(model.PropertyFieldTypeText, v(`null`), json.RawMessage(`""`)))
		assert.False(t, propertyValueChanged(model.PropertyFieldTypeMultiselect, v(`[]`), json.RawMessage(`[]`)))
		assert.True(t, propertyValueChanged(model.PropertyFieldTypeText, nil, json.RawMessage(`"a"`)))
		assert.True(t, propertyValueChanged(model.PropertyFieldTypeText, v(`"a"`), json.RawMessage(`""`)))
		assert.False(t, propertyValueChanged(model.PropertyFieldTypeText, v(`"a"`), json.RawMessage(`"a"`)))
		assert.True(t, propertyValueChanged(model.PropertyFieldTypeText, v(`"a"`), json.RawMessage(`"A"`)))
		assert.False(t, propertyValueChanged(model.PropertyFieldTypeMultiselect, v(`["x","y"]`), json.RawMessage(`["y","x"]`)))
		assert.True(t, propertyValueChanged(model.PropertyFieldTypeMultiselect, v(`["x","y"]`), json.RawMessage(`["x"]`)))
		assert.True(t, propertyValueChanged(model.PropertyFieldTypeMultiselect, v(`"legacy-text"`), json.RawMessage(`["x"]`)))
	})

	t.Run("lostOptionReferences", func(t *testing.T) {
		v := func(raw string) *model.PropertyValue { return &model.PropertyValue{Value: json.RawMessage(raw)} }

		assert.False(t, lostOptionReferences(nil, json.RawMessage(`["x"]`)))
		assert.False(t, lostOptionReferences(v(`[]`), json.RawMessage(`[]`)))
		assert.False(t, lostOptionReferences(v(`["x"]`), json.RawMessage(`["x","y"]`)))
		assert.True(t, lostOptionReferences(v(`["x","y"]`), json.RawMessage(`["x"]`)))
		assert.True(t, lostOptionReferences(v(`"x"`), json.RawMessage(`""`)))
		assert.False(t, lostOptionReferences(v(`"x"`), json.RawMessage(`"x"`)))
	})

	t.Run("optionIDsFromValue", func(t *testing.T) {
		ids, err := optionIDsFromValue(json.RawMessage(`"x"`))
		require.NoError(t, err)
		assert.Equal(t, []string{"x"}, ids)

		ids, err = optionIDsFromValue(json.RawMessage(`["x","y"]`))
		require.NoError(t, err)
		assert.Equal(t, []string{"x", "y"}, ids)

		ids, err = optionIDsFromValue(json.RawMessage(`null`))
		require.NoError(t, err)
		assert.Empty(t, ids)

		_, err = optionIDsFromValue(json.RawMessage(`{"a":1}`))
		require.Error(t, err)
	})
}
