// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"fmt"
	"net/url"
	"path"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

const defaultBaseAPIURL = "plugins/playbooks/api/v0"

func getAPIBaseURL(pluginAPI *pluginapi.Client) (string, error) {
	siteURL := model.ServiceSettingsDefaultSiteURL
	if pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	}

	parsedSiteURL, err := url.Parse(siteURL)
	if err != nil {
		return "", errors.Wrapf(err, "failed to parse siteURL %s", siteURL)
	}

	return path.Join(parsedSiteURL.Path, defaultBaseAPIURL), nil
}

func makeAPIURL(pluginAPI *pluginapi.Client, apiPath string, args ...interface{}) string {
	apiBaseURL, err := getAPIBaseURL(pluginAPI)
	if err != nil {
		logrus.WithError(err).Error("failed to build api base url")
		apiBaseURL = defaultBaseAPIURL
	}

	return path.Join("/", apiBaseURL, fmt.Sprintf(apiPath, args...))
}
