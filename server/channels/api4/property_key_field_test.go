// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestKeyPropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_key_fields", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)

	createKeyField := func(prefix any) (*model.PropertyField, *model.Response, error) {
		return th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeKey,
			TargetType: "system",
			Attrs:      model.StringInterface{model.PropertyFieldAttrPrefix: prefix},
		})
	}
	patchValue := func(field *model.PropertyField, targetID string, raw string) (*model.PropertyValue, *model.Response, error) {
		values, resp, err := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, "post", targetID, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(raw)},
		})
		if err != nil {
			return nil, resp, err
		}
		require.Len(t, values, 1)
		return values[0], resp, nil
	}

	field, resp, err := createKeyField("api")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	assert.Equal(t, model.PropertyFieldTypeKey, field.Type)
	assert.Equal(t, "API", field.Attrs[model.PropertyFieldAttrPrefix])

	t.Run("values are assigned 1, 2, 3 over REST", func(t *testing.T) {
		targets := []string{th.BasicPost.Id, th.CreatePost(t).Id, th.CreatePost(t).Id}
		for i, targetID := range targets {
			value, valueResp, valueErr := patchValue(field, targetID, `null`)
			require.NoError(t, valueErr)
			CheckOKStatus(t, valueResp)
			assert.JSONEq(t, strconv.Itoa(i+1), string(value.Value))
		}

		stored, getResp, getErr := th.SystemAdminClient.GetPropertyValues(context.Background(), group.Name, "post", targets[1], model.PropertyValueSearch{PerPage: 10})
		require.NoError(t, getErr)
		CheckOKStatus(t, getResp)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `2`, string(stored[0].Value))
	})

	t.Run("a number the client read can be sent back, another cannot", func(t *testing.T) {
		targetID := th.CreatePost(t).Id
		value, _, valueErr := patchValue(field, targetID, `null`)
		require.NoError(t, valueErr)

		echoed, _, valueErr := patchValue(field, targetID, string(value.Value))
		require.NoError(t, valueErr)
		assert.JSONEq(t, string(value.Value), string(echoed.Value))

		_, valueResp, valueErr := patchValue(field, targetID, `99`)
		require.Error(t, valueErr)
		CheckBadRequestStatus(t, valueResp)

		_, valueResp, valueErr = patchValue(field, th.CreatePost(t).Id, `99`)
		require.Error(t, valueErr)
		CheckBadRequestStatus(t, valueResp)
	})

	t.Run("a second key field with the same prefix in the group is refused", func(t *testing.T) {
		_, dupResp, dupErr := createKeyField("API")
		require.Error(t, dupErr)
		CheckBadRequestStatus(t, dupResp)

		_, otherResp, otherErr := createKeyField("other")
		require.NoError(t, otherErr)
		CheckCreatedStatus(t, otherResp)
	})

	t.Run("a key field without a valid prefix is refused", func(t *testing.T) {
		for _, prefix := range []any{"", "1AB", "A B", "ABCDEFGHIJK", nil} {
			_, badResp, badErr := createKeyField(prefix)
			require.Error(t, badErr, "prefix %v", prefix)
			CheckBadRequestStatus(t, badResp)
		}
	})

	t.Run("a key field cannot be retyped", func(t *testing.T) {
		text := model.PropertyFieldTypeText
		_, patchResp, patchErr := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", field.ID, &model.PropertyFieldPatch{Type: &text})
		require.Error(t, patchErr)
		CheckBadRequestStatus(t, patchResp)
	})
}
