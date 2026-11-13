// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLicenseCheckHook(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_license_check", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	var currentLicense *model.License
	hook := NewLicenseCheckHook(th.service, func() *model.License {
		return currentLicense
	}, group.ID)
	th.service.AddHook(hook)

	enterpriseLicense := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)

	makeField := func() *model.PropertyField {
		return &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		}
	}

	t.Run("blocks field create without license", func(t *testing.T) {
		currentLicense = nil
		_, createErr := th.service.CreatePropertyField(th.Context, makeField())
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "license_error")
	})

	t.Run("allows field create with license, blocks read after license loss", func(t *testing.T) {
		currentLicense = enterpriseLicense
		created, createErr := th.service.CreatePropertyField(th.Context, makeField())
		require.NoError(t, createErr)
		assert.NotEmpty(t, created.ID)

		currentLicense = nil
		_, getErr := th.service.GetPropertyField(th.Context, group.ID, created.ID)
		require.Error(t, getErr)
		assert.Contains(t, getErr.Error(), "license_error")
	})

	t.Run("blocks value upsert without license", func(t *testing.T) {
		currentLicense = enterpriseLicense
		field := th.CreatePropertyFieldDirect(t, makeField())

		currentLicense = nil
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"hello"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "license_error")
	})

	t.Run("blocks option read and change without license", func(t *testing.T) {
		currentLicense = enterpriseLicense
		field := makeField()
		field.Type = model.PropertyFieldTypeMultiselect
		field.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": model.NewId(), "name": "Air"},
			},
		}
		created := th.CreatePropertyFieldDirect(t, field)

		// A field's options are the field, licensing included: reading or changing
		// them one at a time writes no field row, so this is the only place the
		// requirement can be applied to that path.
		currentLicense = nil
		_, getErr := th.service.GetFieldOptions(th.Context, created.GroupID, created.ID, 0, "", 100)
		require.Error(t, getErr)
		assert.Contains(t, getErr.Error(), "license_error")

		_, createErr := th.service.CreateFieldOptions(th.Context, created.GroupID, created.ID, []*model.PropertyFieldOption{{Name: "Sea"}})
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "license_error")

		// GetFieldOptions has no hook that answers ShowNothing, so the early exit
		// this hook backs is never reached through the service; call it directly.
		_, preErr := hook.PreGetPropertyFieldOptions(th.Context, created, nil)
		require.Error(t, preErr)
		assert.Contains(t, preErr.Error(), "license_error")

		currentLicense = enterpriseLicense
		_, preErr = hook.PreGetPropertyFieldOptions(th.Context, created, nil)
		require.NoError(t, preErr)
	})

	t.Run("allows operations on unmanaged groups without license", func(t *testing.T) {
		currentLicense = nil
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_no_license_needed", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)

		field := &model.PropertyField{
			GroupID:    otherGroup.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("calls naming no group are judged by the group they reach", func(t *testing.T) {
		currentLicense = enterpriseLicense
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "unnamed_group_unmanaged", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)

		managedField := th.CreatePropertyFieldDirect(t, makeField())
		unmanagedField := makeField()
		unmanagedField.GroupID = otherGroup.ID
		unmanagedField = th.CreatePropertyFieldDirect(t, unmanagedField)

		seed := func(field *model.PropertyField, targetID string) *model.PropertyValue {
			v, seedErr := th.dbStore.PropertyValue().Create(&model.PropertyValue{
				GroupID:    field.GroupID,
				FieldID:    field.ID,
				TargetID:   targetID,
				TargetType: "user",
				Value:      json.RawMessage(`"x"`),
			})
			require.NoError(t, seedErr)
			return v
		}
		managedTarget, unmanagedTarget := model.NewId(), model.NewId()
		managedValue := seed(managedField, managedTarget)
		unmanagedValue := seed(unmanagedField, unmanagedTarget)

		stated := func(v *model.PropertyValue) *model.PropertyValue {
			return &model.PropertyValue{GroupID: v.GroupID, FieldID: v.FieldID, TargetID: v.TargetID, TargetType: v.TargetType, Value: v.Value}
		}
		cases := []struct {
			name               string
			managed, unmanaged func() error
		}{
			{"update value",
				func() error { _, e := hook.PreUpdatePropertyValue(th.Context, "", stated(managedValue)); return e },
				func() error { _, e := hook.PreUpdatePropertyValue(th.Context, "", stated(unmanagedValue)); return e }},
			{"update values",
				func() error {
					_, e := hook.PreUpdatePropertyValues(th.Context, "", []*model.PropertyValue{stated(managedValue)})
					return e
				},
				func() error {
					_, e := hook.PreUpdatePropertyValues(th.Context, "", []*model.PropertyValue{stated(unmanagedValue)})
					return e
				}},
			{"delete value",
				func() error { return hook.PreDeletePropertyValue(th.Context, "", managedValue.ID) },
				func() error { return hook.PreDeletePropertyValue(th.Context, "", unmanagedValue.ID) }},
			{"delete values for field",
				func() error { return hook.PreDeletePropertyValuesForField(th.Context, "", managedField.ID) },
				func() error { return hook.PreDeletePropertyValuesForField(th.Context, "", unmanagedField.ID) }},
			{"delete values for target",
				func() error { return hook.PreDeletePropertyValuesForTarget(th.Context, "", "user", managedTarget) },
				func() error { return hook.PreDeletePropertyValuesForTarget(th.Context, "", "user", unmanagedTarget) }},
			{"delete field",
				func() error { return hook.PreDeletePropertyField(th.Context, "", managedField.ID) },
				func() error { return hook.PreDeletePropertyField(th.Context, "", unmanagedField.ID) }},
		}
		for _, c := range cases {
			currentLicense = nil
			err := c.managed()
			require.Error(t, err, c.name)
			assert.Contains(t, err.Error(), "license_error", c.name)
			assert.NoError(t, c.unmanaged(), c.name)

			currentLicense = enterpriseLicense
			assert.NoError(t, c.managed(), c.name)
		}

		// A target-wide delete reaches every managed group, so a target with no
		// value in one is nothing to refuse.
		currentLicense = nil
		assert.NoError(t, hook.PreDeletePropertyValuesForTarget(th.Context, "", "user", model.NewId()))

		// Not-found answers are the delete's to give, not this hook's.
		assert.NoError(t, hook.PreDeletePropertyValue(th.Context, "", model.NewId()))
		assert.NoError(t, hook.PreDeletePropertyValuesForField(th.Context, "", model.NewId()))
		assert.NoError(t, hook.PreDeletePropertyField(th.Context, "", model.NewId()))
	})

	t.Run("a batch is judged by every value, not the first", func(t *testing.T) {
		currentLicense = nil
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "batch_group_unmanaged", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)
		batch := []*model.PropertyValue{{GroupID: otherGroup.ID}, {GroupID: group.ID}}

		_, createErr := hook.PreCreatePropertyValues(th.Context, batch)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "license_error")

		_, upsertErr := hook.PreUpsertPropertyValues(th.Context, batch)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "license_error")

		_, updateErr := hook.PreUpdatePropertyValues(th.Context, "", batch)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "license_error")

		_, createErr = hook.PreCreatePropertyValues(th.Context, batch[:1])
		assert.NoError(t, createErr)
	})

	countCalls := []struct {
		name string
		call func(groupID string) error
	}{
		{"CountActivePropertyFieldsForGroup", func(id string) error {
			_, err := th.service.CountActivePropertyFieldsForGroup(th.Context, id)
			return err
		}},
		{"CountAllPropertyFieldsForGroup", func(id string) error {
			_, err := th.service.CountAllPropertyFieldsForGroup(th.Context, id)
			return err
		}},
		{"CountActivePropertyFieldsForTarget", func(id string) error {
			_, err := th.service.CountActivePropertyFieldsForTarget(th.Context, id, "user", model.NewId())
			return err
		}},
		{"CountAllPropertyFieldsForTarget", func(id string) error {
			_, err := th.service.CountAllPropertyFieldsForTarget(th.Context, id, "user", model.NewId())
			return err
		}},
	}

	t.Run("blocks field counts without license on managed group", func(t *testing.T) {
		currentLicense = enterpriseLicense
		th.CreatePropertyFieldDirect(t, makeField())
		currentLicense = nil
		for _, c := range countCalls {
			err := c.call(group.ID)
			require.Error(t, err, c.name)
			assert.Contains(t, err.Error(), "license_error", c.name)
		}
	})

	t.Run("allows field counts with license on managed group", func(t *testing.T) {
		currentLicense = enterpriseLicense
		for _, c := range countCalls {
			require.NoError(t, c.call(group.ID), c.name)
		}
	})

	t.Run("allows field counts without license on unmanaged group", func(t *testing.T) {
		currentLicense = nil
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "count_no_license_needed", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)
		for _, c := range countCalls {
			require.NoError(t, c.call(otherGroup.ID), c.name)
		}
	})
}
