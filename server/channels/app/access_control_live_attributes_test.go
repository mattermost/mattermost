// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// TestBuildAccessControlSubjectReadsAttributesWithoutRefresh checks that building a subject never
// refreshes the attribute materialized views, and still sees an attribute written through the app
// on the very next build: the subject is read from the live view, and the write's invalidation
// drops the cached copy.
func TestBuildAccessControlSubjectReadsAttributesWithoutRefresh(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	}).InitBasic(t)
	// The access control property group takes writes only under Enterprise Advanced.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	group, err := th.App.Srv().propertyService.Group(model.AccessControlPropertyGroupName)
	require.NoError(t, err)

	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "clearance_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	original := th.App.Srv().Store()
	counting := &refreshCountingStore{Store: original, attributes: &refreshCountingAttributesStore{AttributesStore: original.Attributes()}}
	th.App.Srv().SetStore(counting)
	t.Cleanup(func() { th.App.Srv().SetStore(original) })

	attributeOf := func(t *testing.T) any {
		t.Helper()
		subject, buildErr := th.App.BuildAccessControlSubject(th.Context, th.BasicUser.Id, th.BasicUser.Roles, "")
		require.Nil(t, buildErr)
		return subject.Attributes[field.Name]
	}

	rawValue := func(t *testing.T, v string) json.RawMessage {
		t.Helper()
		raw, mErr := json.Marshal(v)
		require.NoError(t, mErr)
		return raw
	}

	require.Nil(t, attributeOf(t), "no value written yet")

	value, appErr := th.App.CreatePropertyValue(th.Context, &model.PropertyValue{
		TargetID:   th.BasicUser.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    group.ID,
		FieldID:    field.ID,
		Value:      rawValue(t, "secret"),
	})
	require.Nil(t, appErr)
	require.Equal(t, "secret", attributeOf(t), "the next build sees the written value")

	value.Value = rawValue(t, "top_secret")
	_, appErr = th.App.UpdatePropertyValue(th.Context, group.ID, value)
	require.Nil(t, appErr)
	require.Equal(t, "top_secret", attributeOf(t), "and the updated one")

	require.Zero(t, counting.attributes.refreshes.Load(), "no subject build or attribute write refreshes the views")
}

// refreshCountingStore counts RefreshAttributes calls on the attributes store.
type refreshCountingStore struct {
	store.Store
	attributes *refreshCountingAttributesStore
}

func (s *refreshCountingStore) Attributes() store.AttributesStore { return s.attributes }

type refreshCountingAttributesStore struct {
	store.AttributesStore
	refreshes atomic.Int64
}

func (s *refreshCountingAttributesStore) RefreshAttributes(objectTypes ...string) error {
	s.refreshes.Add(1)
	return s.AttributesStore.RefreshAttributes(objectTypes...)
}
