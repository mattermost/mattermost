// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

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

func (h *propertySyncTestHelper) createField(fieldType model.PropertyFieldType, attrs model.CPAAttrs) *model.PropertyField {
	h.t.Helper()
	cpa := &model.CPAField{
		PropertyField: model.PropertyField{
			GroupID:    h.groupID,
			Name:       string(fieldType) + "_" + model.NewId(),
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		},
		Attrs: attrs,
	}
	created, appErr := h.App.CreatePropertyField(h.adminRctx, cpa.ToPropertyField(), false, "")
	require.Nil(h.t, appErr)
	return created
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

func (h *propertySyncTestHelper) field(id string) *model.PropertyField {
	h.t.Helper()
	field, appErr := h.App.GetPropertyField(h.adminRctx, h.groupID, id)
	require.Nil(h.t, appErr)
	return field
}

func (h *propertySyncTestHelper) options(fieldID string) model.PropertyOptions[*model.CustomProfileAttributesSelectOption] {
	h.t.Helper()
	options, err := propertyFieldOptions(h.field(fieldID))
	require.NoError(h.t, err)
	return options
}

func (h *propertySyncTestHelper) optionNames(fieldID string) []string {
	h.t.Helper()
	names := []string{}
	for _, opt := range h.options(fieldID) {
		names = append(names, opt.Name)
	}
	return names
}

func (h *propertySyncTestHelper) optionID(fieldID, name string) string {
	h.t.Helper()
	for _, opt := range h.options(fieldID) {
		if opt.Name == name {
			return opt.ID
		}
	}
	require.Failf(h.t, "option not found", "field %s has no option named %q", fieldID, name)
	return ""
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

func TestNewPropertySyncer(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	t.Run("rejects an unknown source", func(t *testing.T) {
		_, appErr := h.App.NewPropertySyncer(request.TestContext(t), "oauth")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.property_sync.invalid_source.app_error", appErr.Id)
	})

	t.Run("loads only the user fields linked to its source, sorted by name", func(t *testing.T) {
		ldapText := h.createField(model.PropertyFieldTypeText, model.CPAAttrs{LDAP: "department"})
		ldapMulti := h.createField(model.PropertyFieldTypeMultiselect, model.CPAAttrs{LDAP: "memberOf"})
		ldapSelect := h.createField(model.PropertyFieldTypeSelect, model.CPAAttrs{LDAP: "department"})
		h.createField(model.PropertyFieldTypeText, model.CPAAttrs{SAML: "groups"})
		h.createField(model.PropertyFieldTypeText, model.CPAAttrs{})

		s := h.syncer(model.PropertySyncSourceLDAP)
		assert.Equal(t, model.PropertySyncSourceLDAP, s.Source())
		assert.True(t, s.HasMappings())
		assert.Equal(t, []string{"department", "memberOf"}, s.ExternalAttributes())

		ids := []string{}
		names := []string{}
		for _, f := range s.Fields() {
			ids = append(ids, f.ID)
			names = append(names, f.Name)
		}
		assert.ElementsMatch(t, []string{ldapText.ID, ldapMulti.ID, ldapSelect.ID}, ids)
		assert.IsIncreasing(t, names)
	})

	t.Run("reports no mappings when nothing is linked to the source", func(t *testing.T) {
		// Only LDAP fields were created above besides one SAML text field.
		for _, f := range h.syncer(model.PropertySyncSourceSAML).Fields() {
			require.NotEmpty(t, f.Attrs[model.PropertyFieldAttrSAML])
		}

		fields, appErr := h.App.SearchPropertyFields(h.adminRctx, h.groupID, model.PropertyFieldSearchOpts{ObjectType: model.PropertyFieldObjectTypeUser, PerPage: 200})
		require.Nil(t, appErr)
		for _, f := range fields {
			if saml, _ := f.Attrs[model.PropertyFieldAttrSAML].(string); saml != "" {
				require.Nil(t, h.App.DeletePropertyField(h.adminRctx, h.groupID, f.ID, false, ""))
			}
		}
		s := h.syncer(model.PropertySyncSourceSAML)
		assert.False(t, s.HasMappings())
		assert.Empty(t, s.ExternalAttributes())

		result := h.sync(s, model.NewId(), map[string][]string{"groups": {"x"}}, true)
		assert.Empty(t, result.Fields)
		assert.False(t, result.Changed())
	})

	t.Run("ignores linked fields whose type cannot be synced", func(t *testing.T) {
		rank := 1
		legacy, err := h.Store.PropertyField().Create(&model.PropertyField{
			GroupID:    h.groupID,
			Name:       "legacy_rank_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttrLDAP:         "level",
				model.PropertyFieldAttributeOptions: []any{map[string]any{"id": model.NewId(), "name": "low", "rank": rank}},
			},
		})
		require.NoError(t, err)

		s := h.syncer(model.PropertySyncSourceLDAP)
		for _, f := range s.Fields() {
			assert.NotEqual(t, legacy.ID, f.ID)
		}
		assert.NotContains(t, s.ExternalAttributes(), "level")
	})
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

	field := h.createField(model.PropertyFieldTypeText, model.CPAAttrs{LDAP: "department"})
	email := h.createField(model.PropertyFieldTypeText, model.CPAAttrs{LDAP: "mail", ValueType: "email"})
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

	t.Run("skips a value that violates the field's value_type", func(t *testing.T) {
		result := h.sync(s, user, map[string][]string{"department": {"Engineering"}, "mail": {"not-an-email"}}, false)
		outcome := outcomeFor(t, result, email.ID)
		assert.Equal(t, model.PropertySyncFieldSkipped, outcome.Status)
		assert.Contains(t, outcome.Reason, "email")
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

	t.Run("does not touch fields of the other source", func(t *testing.T) {
		samlField := h.createField(model.PropertyFieldTypeText, model.CPAAttrs{SAML: "department"})
		result := h.sync(s, user, map[string][]string{"department": {"Engineering"}}, false)
		for _, f := range result.Fields {
			assert.NotEqual(t, samlField.ID, f.FieldID)
		}
		assert.Nil(t, h.value(user, samlField.ID))
	})
}

func TestPropertySyncer_SyncUser_Select(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	field := h.createField(model.PropertyFieldTypeSelect, model.CPAAttrs{SAML: "department"})
	s := h.syncer(model.PropertySyncSourceSAML)
	user1, user2 := h.BasicUser.Id, h.BasicUser2.Id

	t.Run("creates the option on first sight and stores its ID", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"department": {"Engineering", "ignored second value"}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 1, outcome.OptionsCreated)
		assert.Equal(t, 1, result.OptionsCreated)

		assert.Equal(t, []string{"Engineering"}, h.optionNames(field.ID))
		assert.Equal(t, h.optionID(field.ID, "Engineering"), h.valueString(user1, field.ID))
	})

	t.Run("reuses an existing option for another user", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"department": {"Engineering"}}, true)
		assert.Equal(t, 0, outcomeFor(t, result, field.ID).OptionsCreated)
		assert.Equal(t, []string{"Engineering"}, h.optionNames(field.ID))
		assert.Equal(t, h.valueString(user1, field.ID), h.valueString(user2, field.ID))
	})

	t.Run("preserves case, so differently cased values are distinct options", func(t *testing.T) {
		h.sync(s, user2, map[string][]string{"department": {"engineering"}}, true)
		assert.Equal(t, []string{"Engineering", "engineering"}, h.optionNames(field.ID))
		assert.NotEqual(t, h.valueString(user1, field.ID), h.valueString(user2, field.ID))
	})

	t.Run("moving a user prunes the option nobody holds any more", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"department": {"Sales"}}, true)
		assert.Equal(t, 1, result.OptionsPruned)
		assert.Equal(t, []string{"Engineering", "Sales"}, h.optionNames(field.ID))
	})

	t.Run("an option still held by another user survives pruning", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"department": {"Engineering"}}, true)
		assert.Equal(t, 1, result.OptionsPruned, "Sales is orphaned")
		assert.Equal(t, []string{"Engineering"}, h.optionNames(field.ID))
		assert.Equal(t, h.valueString(user1, field.ID), h.valueString(user2, field.ID))
	})

	t.Run("absent attribute clears the value and prunes when requested", func(t *testing.T) {
		h.sync(s, user1, nil, true)
		assert.Equal(t, "", h.valueString(user1, field.ID))
		assert.Equal(t, []string{"Engineering"}, h.optionNames(field.ID), "user2 still holds it")

		result := h.sync(s, user2, map[string][]string{}, true)
		assert.Equal(t, model.PropertySyncFieldCleared, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, 1, result.OptionsPruned)
		assert.Empty(t, h.optionNames(field.ID))
		assert.NotContains(t, h.field(field.ID).Attrs, model.PropertyFieldAttributeOptions)
	})

	t.Run("skips a value longer than an option name may be", func(t *testing.T) {
		long := strings.Repeat("x", model.CPAOptionNameMaxLength+1)
		result := h.sync(s, user1, map[string][]string{"department": {long}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldSkipped, outcome.Status)
		assert.Equal(t, []string{long}, outcome.DroppedValues)
		assert.Empty(t, h.optionNames(field.ID))
	})
}

func TestPropertySyncer_SyncUser_Multiselect(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	field := h.createField(model.PropertyFieldTypeMultiselect, model.CPAAttrs{LDAP: "memberOf"})
	s := h.syncer(model.PropertySyncSourceLDAP)
	user1, user2 := h.BasicUser.Id, h.BasicUser2.Id

	idsOf := func(names ...string) []string {
		ids := make([]string, 0, len(names))
		for _, n := range names {
			ids = append(ids, h.optionID(field.ID, n))
		}
		return ids
	}

	t.Run("creates every value as an option, sorted by name, and stores all IDs", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {"sales", "Engineering", "Engineering", " ", "admins"}}, false)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 3, outcome.OptionsCreated)
		assert.Empty(t, outcome.DroppedValues)

		assert.Equal(t, []string{"admins", "Engineering", "sales"}, h.optionNames(field.ID))
		assert.Equal(t, idsOf("admins", "Engineering", "sales"), h.valueStrings(user1, field.ID))
	})

	t.Run("source order does not matter", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {"Engineering", "admins", "sales"}}, false)
		assert.Equal(t, model.PropertySyncFieldUnchanged, outcomeFor(t, result, field.ID).Status)
	})

	t.Run("a second user shares options and adds new ones", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"memberOf": {"sales", "support"}}, false)
		assert.Equal(t, 1, outcomeFor(t, result, field.ID).OptionsCreated)
		assert.Equal(t, []string{"admins", "Engineering", "sales", "support"}, h.optionNames(field.ID))
		assert.Equal(t, idsOf("sales", "support"), h.valueStrings(user2, field.ID))
	})

	t.Run("without pruning, options a user lost stay until PruneOrphanedOptions runs", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {"sales"}}, false)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, 0, result.OptionsPruned)
		assert.Equal(t, []string{"admins", "Engineering", "sales", "support"}, h.optionNames(field.ID))

		pruned, appErr := s.PruneOrphanedOptions(request.TestContext(t))
		require.Nil(t, appErr)
		require.Len(t, pruned.Fields, 1)
		assert.Equal(t, field.ID, pruned.Fields[0].FieldID)
		assert.Equal(t, field.Name, pruned.Fields[0].FieldName)
		assert.ElementsMatch(t, []string{"admins", "Engineering"}, pruned.Fields[0].OptionNames)
		assert.Equal(t, 2, pruned.OptionsPruned())
		assert.Equal(t, []string{"sales", "support"}, h.optionNames(field.ID))

		again, appErr := s.PruneOrphanedOptions(request.TestContext(t))
		require.Nil(t, appErr)
		assert.Empty(t, again.Fields)
	})

	t.Run("with pruning, an option disappears with its last holder", func(t *testing.T) {
		result := h.sync(s, user2, map[string][]string{"memberOf": {"sales"}}, true)
		assert.Equal(t, 1, result.OptionsPruned)
		assert.Equal(t, []string{"sales"}, h.optionNames(field.ID))
	})

	t.Run("drops over-long values but syncs the rest", func(t *testing.T) {
		long := strings.Repeat("y", model.CPAOptionNameMaxLength+1)
		result := h.sync(s, user1, map[string][]string{"memberOf": {"sales", long, "qa"}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, []string{long}, outcome.DroppedValues)
		assert.NotEmpty(t, outcome.Reason)
		assert.Equal(t, idsOf("qa", "sales"), h.valueStrings(user1, field.ID))
	})

	t.Run("empty attribute clears the value and prunes", func(t *testing.T) {
		result := h.sync(s, user1, map[string][]string{"memberOf": {}}, true)
		assert.Equal(t, model.PropertySyncFieldCleared, outcomeFor(t, result, field.ID).Status)
		assert.Nil(t, h.valueStrings(user1, field.ID))
		assert.Equal(t, []string{"sales"}, h.optionNames(field.ID), "user2 still holds sales; qa is gone")
	})
}

func TestPropertySyncer_OptionCap(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	multi := h.createField(model.PropertyFieldTypeMultiselect, model.CPAAttrs{LDAP: "memberOf"})
	single := h.createField(model.PropertyFieldTypeSelect, model.CPAAttrs{LDAP: "department"})

	// Fill both fields to one below the cap, as the owning sync would.
	syncRctx := h.emptyContextWithCallerID(model.CallerIDLDAPSync)
	for _, f := range []*model.PropertyField{multi, single} {
		options := make([]*model.CustomProfileAttributesSelectOption, 0, model.PropertySyncMaxOptionsPerField-1)
		for i := range model.PropertySyncMaxOptionsPerField - 1 {
			options = append(options, &model.CustomProfileAttributesSelectOption{Name: fmt.Sprintf("group-%03d", i)})
		}
		f.Attrs[model.PropertyFieldAttributeOptions] = options
		_, _, appErr := h.App.UpdatePropertyField(syncRctx, h.groupID, f, false, "")
		require.Nil(t, appErr)
	}

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
		assert.Len(t, h.options(multi.ID), model.PropertySyncMaxOptionsPerField)
		assert.ElementsMatch(t, []string{h.optionID(multi.ID, "group-000"), h.optionID(multi.ID, "new-a")}, h.valueStrings(user, multi.ID))
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
		assert.Equal(t, h.optionID(single.ID, "brand-new"), h.valueString(user, single.ID), "stored value is left alone")
	})
}

func TestPropertySyncer_ConcurrentSyncers(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	field := h.createField(model.PropertyFieldTypeMultiselect, model.CPAAttrs{SAML: "groups"})

	// Two logins on two nodes: both syncers hold the same (empty) view of the field.
	a := h.syncer(model.PropertySyncSourceSAML)
	b := h.syncer(model.PropertySyncSourceSAML)

	h.sync(b, h.BasicUser2.Id, map[string][]string{"groups": {"shared", "only-b"}}, true)

	t.Run("a stale syncer converges on the option the other one created", func(t *testing.T) {
		result := h.sync(a, h.BasicUser.Id, map[string][]string{"groups": {"shared", "only-a"}}, true)
		outcome := outcomeFor(t, result, field.ID)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcome.Status)
		assert.Equal(t, 1, outcome.OptionsCreated, "only-a; shared already existed")

		assert.Equal(t, []string{"only-a", "only-b", "shared"}, h.optionNames(field.ID))
		shared := h.optionID(field.ID, "shared")
		assert.Contains(t, h.valueStrings(h.BasicUser.Id, field.ID), shared)
		assert.Contains(t, h.valueStrings(h.BasicUser2.Id, field.ID), shared)
	})

	t.Run("a stale syncer does not resurrect options pruned by the other one", func(t *testing.T) {
		// b still thinks only-b exists; user2 drops it and prunes.
		h.sync(b, h.BasicUser2.Id, map[string][]string{"groups": {"shared"}}, true)
		assert.Equal(t, []string{"only-a", "shared"}, h.optionNames(field.ID))

		// a's cached view predates that prune; it must not write only-b back.
		result := h.sync(a, h.BasicUser.Id, map[string][]string{"groups": {"shared"}}, true)
		assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
		assert.Equal(t, []string{"shared"}, h.optionNames(field.ID))
	})
}

func TestPropertySyncer_FieldIsolation(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	text := h.createField(model.PropertyFieldTypeText, model.CPAAttrs{LDAP: "department"})

	// A protected field cannot have options provisioned without the
	// protected bypass, so option creation on it fails.
	none := model.PermissionLevelNone
	protectedField, err := h.Store.PropertyField().Create(&model.PropertyField{
		GroupID:         h.groupID,
		Name:            "protected_" + model.NewId(),
		Type:            model.PropertyFieldTypeMultiselect,
		ObjectType:      model.PropertyFieldObjectTypeUser,
		TargetType:      string(model.PropertyFieldTargetLevelSystem),
		Protected:       true,
		PermissionField: &none,
		Attrs:           model.StringInterface{model.PropertyFieldAttrLDAP: "memberOf"},
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

func TestPropertySyncer_AdminManagedField(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	field := h.createField(model.PropertyFieldTypeMultiselect, model.CPAAttrs{LDAP: "memberOf", Managed: "admin"})
	s := h.syncer(model.PropertySyncSourceLDAP)

	result := h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"a", "b"}}, true)
	assert.Equal(t, model.PropertySyncFieldUpdated, outcomeFor(t, result, field.ID).Status)
	assert.Equal(t, []string{"a", "b"}, h.optionNames(field.ID))
	assert.Equal(t, "admin", h.field(field.ID).Attrs[model.PropertyFieldAttrManaged])

	result = h.sync(s, h.BasicUser.Id, map[string][]string{"memberOf": {"a"}}, true)
	assert.Equal(t, 1, result.OptionsPruned)
	assert.Equal(t, []string{"a"}, h.optionNames(field.ID))
}

func TestPropertySyncer_PruneIgnoresAdminOptionsOnlyWhenUnreferenced(t *testing.T) {
	mainHelper.Parallel(t)
	h := setupPropertySyncTest(t)

	// Admin authors options on an unlinked field, then links it.
	field := h.createField(model.PropertyFieldTypeSelect, model.CPAAttrs{
		Options: []*model.CustomProfileAttributesSelectOption{{Name: "Legacy"}, {Name: "Kept"}},
	})
	keptID := h.optionID(field.ID, "Kept")
	_, appErr := h.App.UpsertPropertyValues(h.adminRctx, []*model.PropertyValue{{
		GroupID:    h.groupID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetID:   h.BasicUser2.Id,
		FieldID:    field.ID,
		Value:      json.RawMessage(`"` + keptID + `"`),
	}}, model.PropertyFieldObjectTypeUser, h.BasicUser2.Id, "")
	require.Nil(t, appErr)

	linked := h.field(field.ID)
	linked.Attrs[model.PropertyFieldAttrLDAP] = "department"
	_, _, appErr = h.App.UpdatePropertyField(h.adminRctx, h.groupID, linked, false, "")
	require.Nil(t, appErr)

	s := h.syncer(model.PropertySyncSourceLDAP)
	h.sync(s, h.BasicUser.Id, map[string][]string{"department": {"Kept"}}, false)

	pruned, appErr := s.PruneOrphanedOptions(request.TestContext(t))
	require.Nil(t, appErr)
	require.Len(t, pruned.Fields, 1)
	assert.Equal(t, []string{"Legacy"}, pruned.Fields[0].OptionNames)
	assert.Equal(t, []string{"Kept"}, h.optionNames(field.ID))
	assert.Equal(t, keptID, h.valueString(h.BasicUser.Id, field.ID), "sync matched the admin-authored option by name")
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

	t.Run("sortOptionsByName", func(t *testing.T) {
		options := model.PropertyOptions[*model.CustomProfileAttributesSelectOption]{
			{Name: "sales"}, {Name: "Engineering"}, {Name: "Sales"}, {Name: "admins"},
		}
		sortOptionsByName(options)
		names := []string{}
		for _, o := range options {
			names = append(names, o.Name)
		}
		assert.Equal(t, []string{"admins", "Engineering", "Sales", "sales"}, names)
	})
}
