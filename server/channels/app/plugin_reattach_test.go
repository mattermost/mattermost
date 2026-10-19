// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestReattachReservedPlugin(t *testing.T) {
	// No server/environment is available: reservation must precede lifecycle access,
	// including the detach of an existing instance.
	ch := &Channels{}
	for _, id := range []string{model.CoreServerPluginID, "Com.Mattermost.Server"} {
		err := ch.ReattachPlugin(&model.Manifest{Id: id}, nil)
		require.NotNil(t, err)
		require.Equal(t, "app.plugin.reserved_id.app_error", err.Id)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
	}
}
