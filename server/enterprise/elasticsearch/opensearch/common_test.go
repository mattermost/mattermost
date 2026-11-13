// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestCreateClientConfigEnablesHTTP2Pings(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	osCfg, appErr := createClientConfig(mlog.CreateConsoleTestLogger(t), cfg, nil, false)
	require.Nil(t, appErr)

	tp, ok := osCfg.Client.Transport.(*http.Transport)
	require.True(t, ok)
	require.NotNil(t, tp.HTTP2)
	assert.Equal(t, http2SendPingTimeout, tp.HTTP2.SendPingTimeout)
	assert.True(t, tp.ForceAttemptHTTP2)
}
