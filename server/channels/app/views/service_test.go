// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestNewViewService(t *testing.T) {
	t.Run("fails when ViewStore is nil", func(t *testing.T) {
		_, err := New(ServiceConfig{})
		require.Error(t, err)
	})

	t.Run("succeeds with ViewStore", func(t *testing.T) {
		_, err := New(ServiceConfig{ViewStore: &mocks.ViewStore{}})
		require.NoError(t, err)
	})
}
