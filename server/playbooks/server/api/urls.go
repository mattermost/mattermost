package api

import (
	"fmt"
	"net/url"
	"path"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/playbooks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const defaultBaseAPIURL = "plugins/playbooks/api/v0"

func getAPIBaseURL(api playbooks.ServicesAPI) (string, error) {
	siteURL := model.ServiceSettingsDefaultSiteURL
	if api.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *api.GetConfig().ServiceSettings.SiteURL
	}

	parsedSiteURL, err := url.Parse(siteURL)
	if err != nil {
		return "", errors.Wrapf(err, "failed to parse siteURL %s", siteURL)
	}

	return path.Join(parsedSiteURL.Path, defaultBaseAPIURL), nil
}

func makeAPIURL(api playbooks.ServicesAPI, apiPath string, args ...interface{}) string {
	apiBaseURL, err := getAPIBaseURL(api)
	if err != nil {
		logrus.WithError(err).Error("failed to build api base url")
		apiBaseURL = defaultBaseAPIURL
	}

	return path.Join("/", apiBaseURL, fmt.Sprintf(apiPath, args...))
}
