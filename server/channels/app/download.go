// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const (
	// HTTPRequestTimeout defines a high timeout for downloading large files
	// from an external URL to avoid slow connections from failing to install.
	HTTPRequestTimeout = 1 * time.Hour
)

func (a *App) DownloadFromURL(downloadURL string) ([]byte, error) {
	return a.Srv().downloadFromURL(downloadURL)
}

func (s *Server) downloadFromURL(downloadURL string) ([]byte, error) {
	if !model.IsValidHTTPURL(downloadURL) {
		return nil, fmt.Errorf("invalid url %s", downloadURL)
	}

	u, err := url.ParseRequestURI(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse url %s", downloadURL)
	}
	if !*s.platform.Config().PluginSettings.AllowInsecureDownloadURL && u.Scheme != "https" {
		return nil, fmt.Errorf("insecure url not allowed %s", downloadURL)
	}

	client := s.HTTPService().MakeClient(true)
	client.Timeout = HTTPRequestTimeout

	var resp *http.Response
	err = utils.ProgressiveRetry(func() error {
		resp, err = client.Get(downloadURL)

		if err != nil {
			return fmt.Errorf("failed to fetch from %s: %w", downloadURL, err)
		}

		if !(resp.StatusCode >= 200 && resp.StatusCode < 300) {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			return fmt.Errorf("failed to fetch from %s", downloadURL)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("download failed after multiple retries.: %w", err)
	}

	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}
