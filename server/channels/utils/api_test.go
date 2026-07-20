// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/asn1"
	"encoding/base64"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func TestRenderWebError(t *testing.T) {
	r := httptest.NewRequest("GET", "http://foo", nil)
	w := httptest.NewRecorder()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	RenderWebError(&model.Config{}, w, r, http.StatusTemporaryRedirect, url.Values{
		"foo": []string{"bar"},
	}, key)

	resp := w.Result()
	location, err := url.Parse(resp.Header.Get("Location"))
	require.NoError(t, err)
	require.NotEmpty(t, location.Query().Get("s"))

	type ecdsaSignature struct {
		R, S *big.Int
	}
	var rs ecdsaSignature
	s, err := base64.URLEncoding.DecodeString(location.Query().Get("s"))
	require.NoError(t, err)
	_, err = asn1.Unmarshal(s, &rs)
	require.NoError(t, err)

	assert.Equal(t, "bar", location.Query().Get("foo"))
	h := sha256.Sum256([]byte("/error?foo=bar"))
	assert.True(t, ecdsa.Verify(&key.PublicKey, h[:], rs.R, rs.S))
}

func TestRenderMobileError(t *testing.T) {
	require.NoError(t, i18n.TranslationsPreInitFromFileBytes("en.json", []byte(`[{"id":"api.back_to_app","translation":"Back to {{.SiteName}}"}]`)))

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	*cfg.TeamSettings.SiteName = "Mattermost<test>"
	cfg.NativeAppSettings.AppCustomURLSchemes = []string{"mattermost"}

	appErr := model.NewAppError("test", "api.test.error", nil, "details", http.StatusBadRequest)
	appErr.Message = "Something went <wrong>"

	t.Run("renders html with special characters encoded in site name", func(t *testing.T) {
		w := httptest.NewRecorder()
		RenderMobileError(cfg, w, appErr, "mattermost://auth/complete")

		body := w.Body.String()
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, body, "Mattermost&lt;test&gt;")
		assert.NotContains(t, body, "Mattermost<test>")
	})

	t.Run("renders html with special characters encoded in error message", func(t *testing.T) {
		w := httptest.NewRecorder()
		RenderMobileError(cfg, w, appErr, "mattermost://auth/complete")

		body := w.Body.String()
		assert.Contains(t, body, "Something went &lt;wrong&gt;")
		assert.NotContains(t, body, "Something went <wrong>")
	})

	t.Run("falls back to site url for invalid redirect scheme", func(t *testing.T) {
		w := httptest.NewRecorder()
		RenderMobileError(cfg, w, appErr, "https://evil.example.com/callback")

		body := w.Body.String()
		assert.Contains(t, body, "http://localhost:8065")
		assert.False(t, strings.Contains(body, "evil.example.com"))
	})
}
