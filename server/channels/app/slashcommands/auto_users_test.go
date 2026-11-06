// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestRandomRealisticName(t *testing.T) {
	for range 20 {
		firstName, lastName, username := randomRealisticName()

		require.Contains(t, realisticFirstNames, firstName)
		require.Contains(t, realisticLastNames, lastName)
		assert.True(t, model.IsValidUsername(username), "username should be valid: %s", username)
		assert.True(t, strings.HasPrefix(username, strings.ToLower(firstName)+"."+strings.ToLower(lastName)+"."))
	}
}
