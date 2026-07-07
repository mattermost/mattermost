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
	hook := NewLicenseCheckHook(func() *model.License {
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
