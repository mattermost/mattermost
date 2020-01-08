// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io/ioutil"
	"net/url"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	// HTTP_REQUEST_TIMEOUT defines a high timeout for downloading large files
	// from an external URL to avoid slow connections from failing to install.
	HTTP_REQUEST_TIMEOUT = 1 * time.Hour
)

func (a *App) DownloadFromURL(downloadURL string) ([]byte, error) {
	if !model.IsValidHttpUrl(downloadURL) {
		return nil, errors.Errorf("invalid url %s", downloadURL)
	}

	u, err := url.ParseRequestURI(downloadURL)
	if err != nil {
		return nil, errors.Errorf("failed to parse url %s", downloadURL)
	}
	if !*a.Config().PluginSettings.AllowInsecureDownloadUrl && u.Scheme != "https" {
		return nil, errors.Errorf("insecure url not allowed %s", downloadURL)
	}

	client := a.HTTPService.MakeClient(true)
	client.Timeout = HTTP_REQUEST_TIMEOUT

	resp, err := client.Get(downloadURL)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch from %s", downloadURL)
	}
	defer resp.Body.Close()

	return ioutil.ReadAll(resp.Body)
}
