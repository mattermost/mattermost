// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestLocalPluginPublicKeys(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	path, _ := fileutils.FindDir("tests")
	publicKey, err := os.ReadFile(filepath.Join(path, "development-public-key.asc"))
	require.NoError(t, err)
	otherPublicKey, err := os.ReadFile(filepath.Join(path, "development-public-key.gpg"))
	require.NoError(t, err)
	privateKey, err := os.ReadFile(filepath.Join(path, "development-private-key.asc"))
	require.NoError(t, err)

	ctx := context.Background()
	client := th.LocalClient

	t.Run("not available outside local mode", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetPluginPublicKeys(ctx)
		require.Error(t, err)
		assert.NotEqual(t, http.StatusOK, resp.StatusCode)

		resp, err = th.SystemAdminClient.AddPluginPublicKey(ctx, "dev.asc", bytes.NewReader(publicKey))
		require.Error(t, err)
		assert.NotEqual(t, http.StatusCreated, resp.StatusCode)

		names, _, err := client.GetPluginPublicKeys(ctx)
		require.NoError(t, err)
		assert.Empty(t, names)
	})

	t.Run("add, get and delete", func(t *testing.T) {
		resp, err := client.AddPluginPublicKey(ctx, "dev.asc", bytes.NewReader(publicKey))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		names, _, err := client.GetPluginPublicKeys(ctx)
		require.NoError(t, err)
		assert.Equal(t, []string{"dev.asc"}, names)

		data, _, err := client.GetPluginPublicKey(ctx, "dev.asc")
		require.NoError(t, err)
		assert.Equal(t, publicKey, data)

		resp, err = client.AddPluginPublicKey(ctx, "dev.asc", bytes.NewReader(otherPublicKey))
		require.Error(t, err)
		CheckErrorID(t, err, "app.plugin.add_public_key.file_exists.app_error")
		assert.Equal(t, http.StatusConflict, resp.StatusCode)

		names, _, err = client.GetPluginPublicKeys(ctx)
		require.NoError(t, err)
		assert.Equal(t, []string{"dev.asc"}, names)

		data, _, err = client.GetPluginPublicKey(ctx, "dev.asc")
		require.NoError(t, err)
		assert.Equal(t, publicKey, data)

		_, err = client.DeletePluginPublicKey(ctx, "dev.asc")
		require.NoError(t, err)

		names, _, err = client.GetPluginPublicKeys(ctx)
		require.NoError(t, err)
		assert.Empty(t, names)

		exists, err := th.App.Srv().Platform().HasConfigFile("dev.asc")
		require.NoError(t, err)
		assert.False(t, exists)
	})

	t.Run("unknown key", func(t *testing.T) {
		_, resp, err := client.GetPluginPublicKey(ctx, "missing.asc")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		resp, err = client.DeletePluginPublicKey(ctx, "missing.asc")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("invalid name", func(t *testing.T) {
		for _, name := range []string{"bad name.asc", ".hidden"} {
			resp, err := client.AddPluginPublicKey(ctx, name, bytes.NewReader(publicKey))
			require.Error(t, err, name)
			CheckBadRequestStatus(t, resp)
		}
	})

	t.Run("invalid key", func(t *testing.T) {
		resp, err := client.AddPluginPublicKey(ctx, "garbage.asc", bytes.NewReader([]byte("not a key")))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.AddPluginPublicKey(ctx, "private.asc", bytes.NewReader(privateKey))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		names, _, err := client.GetPluginPublicKeys(ctx)
		require.NoError(t, err)
		assert.Empty(t, names)
	})

	t.Run("does not overwrite unrelated config files", func(t *testing.T) {
		require.NoError(t, th.App.Srv().Platform().SetConfigFile("saml-idp.crt", []byte("certificate")))

		resp, err := client.AddPluginPublicKey(ctx, "saml-idp.crt", bytes.NewReader(publicKey))
		require.Error(t, err)
		CheckErrorID(t, err, "app.plugin.add_public_key.file_exists.app_error")
		assert.Equal(t, http.StatusConflict, resp.StatusCode)

		data, err := th.App.Srv().Platform().GetConfigFile("saml-idp.crt")
		require.NoError(t, err)
		assert.Equal(t, []byte("certificate"), data)
	})

	t.Run("does not overwrite a listed file", func(t *testing.T) {
		require.NoError(t, th.App.Srv().Platform().SetConfigFile("listed.asc", []byte("not a key")))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.SignaturePublicKeyFiles = []string{"listed.asc"}
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.PluginSettings.SignaturePublicKeyFiles = []string{}
			})
			require.NoError(t, th.App.Srv().Platform().RemoveConfigFile("listed.asc"))
		})

		resp, err := client.AddPluginPublicKey(ctx, "listed.asc", bytes.NewReader(publicKey))
		require.Error(t, err)
		CheckErrorID(t, err, "app.plugin.add_public_key.file_exists.app_error")
		assert.Equal(t, http.StatusConflict, resp.StatusCode)

		data, err := th.App.Srv().Platform().GetConfigFile("listed.asc")
		require.NoError(t, err)
		assert.Equal(t, []byte("not a key"), data)
	})
}
