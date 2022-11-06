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
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestRenderWebError(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "http://foo", http.NoBody)
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
