// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// countingPropertyFieldStore wraps a store.PropertyFieldStore and counts
// calls to Get, so a test can assert a batch resolution loaded a template
// once rather than once per field it was asked about.
type countingPropertyFieldStore struct {
	store.PropertyFieldStore
	gets int
}

func (c *countingPropertyFieldStore) Get(ctx context.Context, groupID, id string) (*model.PropertyField, error) {
	c.gets++
	return c.PropertyFieldStore.Get(ctx, groupID, id)
}

func TestResolveFieldMasking(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	h := th.service.accessControlHookForTests()
	require.NotNil(t, h)

	// newTemplate creates a real link-source template: object_type:template,
	// the only object type CreatePropertyField accepts as a link source.
	newTemplate := func(name string) *model.PropertyField {
		created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)
		return created
	}

	// newUserField creates a standalone object_type:user field with no link.
	newUserField := func(name string) *model.PropertyField {
		created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)
		return created
	}

	// newLinkedField links to a real template through the service, the way a
	// linked field (and a template's mask_by_field_id holdings field, which
	// must link back to its template) is created in production.
	newLinkedField := func(name string, templateID string) *model.PropertyField {
		created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          name,
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &templateID,
		})
		require.NoError(t, err)
		return created
	}

	// setMasking persists masking directly through the store rather than the
	// service, since PropertyField.IsValid (which both routes run) is the
	// only gate this step depends on -- the save-time lock rejecting a linked
	// field's own masking belongs to a later step and must not gate this one.
	setMasking := func(field *model.PropertyField, masking *model.Masking) *model.PropertyField {
		field.Permissions = &model.Permissions{Masking: masking}
		updated, err := th.dbStore.PropertyField().Update(field.GroupID, []*model.PropertyField{field}, nil)
		require.NoError(t, err)
		return updated[0]
	}

	t.Run("unmasked field with an unmasked template resolves to nothing", func(t *testing.T) {
		template := newTemplate("Template-Unmasked")
		linked := newLinkedField("Linked-Unmasked", template.ID)

		fm, err := h.resolveFieldMasking(linked)
		require.NoError(t, err)
		assert.Nil(t, fm.masking)
	})

	t.Run("field with its own empty masking and no template: holdings are itself", func(t *testing.T) {
		field := setMasking(newUserField("Standalone-Masked"), &model.Masking{})

		fm, err := h.resolveFieldMasking(field)
		require.NoError(t, err)
		require.NotNil(t, fm.masking)
		assert.Equal(t, field.ID, fm.holdingsFieldID)
	})

	t.Run("linked field with no masking of its own whose template is masked: holdings come from the template's mask_by_field_id", func(t *testing.T) {
		template := newTemplate("Template-MaskByFieldID")
		holdings := newLinkedField("Holdings-ForTemplate", template.ID)
		template = setMasking(template, &model.Masking{MaskByFieldID: holdings.ID})
		linked := newLinkedField("Linked-UsesTemplateHoldings", template.ID)

		fm, err := h.resolveFieldMasking(linked)
		require.NoError(t, err)
		require.NotNil(t, fm.masking)
		assert.Equal(t, holdings.ID, fm.holdingsFieldID)
	})

	// object_type:template always requires mask_by_field_id when masked
	// (Masking.isValid), so a masked template with none can only exist by
	// reaching the field it masks through something other than an
	// object_type:template link source -- which is exactly the case this
	// package's "resolution is flat" rule has to handle regardless of how the
	// linked-to field got its masking. Built by going straight to the store,
	// bypassing the service's "can only link to template fields" business
	// rule the way CreatePropertyFieldDirect always does, since the model
	// itself imposes no such restriction.
	t.Run("linked field whose masked template sets no mask_by_field_id: holdings come from the field itself", func(t *testing.T) {
		source := setMasking(newUserField("Source-NoHoldings"), &model.Masking{})
		linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-FallsBackToSelf",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
		})

		fm, err := h.resolveFieldMasking(linked)
		require.NoError(t, err)
		require.NotNil(t, fm.masking)
		assert.Equal(t, linked.ID, fm.holdingsFieldID)
	})

	t.Run("linked field carrying its own masking, linked to a masked template: the template's object applies and the field's own is ignored", func(t *testing.T) {
		template := newTemplate("Template-Ceiling")
		holdings := newLinkedField("Holdings-ForCeiling", template.ID)
		template = setMasking(template, &model.Masking{
			MaskByFieldID: holdings.ID,
			Except:        []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: model.NewId()}},
		})
		linked := newLinkedField("Linked-OwnMaskingIgnored", template.ID)
		linked = setMasking(linked, &model.Masking{}) // would be rejected on save once the lock lands; direct store write here

		fm, err := h.resolveFieldMasking(linked)
		require.NoError(t, err)
		require.NotNil(t, fm.masking)
		assert.Equal(t, template.Permissions.Masking, fm.masking)
		assert.Equal(t, holdings.ID, fm.holdingsFieldID)
	})

	t.Run("linked field carrying its own masking, linked to an unmasked template: not masked", func(t *testing.T) {
		template := newTemplate("Template-UnmaskedCeiling")
		linked := newLinkedField("Linked-OwnMaskingOnUnmaskedTemplate", template.ID)
		linked = setMasking(linked, &model.Masking{})

		fm, err := h.resolveFieldMasking(linked)
		require.NoError(t, err)
		assert.Nil(t, fm.masking)
	})

	t.Run("a template carrying its own mask_by_field_id: holdings come from the field it names", func(t *testing.T) {
		template := newTemplate("Template-OwnHoldings")
		holdings := newLinkedField("Holdings-Field", template.ID)
		template = setMasking(template, &model.Masking{MaskByFieldID: holdings.ID})

		fm, err := h.resolveFieldMasking(template)
		require.NoError(t, err)
		require.NotNil(t, fm.masking)
		assert.Equal(t, holdings.ID, fm.holdingsFieldID)
	})

	t.Run("two resolutions of the same field in one read call load the template once", func(t *testing.T) {
		template := newTemplate("Template-Cached")
		holdings := newLinkedField("Holdings-ForCached", template.ID)
		template = setMasking(template, &model.Masking{MaskByFieldID: holdings.ID})
		linked := newLinkedField("Linked-Cached", template.ID)

		counter := &countingPropertyFieldStore{PropertyFieldStore: th.service.fieldStore}
		th.service.fieldStore = counter
		t.Cleanup(func() { th.service.fieldStore = counter.PropertyFieldStore })

		c := newMaskingContext()
		fm1, err := c.resolve(h, linked)
		require.NoError(t, err)
		fm2, err := c.resolve(h, linked)
		require.NoError(t, err)

		assert.Equal(t, fm1, fm2)
		assert.Equal(t, 1, counter.gets)
	})
}

func TestExempt(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	h := th.service.accessControlHookForTests()
	require.NotNil(t, h)

	t.Run("a listed plugin is exempt; an unlisted plugin is not, however broad its grants", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "plugin-a" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		except := []model.Identity{{Type: model.PropertyOwnerTypePlugin, ID: "plugin-a"}}
		assert.True(t, h.exempt(except, "plugin-a", ""))
		assert.False(t, h.exempt(except, "plugin-b", ""))
	})

	t.Run("the LDAP sync caller matches a service/ldap entry, the SAML sync caller a service/saml entry", func(t *testing.T) {
		except := []model.Identity{
			{Type: model.PropertyOwnerTypeService, ID: model.PropertyFieldAttrLDAP},
			{Type: model.PropertyOwnerTypeService, ID: model.PropertyFieldAttrSAML},
		}
		assert.True(t, h.exempt(except, model.CallerIDLDAPSync, ""))
		assert.True(t, h.exempt(except, model.CallerIDSAMLSync, ""))
	})

	t.Run("a user entry exempts that user id and nobody else", func(t *testing.T) {
		userID := model.NewId()
		except := []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: userID}}
		assert.True(t, h.exempt(except, userID, ""))
		assert.False(t, h.exempt(except, model.NewId(), ""))
	})

	t.Run("a role entry exempts a caller holding that role and not a caller without it", func(t *testing.T) {
		holder := model.NewId()
		other := model.NewId()
		th.service.setRoleListerForTests(func(userID string) []string {
			if userID == holder {
				return []string{"content_reviewer"}
			}
			return []string{"some_other_role"}
		})
		t.Cleanup(func() { th.service.setRoleListerForTests(nil) })

		except := []model.Identity{{Type: model.PropertyOwnerTypeRole, ID: "content_reviewer"}}
		assert.True(t, h.exempt(except, holder, ""))
		assert.False(t, h.exempt(except, other, ""))
	})

	t.Run("a nil role lister exempts nobody by role; neither does a failing lookup", func(t *testing.T) {
		except := []model.Identity{{Type: model.PropertyOwnerTypeRole, ID: "content_reviewer"}}

		th.service.setRoleListerForTests(nil)
		assert.False(t, h.exempt(except, model.NewId(), ""))

		// A failing lookup surfaces to the hook as an empty role list, the
		// same shape propertyCallerRoles returns for a.GetUser erroring.
		th.service.setRoleListerForTests(func(userID string) []string { return nil })
		t.Cleanup(func() { th.service.setRoleListerForTests(nil) })
		assert.False(t, h.exempt(except, model.NewId(), ""))
	})

	t.Run("an except list carrying no role entry never calls the lister", func(t *testing.T) {
		calls := 0
		th.service.setRoleListerForTests(func(userID string) []string {
			calls++
			return nil
		})
		t.Cleanup(func() { th.service.setRoleListerForTests(nil) })

		except := []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: model.NewId()}}
		assert.False(t, h.exempt(except, model.NewId(), ""))
		assert.Equal(t, 0, calls)
	})

	t.Run("a wildcard plugin entry exempts nobody; an empty caller id and the local-admin caller are not exempt", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return true })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		except := []model.Identity{{Type: model.PropertyOwnerTypePlugin, ID: "*"}}
		assert.False(t, h.exempt(except, "any-plugin", ""))
		assert.False(t, h.exempt(except, "", ""))
		assert.False(t, h.exempt(except, model.CallerIDLocalAdmin, ""))
	})

	t.Run("a linked field's own except exempts nobody when its masked template lists nobody", func(t *testing.T) {
		// object_type:template always requires mask_by_field_id when masked
		// (Masking.isValid), so the masked "template" here is an
		// object_type:user field reached through something other than an
		// object_type:template link source -- the same stand-in
		// TestResolveFieldMasking's "falls back to self" case uses.
		template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Template-Exfil",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)
		template.Permissions = &model.Permissions{Masking: &model.Masking{}}
		updatedTemplate, err := th.dbStore.PropertyField().Update(template.GroupID, []*model.PropertyField{template}, nil)
		require.NoError(t, err)
		template = updatedTemplate[0]

		attacker := model.NewId()
		// Would be rejected on save once the lock lands (a later step); a
		// direct store write here stands in for a stray one from before that
		// lock existed, or a migration that has not caught up.
		linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-Exfil",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Permissions:   &model.Permissions{Masking: &model.Masking{Except: []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: attacker}}}},
		})

		fm, err := h.resolveFieldMasking(linked)
		require.NoError(t, err)
		require.NotNil(t, fm.masking)
		assert.False(t, h.exempt(fm.masking.Except, attacker, ""))
	})
}

// countingPropertyValueStore wraps a store.PropertyValueStore and counts calls
// to SearchPropertyValues, so a test can assert a batch read resolved a
// caller's holdings once rather than once per value it masked.
type countingPropertyValueStore struct {
	store.PropertyValueStore
	searches int
}

func (c *countingPropertyValueStore) SearchPropertyValues(opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	c.searches++
	return c.PropertyValueStore.SearchPropertyValues(opts)
}

// maskedField builds a standalone (no LinkedFieldID) field carrying masking
// under a typed permissions object with no restrictions and no grants --
// value.read for a human caller is left to the injected ladder checker, which
// TestMaskValueReads sets to always allow, isolating the masking filter under
// test from the §2.5 gate it runs behind.
func maskedField(groupID, name string, fieldType model.PropertyFieldType, masking *model.Masking) *model.PropertyField {
	return &model.PropertyField{
		GroupID:     groupID,
		Name:        name,
		Type:        fieldType,
		ObjectType:  model.PropertyFieldObjectTypeUser,
		TargetType:  string(model.PropertyFieldTargetLevelSystem),
		Permissions: &model.Permissions{Masking: masking},
	}
}

// writeValueDirect stores a value through the store directly, bypassing the
// write gate -- this phase is a read filter only, and what the caller may see
// of a value already stored is what is under test, not how it got there.
func writeValueDirect(t *testing.T, th *TestHelper, fieldID, targetType, targetID string, value any) *model.PropertyValue {
	t.Helper()
	encoded, err := json.Marshal(value)
	require.NoError(t, err)
	created, err := th.dbStore.PropertyValue().Create(&model.PropertyValue{
		GroupID:    th.CPAGroupID,
		FieldID:    fieldID,
		TargetType: targetType,
		TargetID:   targetID,
		Value:      encoded,
	})
	require.NoError(t, err)
	return created
}

// TestMaskValueReads covers the read filter itself: what a caller may see of
// a value on a field carrying masking, once the §2.5 value.read gate has
// already admitted them. The gate is stubbed to always allow, so every case
// below isolates the filter's own answer.
func TestMaskValueReads(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	alwaysAllow := func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
		return true
	}
	th.service.setLadderCheckerForTests(alwaysAllow)
	t.Cleanup(func() {
		th.service.setLadderCheckerForTests(nil)
		th.service.setPluginCheckerForTests(nil)
	})

	t.Run("select: identical option visible, different option dropped", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Select", model.PropertyFieldTypeSelect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")
		match := writeValueDirect(t, th, field.ID, "user", model.NewId(), "opt_a")
		mismatch := writeValueDirect(t, th, field.ID, "user", model.NewId(), "opt_b")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, match.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, match.Value, retrieved.Value)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, mismatch.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("multiselect: result is the intersection, and no overlap drops the value", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Multiselect", model.PropertyFieldTypeMultiselect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{"opt_a", "opt_b"})
		overlap := writeValueDirect(t, th, field.ID, "user", model.NewId(), []string{"opt_b", "opt_c"})
		none := writeValueDirect(t, th, field.ID, "user", model.NewId(), []string{"opt_c", "opt_d"})

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, overlap.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		var ids []string
		require.NoError(t, json.Unmarshal(retrieved.Value, &ids))
		assert.Equal(t, []string{"opt_b"}, ids)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, none.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("rank: exact match visible, and a target above or below the caller is dropped rather than clamped", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Rank", model.PropertyFieldTypeRank, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_secret")
		exact := writeValueDirect(t, th, field.ID, "user", model.NewId(), "opt_secret")
		above := writeValueDirect(t, th, field.ID, "user", model.NewId(), "opt_topsecret")
		below := writeValueDirect(t, th, field.ID, "user", model.NewId(), "opt_public")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, exact.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, exact.Value, retrieved.Value)

		// The legacy shared_only path (TestRankSharedOnly_Value) clamps this to
		// the caller's own rank instead of hiding it. Masking must not.
		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, above.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a target ranked above the caller must be dropped, not clamped down to the caller's rank")

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, below.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a target ranked below the caller must be dropped too -- rank order plays no part in masking")
	})

	t.Run("scalar: identical bytes visible, different bytes dropped, no caller value dropped", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Scalar", model.PropertyFieldTypeText, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "codename-orca")
		match := writeValueDirect(t, th, field.ID, "user", model.NewId(), "codename-orca")
		mismatch := writeValueDirect(t, th, field.ID, "user", model.NewId(), "codename-narwhal")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, match.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, match.Value, retrieved.Value)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, mismatch.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)

		noValueCaller := model.NewId()
		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, noValueCaller), th.CPAGroupID, match.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("graph: ancestor coverage decides visibility, and a resolution failure hides rather than falling through", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "graph-source" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		field, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "graph-source"), &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Graph",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
					map[string]any{"name": "Sea Program"},
				},
			},
			Permissions: &model.Permissions{Masking: &model.Masking{}},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, field)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{ids["Air Program"]})
		covered := writeValueDirect(t, th, field.ID, "user", model.NewId(), []string{ids["Fighter Jet Program"]})
		unrelated := writeValueDirect(t, th, field.ID, "user", model.NewId(), []string{ids["Sea Program"]})
		malformed := writeValueDirect(t, th, field.ID, "user", model.NewId(), "Fighter Jet Program")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, covered.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		var visible []string
		require.NoError(t, json.Unmarshal(retrieved.Value, &visible))
		assert.Equal(t, []string{ids["Fighter Jet Program"]}, visible)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, unrelated.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "an unrelated branch shares nothing with the caller")

		noHoldingsCaller := model.NewId()
		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, noHoldingsCaller), th.CPAGroupID, covered.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a caller holding nothing for the field sees nothing")

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, malformed.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a value that cannot be read as a set of options is hidden, never handed over whole")
	})

	t.Run("holdings from another field: a linked field's masking reads holdings off its template's mask_by_field_id", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Template",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)

		holdings, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Mask-Holdings",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, err)

		template.Permissions = &model.Permissions{Masking: &model.Masking{MaskByFieldID: holdings.ID}}
		updated, err := th.dbStore.PropertyField().Update(template.GroupID, []*model.PropertyField{template}, nil)
		require.NoError(t, err)
		template = updated[0]

		linked, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Linked",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			// A linked field's own restrictions/grants are its own -- only
			// masking is locked to the template (divergence 1) -- but it must
			// still carry a (masking-empty) Permissions object of its own for
			// the §2.5 gate this test's ladder-checker stub answers to run at
			// all; a nil Permissions here would fall through to the legacy
			// access_mode path instead.
			Permissions:   &model.Permissions{},
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, err)

		caller := model.NewId()
		// The caller's holdings live on the holdings field, keyed by the
		// caller's own ID -- not on the linked field being read, and not on
		// the linked field's own (nonexistent) value for the caller.
		writeValueDirect(t, th, holdings.ID, "user", caller, "codename-orca")
		channelID := model.NewId()
		match := writeValueDirect(t, th, linked.ID, "channel", channelID, "codename-orca")
		mismatch := writeValueDirect(t, th, linked.ID, "channel", model.NewId(), "codename-narwhal")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, match.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, match.Value, retrieved.Value)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, mismatch.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("a plugin listed in except receives values unfiltered; an unlisted plugin receives nothing", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "listed-plugin" || pluginID == "unlisted-plugin"
		})
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		field := maskedField(th.CPAGroupID, "Mask-Except", model.PropertyFieldTypeText, &model.Masking{
			Except: []model.Identity{{Type: model.PropertyOwnerTypePlugin, ID: "listed-plugin"}},
		})
		// Except only excuses a caller the §2.5 gate already admitted -- both
		// plugins need a value.read grant to reach the filter at all.
		field.Permissions.Grants = []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "listed-plugin"}, Allow: []string{model.PropertyActionValueRead}},
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "unlisted-plugin"}, Allow: []string{model.PropertyActionValueRead}},
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)
		field = created

		value := writeValueDirect(t, th, field.ID, "user", model.NewId(), "secret")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, "listed-plugin"), th.CPAGroupID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.Value, retrieved.Value)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, "unlisted-plugin"), th.CPAGroupID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "an unlisted plugin holds no position in the scheme and except does not name it")
	})

	t.Run("masking never runs on a value the value.read gate refused", func(t *testing.T) {
		th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
			return false
		})
		t.Cleanup(func() { th.service.setLadderCheckerForTests(alwaysAllow) })

		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Denied", model.PropertyFieldTypeText, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "secret")
		value := writeValueDirect(t, th, field.ID, "user", model.NewId(), "secret")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "the ladder checker denies every caller, so the value the caller holds identically must still be hidden")
	})

	t.Run("a batch read of several values on one field resolves the caller's holdings once", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Batch", model.PropertyFieldTypeSelect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")

		ids := make([]string, 0, 5)
		for range 5 {
			v := writeValueDirect(t, th, field.ID, "user", model.NewId(), "opt_a")
			ids = append(ids, v.ID)
		}

		counter := &countingPropertyValueStore{PropertyValueStore: th.service.valueStore}
		th.service.valueStore = counter
		t.Cleanup(func() { th.service.valueStore = counter.PropertyValueStore })

		retrieved, err := th.service.GetPropertyValues(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, ids)
		require.NoError(t, err)
		assert.Len(t, retrieved, 5)
		assert.Equal(t, 1, counter.searches, "the caller's holdings on one field must be searched once for the whole batch, not once per value")
	})

	t.Run("a field with permissions but no masking returns values unfiltered", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-None", model.PropertyFieldTypeText, nil))
		require.NoError(t, err)

		value := writeValueDirect(t, th, field.ID, "user", model.NewId(), "anything")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), th.CPAGroupID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.Value, retrieved.Value)
	})
}
