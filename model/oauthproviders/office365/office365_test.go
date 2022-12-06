// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthoffice365

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOffice365UserFromJSON(t *testing.T) {
	ou := Office365User{
		FirstName: "ali",
		Id:        "12345",
		LastName:  "maya",
		Mail:      "ali@test.com",
	}

	provider := &Office365Provider{}

	t.Run("valid office365 user", func(t *testing.T) {
		b, err := json.Marshal(ou)
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
