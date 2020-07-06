package common

import (
	"net/url"
	"strings"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// GetPluginURL returns a url like siteURL/plugins/pluginID based on the information from the client.
// If any error happens in the process, a empty string is returned.
func GetPluginURL(client *pluginapi.Client) string {
	mattermostSiteURL := client.Configuration.GetConfig().ServiceSettings.SiteURL
	if mattermostSiteURL == nil {
		return ""
	}
	_, err := url.Parse(*mattermostSiteURL)
	if err != nil {
		return ""
	}
	manifest, err := client.System.GetManifest()
	if err != nil {
		return ""
	}

	pluginURLPath := "/plugins/" + manifest.Id
	return strings.TrimRight(*mattermostSiteURL, "/") + pluginURLPath
}
