// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
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

		c := make(maskingContext)
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
