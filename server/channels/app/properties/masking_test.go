// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// maskingFailureLogMessage is logMaskingFailure's message in masking.go --
// duplicated here rather than exported, since a test asserting the exact
// wording is what would catch that message silently drifting from what an
// operator actually sees in the log.
const maskingFailureLogMessage = "Hiding a masked property value because what the caller may see of it could not be established"

// captureMaskingFailureLog attaches a buffer to th's logger so a test can
// prove logMaskingFailure actually ran, rather than only observing the value
// it hides -- a broken filter and a caller who holds nothing both hide the
// value, and only the log line tells them apart.
func captureMaskingFailureLog(t *testing.T, th *TestHelper) *mlog.Buffer {
	t.Helper()
	logger, ok := th.Context.Logger().(*mlog.Logger)
	require.True(t, ok, "test context logger must be a concrete *mlog.Logger to attach a capture target")
	buffer := &mlog.Buffer{}
	require.NoError(t, mlog.AddWriterTarget(logger, buffer, true, mlog.StdAll...))
	return buffer
}

// requireMaskingFailureLogged flushes th's logger and asserts buffer holds
// exactly one masking-failure log entry naming fieldID and valueID.
func requireMaskingFailureLogged(t *testing.T, th *TestHelper, buffer *mlog.Buffer, fieldID, valueID string) {
	t.Helper()
	logger, ok := th.Context.Logger().(*mlog.Logger)
	require.True(t, ok)
	require.NoError(t, logger.Flush())

	logOutput := buffer.String()
	found := false
	for _, e := range testlib.ParseLogEntries(t, strings.NewReader(logOutput)) {
		if e.Msg == maskingFailureLogMessage {
			found = true
			break
		}
	}
	assert.True(t, found, "expected a masking-failure log entry with message %q, got: %s", maskingFailureLogMessage, logOutput)
	assert.Contains(t, logOutput, fieldID)
	assert.Contains(t, logOutput, valueID)
}

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
// test from the permission gate it runs behind.
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
// a value on a field carrying masking, once the value.read permission gate has
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

	t.Run("graph: an object marked with an option the caller only covers from below is dropped, not narrowed to what the caller holds", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "graph-uncovered-source" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		field, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "graph-uncovered-source"), &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Graph-Uncovered",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
					map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
					map[string]any{"name": "Sea Program"},
				},
			},
			Permissions: &model.Permissions{Masking: &model.Masking{}},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, field)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{ids["F-18 Program"]})
		single := writeValueDirect(t, th, field.ID, "user", model.NewId(), []string{ids["Air Program"]})
		mixed := writeValueDirect(t, th, field.ID, "user", model.NewId(), []string{ids["Air Program"], ids["Sea Program"]})

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, single.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "the caller holds a descendant of Air Program, not Air Program itself, so the marking must be dropped rather than reported as the narrower F-18 Program")

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, mixed.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "neither Air Program nor the unrelated Sea Program is covered, so nothing about the mixed marking may be reported")
	})

	t.Run("multiselect and graph values return their overlapping options in the same order on two consecutive reads", func(t *testing.T) {
		selectField, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Multiselect-Order", model.PropertyFieldTypeMultiselect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, selectField.ID, "user", caller, []string{"opt_a", "opt_b", "opt_c", "opt_d"})
		value := writeValueDirect(t, th, selectField.ID, "user", model.NewId(), []string{"opt_a", "opt_b", "opt_c", "opt_d"})

		first, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, first)
		second, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, second)
		assert.Equal(t, first.Value, second.Value, "a multiselect value's options must marshal in the same order every read")

		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "graph-order-source" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		graphField, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "graph-order-source"), &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Graph-Order",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Sea Program"},
				},
			},
			Permissions: &model.Permissions{Masking: &model.Masking{}},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, graphField)

		graphCaller := model.NewId()
		writeValueDirect(t, th, graphField.ID, "user", graphCaller, []string{ids["Air Program"], ids["Sea Program"]})
		graphValue := writeValueDirect(t, th, graphField.ID, "user", model.NewId(), []string{ids["Air Program"], ids["Sea Program"]})

		firstGraph, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, graphCaller), th.CPAGroupID, graphValue.ID)
		require.NoError(t, err)
		require.NotNil(t, firstGraph)
		secondGraph, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, graphCaller), th.CPAGroupID, graphValue.ID)
		require.NoError(t, err)
		require.NotNil(t, secondGraph)
		assert.Equal(t, firstGraph.Value, secondGraph.Value, "a graph value covering two options must marshal in the same order every read")
	})

	t.Run("a holdings lookup that fails hides the value and logs, on a select field and a text field, not only on a graph field", func(t *testing.T) {
		selectField, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Select-Failure", model.PropertyFieldTypeSelect, &model.Masking{}))
		require.NoError(t, err)
		textField, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Text-Failure", model.PropertyFieldTypeText, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		selectValue := writeValueDirect(t, th, selectField.ID, "user", model.NewId(), "opt_a")
		textValue := writeValueDirect(t, th, textField.ID, "user", model.NewId(), "codename-orca")

		original := th.service.valueStore
		th.service.valueStore = &erroringSearchValueStore{PropertyValueStore: original}
		t.Cleanup(func() { th.service.valueStore = original })

		buffer := captureMaskingFailureLog(t, th)

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, selectValue.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a select field's value must hide when the caller's holdings cannot be resolved")
		requireMaskingFailureLogged(t, th, buffer, selectField.ID, selectValue.ID)

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, textValue.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a text field's value must hide when the caller's holdings cannot be resolved")
		requireMaskingFailureLogged(t, th, buffer, textField.ID, textValue.ID)
	})

	t.Run("a stored value that cannot be parsed as options hides and logs", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Mask-Select-Malformed", model.PropertyFieldTypeSelect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")
		malformed := writeValueDirect(t, th, field.ID, "user", model.NewId(), 42)

		buffer := captureMaskingFailureLog(t, th)

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, malformed.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "a stored value that will not parse as an option ID is hidden rather than handed over whole")
		requireMaskingFailureLogged(t, th, buffer, field.ID, malformed.ID)
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
			// masking is locked to the template -- but it must still carry a
			// (masking-empty) Permissions object of its own for the permission
			// gate this test's ladder-checker stub answers to run at all; a
			// nil Permissions here would fall through to the legacy
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
		// Except only excuses a caller the permission gate already admitted --
		// both plugins need a value.read grant to reach the filter at all.
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

// TestValueWriteVisibility covers checkValueWriteVisibility: on a masked
// field, a write must not be allowed to replace a stored value the caller
// cannot see in full. The §2.5 gate is stubbed to always allow, so every
// case below isolates the write-time visibility rule from the permission
// decision it runs behind.
func TestValueWriteVisibility(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	alwaysAllow := func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
		return true
	}
	th.service.setLadderCheckerForTests(alwaysAllow)
	t.Cleanup(func() {
		th.service.setLadderCheckerForTests(nil)
		th.service.setPluginCheckerForTests(nil)
	})

	t.Run("a caller who sees the whole stored value may update it", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-FullView", model.PropertyFieldTypeSelect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")
		value := writeValueDirect(t, th, field.ID, "channel", model.NewId(), "opt_a")

		value.Value = json.RawMessage(`"opt_a"`)
		_, upErr := th.service.UpdatePropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, value)
		require.NoError(t, upErr)
	})

	t.Run("a caller who sees only part of a multiselect value is refused", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-PartialView", model.PropertyFieldTypeMultiselect, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{"opt_a"})
		value := writeValueDirect(t, th, field.ID, "channel", model.NewId(), []string{"opt_a", "opt_b"})

		value.Value = json.RawMessage(`["opt_a"]`)
		_, upErr := th.service.UpdatePropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, value)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a caller who sees none of an existing value is refused on it, but may still write a new one", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-NoView", model.PropertyFieldTypeText, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		existing := writeValueDirect(t, th, field.ID, "channel", model.NewId(), "secret")

		existing.Value = json.RawMessage(`"changed"`)
		_, upErr := th.service.UpdatePropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)

		_, createErr := th.service.CreatePropertyValue(RequestContextWithCallerID(th.Context, caller), &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    field.ID,
			TargetType: "channel",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"first-secret"`),
		})
		require.NoError(t, createErr, "no stored value yet means nothing is hidden, so a caller who holds nothing may still tag an untagged object")
	})

	t.Run("a caller listed in except is never refused", func(t *testing.T) {
		exemptCaller := model.NewId()
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-Exempt", model.PropertyFieldTypeText, &model.Masking{
			Except: []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: exemptCaller}},
		}))
		require.NoError(t, err)

		existing := writeValueDirect(t, th, field.ID, "channel", model.NewId(), "secret")

		existing.Value = json.RawMessage(`"changed"`)
		_, upErr := th.service.UpdatePropertyValue(RequestContextWithCallerID(th.Context, exemptCaller), th.CPAGroupID, existing)
		require.NoError(t, upErr)
	})

	t.Run("an unmasked field is unaffected", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-Unmasked", model.PropertyFieldTypeText, nil))
		require.NoError(t, err)

		existing := writeValueDirect(t, th, field.ID, "channel", model.NewId(), "secret")

		existing.Value = json.RawMessage(`"changed"`)
		_, upErr := th.service.UpdatePropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), th.CPAGroupID, existing)
		require.NoError(t, upErr)
	})

	t.Run("a delete is refused on the same terms as an update, and admitted once the caller holds the value", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-DeleteRefused", model.PropertyFieldTypeText, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		existing := writeValueDirect(t, th, field.ID, "channel", model.NewId(), "secret")

		delErr := th.service.DeletePropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, existing.ID)
		require.Error(t, delErr)
		assert.ErrorIs(t, delErr, ErrAccessDenied)

		writeValueDirect(t, th, field.ID, "user", caller, "secret")
		delErr = th.service.DeletePropertyValue(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, existing.ID)
		require.NoError(t, delErr)
	})

	t.Run("a batch write on one field and target loads the stored value and the caller's holdings once each", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedField(th.CPAGroupID, "Write-BatchLoad", model.PropertyFieldTypeText, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "secret")
		target := model.NewId()
		writeValueDirect(t, th, field.ID, "channel", target, "secret")

		counter := &countingPropertyValueStore{PropertyValueStore: th.service.valueStore}
		th.service.valueStore = counter
		t.Cleanup(func() { th.service.valueStore = counter.PropertyValueStore })

		_, upErr := th.service.UpsertPropertyValues(RequestContextWithCallerID(th.Context, caller), []*model.PropertyValue{
			{GroupID: th.CPAGroupID, FieldID: field.ID, TargetType: "channel", TargetID: target, Value: json.RawMessage(`"secret"`)},
			{GroupID: th.CPAGroupID, FieldID: field.ID, TargetType: "channel", TargetID: target, Value: json.RawMessage(`"secret"`)},
		})
		require.NoError(t, upErr)
		assert.Equal(t, 2, counter.searches, "one search for the stored value at (field, target) and one for the caller's own holdings, memoized across the batch rather than repeated per item")
	})
}

// maskedOptionField builds a standalone (no LinkedFieldID) option-supporting
// field carrying masking, with options inlined -- the option-list analogue of
// maskedField, which carries none because value masking never needs one.
func maskedOptionField(groupID, name string, fieldType model.PropertyFieldType, options []any, masking *model.Masking) *model.PropertyField {
	return &model.PropertyField{
		GroupID:    groupID,
		Name:       name,
		Type:       fieldType,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: options,
		},
		Permissions: &model.Permissions{Masking: masking},
	}
}

// erroringAncestorsFieldStore wraps a store.PropertyFieldStore and forces
// GetOptionAncestorsOrSelf to fail, so a test can exercise the fail-closed
// path a graph resolution failure takes without needing a real broken
// hierarchy to provoke it.
type erroringAncestorsFieldStore struct {
	store.PropertyFieldStore
}

func (e *erroringAncestorsFieldStore) GetOptionAncestorsOrSelf(field *model.PropertyField, optionIDs []string) (map[string][]string, error) {
	return nil, errors.New("forced failure for test")
}

// erroringSearchValueStore wraps a store.PropertyValueStore and forces
// SearchPropertyValues to fail, so a test can exercise a masking filter's
// holdings-lookup failure path -- the one every field type shares, not just
// graph's ancestor walk -- without needing a real broken store.
type erroringSearchValueStore struct {
	store.PropertyValueStore
}

func (e *erroringSearchValueStore) SearchPropertyValues(opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	return nil, errors.New("forced failure for test")
}

// TestMaskFieldOptions covers the option list a field read carries inline, on
// a field carrying masking: option.read (stubbed here to always allow a human
// caller) stays the coarse "may the caller enumerate this field's options at
// all" gate, and masking decides which of the field's options come back once
// that gate is passed.
func TestMaskFieldOptions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	alwaysAllow := func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
		return true
	}
	th.service.setLadderCheckerForTests(alwaysAllow)
	t.Cleanup(func() {
		th.service.setLadderCheckerForTests(nil)
		th.service.setPluginCheckerForTests(nil)
	})

	t.Run("select: the returned list is exactly what the caller holds, and the field's name and type stay intact", func(t *testing.T) {
		options := []any{
			map[string]any{"id": "opt_a", "name": "A"},
			map[string]any{"id": "opt_b", "name": "B"},
		}
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Select-Options", model.PropertyFieldTypeSelect, options, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.Equal(t, []string{"opt_a"}, optionIDsOf(t, retrieved))
		assert.Equal(t, "Mask-Select-Options", retrieved.Name)
		assert.Equal(t, model.PropertyFieldTypeSelect, retrieved.Type)
	})

	t.Run("multiselect: the returned list is exactly what the caller holds", func(t *testing.T) {
		options := []any{
			map[string]any{"id": "opt_a", "name": "A"},
			map[string]any{"id": "opt_b", "name": "B"},
			map[string]any{"id": "opt_c", "name": "C"},
		}
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Multiselect-Options", model.PropertyFieldTypeMultiselect, options, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{"opt_a", "opt_c"})

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"opt_a", "opt_c"}, optionIDsOf(t, retrieved))
	})

	t.Run("rank: only the option the caller holds exactly comes back, not the options below it", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Rank-Options", model.PropertyFieldTypeRank, rankOptions(), &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_secret") // rank 3 of 4, not the top

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		// TestRankSharedOnly_FieldOptions shows the whole ladder at or below
		// opt_secret for the legacy path. Masking must show only the exact
		// option, never the ladder below it.
		assert.Equal(t, []string{"opt_secret"}, optionIDsOf(t, retrieved),
			"masking must never apply the rank ladder, only exact-option membership")
	})

	t.Run("graph: a caller holding an ancestor receives that option and the ones below it that they cover, and no unrelated branch", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "graph-options-source" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		field, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "graph-options-source"), &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Graph-Options",
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

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"Air Program", "Fighter Jet Program"}, inlineOptionNames(t, retrieved),
			"the caller covers Air Program and, through it, Fighter Jet Program -- but not the unrelated Sea Program")
	})

	t.Run("a caller who holds nothing receives no options; a plugin in except receives all of them", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "listed-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		options := []any{
			map[string]any{"id": "opt_a", "name": "A"},
			map[string]any{"id": "opt_b", "name": "B"},
		}
		field := maskedOptionField(th.CPAGroupID, "Mask-Options-Except", model.PropertyFieldTypeSelect, options, &model.Masking{
			Except: []model.Identity{{Type: model.PropertyOwnerTypePlugin, ID: "listed-plugin"}},
		})
		// The plugin still needs option.read to reach the filter at all --
		// except only excuses a caller the permission gate already admitted.
		field.Permissions.Grants = []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "listed-plugin"}, Allow: []string{model.PropertyActionOptionRead}},
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)
		field = created

		noHoldingsCaller := model.NewId()
		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, noHoldingsCaller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.Empty(t, optionIDsOf(t, retrieved), "a caller holding nothing for the field sees no options")

		retrieved, err = th.service.GetPropertyField(RequestContextWithCallerID(th.Context, "listed-plugin"), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"opt_a", "opt_b"}, optionIDsOf(t, retrieved), "an except entry receives the option list unfiltered")
	})

	t.Run("a masked field whose options were omitted from the read returns no options and no option count", func(t *testing.T) {
		options := oversizedOptions(false)
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Options-Omitted", model.PropertyFieldTypeSelect, options, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, optionIDAt(t, options, 7))

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsHidden(t, retrieved)
	})

	t.Run("a graph resolution failure hides the options and logs, never falling through to the unfiltered list", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "graph-options-failure-source" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		field, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "graph-options-failure-source"), &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Graph-Options-Failure",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
				},
			},
			Permissions: &model.Permissions{Masking: &model.Masking{}},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, field)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{ids["Air Program"]})

		original := th.service.fieldStore
		th.service.fieldStore = &erroringAncestorsFieldStore{PropertyFieldStore: original}
		t.Cleanup(func() { th.service.fieldStore = original })

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsHidden(t, retrieved)
	})

	t.Run("the option.read gate refusing the caller still hides the options, and masking is never consulted", func(t *testing.T) {
		th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
			return false
		})
		t.Cleanup(func() { th.service.setLadderCheckerForTests(alwaysAllow) })

		options := []any{map[string]any{"id": "opt_a", "name": "A"}}
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Options-Denied", model.PropertyFieldTypeSelect, options, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, caller), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsHidden(t, retrieved)
	})

	t.Run("a field with permissions but no masking returns its full option list", func(t *testing.T) {
		options := []any{
			map[string]any{"id": "opt_a", "name": "A"},
			map[string]any{"id": "opt_b", "name": "B"},
		}
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Options-None", model.PropertyFieldTypeSelect, options, nil))
		require.NoError(t, err)

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.NewId()), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"opt_a", "opt_b"}, optionIDsOf(t, retrieved))
	})
}

// TestMaskOptionPage covers the paged option listing on a field carrying
// masking: option.read (stubbed here to always allow a human caller) still
// gates whether the caller may enumerate at all, and masking decides which
// options on the page come back. This is a separate gate from
// TestMaskFieldOptions because the paged listing reads options straight from
// their own rows and reaches none of the inline-list filtering -- so this
// generalizes filterSharedOnlyGraphOptionPage off graph-only and access_mode
// onto every option-supporting type and masking.
func TestMaskOptionPage(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	alwaysAllow := func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
		return true
	}
	th.service.setLadderCheckerForTests(alwaysAllow)
	t.Cleanup(func() {
		th.service.setLadderCheckerForTests(nil)
		th.service.setPluginCheckerForTests(nil)
	})

	t.Run("graph: the page keeps the options the caller covers, and none of them report parents", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Page-Graph",
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

		page, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, caller), field, 0, "", 100)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"Air Program", "Fighter Jet Program"}, listedNames(page),
			"the caller covers Air Program and, through it, Fighter Jet Program -- but not the unrelated Sea Program")
		for _, option := range page {
			assert.Nil(t, option.Parents, "a page option must never report what sits above it")
		}
	})

	t.Run("select or multiselect: the page keeps only the options the caller holds exactly", func(t *testing.T) {
		for _, fieldType := range []model.PropertyFieldType{model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect} {
			t.Run(string(fieldType), func(t *testing.T) {
				options := []any{
					map[string]any{"id": "opt_a", "name": "A"},
					map[string]any{"id": "opt_b", "name": "B"},
					map[string]any{"id": "opt_c", "name": "C"},
				}
				field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Page-"+string(fieldType), fieldType, options, &model.Masking{}))
				require.NoError(t, err)

				caller := model.NewId()
				var held any = "opt_a"
				want := []string{"A"}
				if fieldType == model.PropertyFieldTypeMultiselect {
					held = []string{"opt_a", "opt_c"}
					want = []string{"A", "C"}
				}
				writeValueDirect(t, th, field.ID, "user", caller, held)

				page, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, caller), field, 0, "", 100)
				require.NoError(t, err)
				assert.ElementsMatch(t, want, listedNames(page))
			})
		}
	})

	t.Run("a caller who holds nothing gets an empty page; a plugin listed in except gets the whole page", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "listed-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		options := []any{
			map[string]any{"id": "opt_a", "name": "A"},
			map[string]any{"id": "opt_b", "name": "B"},
		}
		field := maskedOptionField(th.CPAGroupID, "Mask-Page-Except", model.PropertyFieldTypeSelect, options, &model.Masking{
			Except: []model.Identity{{Type: model.PropertyOwnerTypePlugin, ID: "listed-plugin"}},
		})
		// The plugin still needs option.read to reach the filter at all -- except
		// only excuses a caller the permission gate already admitted.
		field.Permissions.Grants = []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "listed-plugin"}, Allow: []string{model.PropertyActionOptionRead}},
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)
		field = created

		noHoldingsCaller := model.NewId()
		page, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, noHoldingsCaller), field, 0, "", 100)
		require.NoError(t, err)
		assert.Empty(t, page, "a caller holding nothing for the field is shown no options")

		page, err = th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, "listed-plugin"), field, 0, "", 100)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"A", "B"}, listedNames(page), "an except entry receives the page unfiltered")
	})

	t.Run("two consecutive pages of one listing are filtered against the same holdings", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Page-Paged",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
					map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
					map[string]any{"name": "Sea Program"},
				},
			},
			Permissions: &model.Permissions{Masking: &model.Masking{}},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, field)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{ids["Fighter Jet Program"]})

		full, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, caller), field, 0, "", 100)
		require.NoError(t, err)

		var pagedNames []string
		var cursorCreateAt int64
		var cursorID string
		for {
			page, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, caller), field, cursorCreateAt, cursorID, 1)
			require.NoError(t, err)
			if len(page) == 0 {
				break
			}
			require.Len(t, page, 1, "a page never holds more than the size asked for")
			pagedNames = append(pagedNames, page[0].Name)
			cursorCreateAt, cursorID = page[0].CreateAt, page[0].ID
			require.LessOrEqual(t, len(pagedNames), 4, "the listing has to end")
		}

		assert.ElementsMatch(t, listedNames(full), pagedNames,
			"paging one option at a time reaches exactly what one big page does, filtered against the same holdings each time")
	})

	t.Run("a resolution failure returns an error rather than an empty page", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Page-Failure",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
				},
			},
			Permissions: &model.Permissions{Masking: &model.Masking{}},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, field)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, []string{ids["Air Program"]})

		original := th.service.fieldStore
		th.service.fieldStore = &erroringAncestorsFieldStore{PropertyFieldStore: original}
		t.Cleanup(func() { th.service.fieldStore = original })

		_, err = th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, caller), field, 0, "", 100)
		require.Error(t, err, "a listing has somewhere to put a resolution failure, unlike every other masking path")
	})

	t.Run("the option.read gate refusing the caller still serves no options, and masking is never consulted", func(t *testing.T) {
		th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
			return false
		})
		t.Cleanup(func() { th.service.setLadderCheckerForTests(alwaysAllow) })

		options := []any{map[string]any{"id": "opt_a", "name": "A"}}
		field, err := th.service.CreatePropertyField(th.Context, maskedOptionField(th.CPAGroupID, "Mask-Page-Denied", model.PropertyFieldTypeSelect, options, &model.Masking{}))
		require.NoError(t, err)

		caller := model.NewId()
		writeValueDirect(t, th, field.ID, "user", caller, "opt_a")

		page, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, caller), field, 0, "", 100)
		require.NoError(t, err)
		assert.Empty(t, page)
	})

	t.Run("acceptance: on a linked graph channel field, the options a channel admin may page from match the values they may read", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "Mask-Picker-Template",
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
					map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
					map[string]any{"name": "Sea Program"},
				},
			},
		})
		require.NoError(t, err)
		ids := optionIDsByName(t, template)

		// holdings is a user-object field linked to the same template, so its
		// option IDs are the template's -- what an admin holds here and what the
		// linked channel field's values name are the same identifiers.
		holdings, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Mask-Picker-Holdings",
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
			Name:       "Mask-Picker-Linked",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			// A linked field's masking is locked to its template, but it still
			// needs its own (masking-empty) Permissions object for the
			// permission gate to run at all -- a nil Permissions falls
			// through to the legacy access_mode path instead.
			Permissions:   &model.Permissions{},
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, err)

		admin := model.NewId()
		writeValueDirect(t, th, holdings.ID, "user", admin, []string{ids["Fighter Jet Program"]})

		channelID := model.NewId()
		covered := writeValueDirect(t, th, linked.ID, "channel", channelID, []string{ids["F-18 Program"]})
		uncovered := writeValueDirect(t, th, linked.ID, "channel", model.NewId(), []string{ids["Sea Program"]})

		page, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, admin), linked, 0, "", 100)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"Fighter Jet Program", "F-18 Program"}, listedNames(page),
			"the picker offers exactly the programs the admin's own holdings cover")

		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, admin), th.CPAGroupID, covered.ID)
		require.NoError(t, err)
		assert.NotNil(t, retrieved, "a value naming an option the picker offered must itself be readable")

		retrieved, err = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, admin), th.CPAGroupID, uncovered.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "the picker withheld Sea Program, so a value naming it must be withheld too")
	})
}
