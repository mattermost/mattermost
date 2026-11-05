// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/asn1"
	"encoding/base64"
	"io"
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
	cfg := &model.Config{}
	cfg.SetDefaults()

	r := httptest.NewRequest("GET", "http://foo", nil)
	w := httptest.NewRecorder()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	RenderWebError(cfg, w, r, http.StatusTemporaryRedirect, url.Values{
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

func TestRenderWebErrorWithTooLongErrorPageURL(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	configWithMaxURLLength := func(maxURLLength int) *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		*cfg.ServiceSettings.MaximumURLLength = maxURLLength
		return cfg
	}

	t.Run("renders the error message without linking to the error page", func(t *testing.T) {
		r := httptest.NewRequest("GET", "http://foo/some/long/path", nil)
		w := httptest.NewRecorder()

		appErr := model.NewAppError("test", "basic_security_check.url.too_long_error", nil, "", http.StatusRequestURITooLong)
		appErr.Message = "URL is too long"
		RenderWebAppError(configWithMaxURLLength(30), w, r, appErr, key)

		body := w.Body.String()
		assert.Equal(t, http.StatusRequestURITooLong, w.Code)
		assert.Equal(t, "text/html", w.Header().Get("Content-Type"))
		assert.Contains(t, body, "URL is too long")
		assert.NotContains(t, body, "/error?")
	})

	t.Run("encodes special characters in the error message", func(t *testing.T) {
		r := httptest.NewRequest("GET", "http://foo/some/long/path", nil)
		w := httptest.NewRecorder()

		appErr := model.NewAppError("test", "test.app_error", nil, "", http.StatusRequestURITooLong)
		appErr.Message = "Something went <wrong>"
		RenderWebAppError(configWithMaxURLLength(30), w, r, appErr, key)

		body := w.Body.String()
		assert.Contains(t, body, "Something went &lt;wrong&gt;")
		assert.NotContains(t, body, "Something went <wrong>")
	})

	t.Run("keeps the original status unless the response was a redirect", func(t *testing.T) {
		for status, expectedStatus := range map[int]int{
			http.StatusFound:               http.StatusBadRequest,
			http.StatusTemporaryRedirect:   http.StatusBadRequest,
			http.StatusBadRequest:          http.StatusBadRequest,
			http.StatusRequestURITooLong:   http.StatusRequestURITooLong,
			http.StatusInternalServerError: http.StatusInternalServerError,
		} {
			r := httptest.NewRequest("GET", "http://foo/some/long/path", nil)
			w := httptest.NewRecorder()

			RenderWebError(configWithMaxURLLength(30), w, r, status, url.Values{
				"type": []string{"oauth_access_denied"},
			}, key)

			body := w.Body.String()
			assert.Equal(t, expectedStatus, w.Code, "for status %d", status)
			assert.Empty(t, w.Header().Get("Location"), "for status %d", status)
			assert.Contains(t, body, "<!-- web error message -->", "for status %d", status)
			assert.NotContains(t, body, "/error?", "for status %d", status)
		}
	})

	t.Run("still points at the error page when it fits within the limit", func(t *testing.T) {
		r := httptest.NewRequest("GET", "http://foo/some/long/path", nil)
		w := httptest.NewRecorder()

		appErr := model.NewAppError("test", "basic_security_check.url.too_long_error", nil, "", http.StatusRequestURITooLong)
		appErr.Message = "URL is too long"
		RenderWebAppError(configWithMaxURLLength(model.ServiceSettingsDefaultMaxURLLength), w, r, appErr, key)

		assert.Equal(t, http.StatusRequestURITooLong, w.Code)
		assert.Contains(t, w.Body.String(), `href="/error?message=URL+is+too+long&amp;s=`)
	})

	t.Run("only renders the error inline once the error page no longer fits", func(t *testing.T) {
		// A fixed signature keeps the error page URL the same length on every run, unlike the
		// DER encoded ECDSA signatures used everywhere else in this test.
		signer := fixedSigner{signature: []byte("a fixed signature")}
		params := url.Values{"message": []string{"URL is too long"}}
		destination := "/error?" + params.Encode() + "&s=" + base64.URLEncoding.EncodeToString(signer.signature)

		r := httptest.NewRequest("GET", "http://foo/some/long/path", nil)

		atLimit := httptest.NewRecorder()
		RenderWebError(configWithMaxURLLength(len(destination)), atLimit, r, http.StatusRequestURITooLong, params, signer)
		assert.Contains(t, atLimit.Body.String(), "/error?")

		pastLimit := httptest.NewRecorder()
		RenderWebError(configWithMaxURLLength(len(destination)-1), pastLimit, r, http.StatusRequestURITooLong, params, signer)
		assert.NotContains(t, pastLimit.Body.String(), "/error?")
	})
}

type fixedSigner struct {
	signature []byte
}

func (s fixedSigner) Public() crypto.PublicKey {
	return nil
}

func (s fixedSigner) Sign(_ io.Reader, _ []byte, _ crypto.SignerOpts) ([]byte, error) {
	return s.signature, nil
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
