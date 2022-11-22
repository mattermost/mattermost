// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthgoogle

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGoogleUserFromJSON(t *testing.T) {
	gu := GoogleUser{
		Metadata: GoogleUserRootMetadata{
			Sources: []SourceElement{
				{
					Etag: "tag",
				},
			},
		},
		Emails: []GoogleGenericInfoNode{
			{
				Value: "ali@test.com",
			},
		},
		Names: []GoogleUserNameNode{
			{
				GivenName: "ali",
			},
		},
		Nicknames: []GoogleGenericInfoNode{
			{
				Value: "ila",
			},
		},
	}

	provider := &GoogleProvider{}

	t.Run("valid google user", func(t *testing.T) {
		b, err := json.Marshal(gu)
		require.NoError(t, err)

		_, err = provider.GetUserFromJSON(bytes.NewReader(b), nil)
		require.NoError(t, err)

		_, err = provider.GetAuthDataFromJSON(bytes.NewReader(b))
		require.NoError(t, err)
	})

	t.Run("empty body should fail without panic", func(t *testing.T) {
		_, err := provider.GetUserFromJSON(strings.NewReader("{}"), nil)
		require.NoError(t, err)

		_, err = provider.GetAuthDataFromJSON(strings.NewReader("{}"))
		require.Error(t, err)
	})
}
