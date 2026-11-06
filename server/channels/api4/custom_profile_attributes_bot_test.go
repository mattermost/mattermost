// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestPatchCPAValuesForBot(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), &model.PropertyField{
		Name: celSafeName(),
		Type: model.PropertyFieldTypeText,
	})
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)

	createBot := func(t *testing.T) *model.Bot {
		t.Helper()
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username: GenerateTestUsername(),
			OwnerId:  th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		t.Cleanup(func() { _ = th.App.PermanentDeleteBot(th.Context, bot.UserId) })

		user, resp, err := th.SystemAdminClient.GetUser(context.Background(), bot.UserId, "")
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.True(t, user.IsBot)
		return bot
	}

	setAndRead := func(t *testing.T, bot *model.Bot, value string) {
		t.Helper()
		raw, err := json.Marshal(value)
		require.NoError(t, err)
		patched, resp, err := th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), bot.UserId, map[string]json.RawMessage{
			createdField.ID: raw,
		})
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		var patchedValue string
		require.NoError(t, json.Unmarshal(patched[createdField.ID], &patchedValue))
		require.Equal(t, value, patchedValue)

		listed, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), bot.UserId)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		var listedValue string
		require.NoError(t, json.Unmarshal(listed[createdField.ID], &listedValue))
		require.Equal(t, value, listedValue)
	}

	t.Run("system admin can set and read a bot attribute", func(t *testing.T) {
		setAndRead(t, createBot(t), "Engineering")
	})

	t.Run("attributes are stored per bot", func(t *testing.T) {
		eng := createBot(t)
		sales := createBot(t)
		setAndRead(t, eng, "Engineering")
		setAndRead(t, sales, "Sales")

		listed, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), eng.UserId)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		var listedValue string
		require.NoError(t, json.Unmarshal(listed[createdField.ID], &listedValue))
		require.Equal(t, "Engineering", listedValue)
	})
}
