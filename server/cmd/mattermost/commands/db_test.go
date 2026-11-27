// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

func TestFileBackendSettingsFromConfigTLSVerification(t *testing.T) {
	const planContents = `{"Version":1}`
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
		_, _ = w.Write([]byte(planContents))
	}))
	t.Cleanup(server.Close)

	newConfig := func(insecure bool) *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.ServiceSettings.EnableInsecureOutgoingConnections = model.NewPointer(insecure)
		cfg.FileSettings.DriverName = model.NewPointer(model.ImageDriverS3)
		cfg.FileSettings.AmazonS3Endpoint = model.NewPointer(strings.TrimPrefix(server.URL, "https://"))
		cfg.FileSettings.AmazonS3SSL = model.NewPointer(true)
		cfg.FileSettings.AmazonS3Bucket = model.NewPointer("bucket")
		cfg.FileSettings.AmazonS3Region = model.NewPointer("us-east-1")
		cfg.FileSettings.AmazonS3AccessKeyId = model.NewPointer("accesskey")
		cfg.FileSettings.AmazonS3SecretAccessKey = model.NewPointer("secretkey")
		return cfg
	}

	t.Run("rejects an untrusted certificate by default", func(t *testing.T) {
		backend, err := filestore.NewFileBackend(fileBackendSettingsFromConfig(newConfig(false)))
		require.NoError(t, err)

		_, err = backend.ReadFile("plan.json")
		require.ErrorContains(t, err, "certificate")
	})

	t.Run("accepts an untrusted certificate when insecure outgoing connections are enabled", func(t *testing.T) {
		backend, err := filestore.NewFileBackend(fileBackendSettingsFromConfig(newConfig(true)))
		require.NoError(t, err)

		b, err := backend.ReadFile("plan.json")
		require.NoError(t, err)
		require.Equal(t, planContents, string(b))
	})
}
