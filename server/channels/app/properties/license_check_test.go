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

	group, err := th.service.RegisterPropertyGroup("test_license_check")
	require.NoError(t, err)

	var currentLicense *model.License
	hook := NewLicenseCheckHook(func() *model.License {
		return currentLicense
	}, group.ID)
	th.service.AddHook(hook)

	enterpriseLicense := &model.License{
		SkuShortName: model.LicenseShortSkuEnterprise,
	}

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

	t.Run("allows field create with enterprise license", func(t *testing.T) {
		currentLicense = enterpriseLicense
		created, createErr := th.service.CreatePropertyField(th.Context, makeField())
		require.NoError(t, createErr)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("blocks field read without license", func(t *testing.T) {
		currentLicense = enterpriseLicense
		created, createErr := th.service.CreatePropertyField(th.Context, makeField())
		require.NoError(t, createErr)

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
		otherGroup, groupErr := th.service.RegisterPropertyGroup("test_no_license_needed")
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
}
