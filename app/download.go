// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
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

func (a *App) DownloadFromUrl(downloadUrl string) (io.ReadSeeker, error) {
	if !model.IsValidHttpUrl(downloadUrl) {
		return nil, errors.Errorf("invalid url %s", downloadUrl)
	}

	u, err := url.ParseRequestURI(downloadUrl)
	if err != nil {
		return nil, errors.Errorf("failed to parse url %s", downloadUrl)
	}
	if !*a.Config().PluginSettings.AllowInsecureDownloadUrl && u.Scheme != "https" {
		return nil, errors.Errorf("insecure url not allowed %s", downloadUrl)
	}

	client := a.HTTPService.MakeClient(true)
	client.Timeout = HTTP_REQUEST_TIMEOUT

	resp, err := client.Get(downloadUrl)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch from %s", downloadUrl)
	}
	defer resp.Body.Close()

	fileBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read from response")
	}

	return bytes.NewReader(fileBytes), nil
}
