// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/config"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

// NotifyUpdate calls webhooks.
func (wh *Client) NotifyUpdate(block *model.Block) {
	if len(wh.config.WebhookUpdate) < 1 {
		return
	}

	json, err := json.Marshal(block)
	if err != nil {
		wh.logger.Fatal("NotifyUpdate: json.Marshal", mlog.Err(err))
	}
	for _, url := range wh.config.WebhookUpdate {
		resp, _ := http.Post(url, "application/json", bytes.NewBuffer(json)) //nolint:gosec
		_, _ = io.ReadAll(resp.Body)
		resp.Body.Close()

		wh.logger.Debug("webhook.NotifyUpdate", mlog.String("url", url))
	}
}

// Client is a webhook client.
type Client struct {
	config *config.Configuration
	logger mlog.LoggerIFace
}

// NewClient creates a new Client.
func NewClient(config *config.Configuration, logger mlog.LoggerIFace) *Client {
	return &Client{
		config: config,
		logger: logger,
	}
}
