// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/services/config"

	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

func TestClientUpdateNotify(t *testing.T) {
	var isNotified bool
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isNotified = true
	}))
	defer ts.Close()

	cfg := &config.Configuration{
		WebhookUpdate: []string{ts.URL},
	}

	logger := mlog.CreateConsoleTestLogger(false, mlog.LvlDebug)
	defer func() {
		err := logger.Shutdown()
		assert.NoError(t, err)
	}()

	client := NewClient(cfg, logger)

	client.NotifyUpdate(&model.Block{})

	if !isNotified {
		t.Error("webhook url not be notified")
	}
}
