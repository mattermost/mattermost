package webhook

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/config"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// NotifyUpdate calls webhooks.
func (wh *Client) NotifyUpdate(block model.Block) {
	if len(wh.config.WebhookUpdate) < 1 {
		return
	}

	json, err := json.Marshal(block)
	if err != nil {
		wh.logger.Fatal("NotifyUpdate: json.Marshal", mlog.Err(err))
	}
	for _, url := range wh.config.WebhookUpdate {
		resp, _ := http.Post(url, "application/json", bytes.NewBuffer(json)) //nolint:gosec
		_, _ = ioutil.ReadAll(resp.Body)
		resp.Body.Close()

		wh.logger.Debug("webhook.NotifyUpdate", mlog.String("url", url))
	}
}

// Client is a webhook client.
type Client struct {
	config *config.Configuration
	logger *mlog.Logger
}

// NewClient creates a new Client.
func NewClient(config *config.Configuration, logger *mlog.Logger) *Client {
	return &Client{
		config: config,
		logger: logger,
	}
}
