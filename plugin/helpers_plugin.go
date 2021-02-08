// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"net/http"
	"net/url"
	"path"
	"time"

	"github.com/blang/semver"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
)

// InstallPluginFromURL implements Helpers.InstallPluginFromURL.
func (p *HelpersImpl) InstallPluginFromURL(downloadURL string, replace bool) (*model.Manifest, error) {
	err := p.ensureServerVersion("5.18.0")
	if err != nil {
		return nil, err
	}

	parsedURL, err := url.Parse(downloadURL)
	if err != nil {
		return nil, errors.Wrap(err, "error while parsing url")
	}

	client := &http.Client{Timeout: time.Hour}
	response, err := client.Get(parsedURL.String())
	if err != nil {
		return nil, errors.Wrap(err, "unable to download the plugin")
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, errors.Errorf("received %d status code while downloading plugin from server", response.StatusCode)
	}

	manifest, installError := p.API.InstallPlugin(response.Body, replace)
	if installError != nil {
		return nil, errors.Wrap(err, "unable to install plugin on server")
	}

	return manifest, nil
}

func (p *HelpersImpl) ensureServerVersion(required string) error {
	serverVersion := p.API.GetServerVersion()
	currentVersion := semver.MustParse(serverVersion)
	requiredVersion := semver.MustParse(required)

	if currentVersion.LT(requiredVersion) {
		return errors.Errorf("incompatible server version for plugin, minimum required version: %s, current version: %s", required, serverVersion)
	}
	return nil
}

// GetPluginAssetURL implements GetPluginAssetURL.
func (p *HelpersImpl) GetPluginAssetURL(pluginID, asset string) (string, error) {
	if pluginID == "" {
		return "", errors.New("empty pluginID provided")
	}

	if asset == "" {
		return "", errors.New("empty asset name provided")
	}

	siteURL := *p.API.GetConfig().ServiceSettings.SiteURL
	if siteURL == "" {
		return "", errors.New("no SiteURL configured by the server")
	}

	u, err := url.Parse(siteURL + path.Join("/", pluginID, asset))
	if err != nil {
		return "", err
	}

	return u.String(), nil
}
