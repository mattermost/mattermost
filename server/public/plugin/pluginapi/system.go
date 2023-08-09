package pluginapi

import (
	"net/url"
	"path"
	"time"

	"github.com/blang/semver/v4"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
)

// SystemService exposes methods to query system properties.
type SystemService struct {
	api plugin.API
}

// GetManifest returns the manifest from the plugin bundle.
//
// Minimum server version: 5.10
func (s *SystemService) GetManifest() (*model.Manifest, error) {
	p, err := s.api.GetBundlePath()
	if err != nil {
		return nil, err
	}

	m, _, err := model.FindManifest(p)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find and open manifest")
	}

	return m, nil
}

// GetBundlePath returns the absolute path where the plugin's bundle was unpacked.
//
// Minimum server version: 5.10
func (s *SystemService) GetBundlePath() (string, error) {
	return s.api.GetBundlePath()
}

// GetPluginAssetURL builds a URL to the given asset in the assets directory.
// Use this URL to link to assets from the webapp, or for third-party integrations with your plugin.
//
// Minimum server version: 5.2
func (s *SystemService) GetPluginAssetURL(pluginID, asset string) (string, error) {
	if pluginID == "" {
		return "", errors.New("empty pluginID provided")
	}

	if asset == "" {
		return "", errors.New("empty asset name provided")
	}

	siteURL := *s.api.GetConfig().ServiceSettings.SiteURL
	if siteURL == "" {
		return "", errors.New("no SiteURL configured by the server")
	}

	u, err := url.Parse(siteURL + path.Join("/", pluginID, asset))
	if err != nil {
		return "", err
	}

	return u.String(), nil
}

// GetLicense returns the current license used by the Mattermost server. Returns nil if the
// the server does not have a license.
//
// Minimum server version: 5.10
func (s *SystemService) GetLicense() *model.License {
	return s.api.GetLicense()
}

// GetServerVersion return the current Mattermost server version
//
// Minimum server version: 5.4
func (s *SystemService) GetServerVersion() string {
	return s.api.GetServerVersion()
}

// IsEnterpriseReady returns true if the Mattermost server is configured as Enterprise Ready.
//
// Minimum server version: 6.1
func (s *SystemService) IsEnterpriseReady() bool {
	return s.api.IsEnterpriseReady()
}

// GetSystemInstallDate returns the time that Mattermost was first installed and ran.
//
// Minimum server version: 5.10
func (s *SystemService) GetSystemInstallDate() (time.Time, error) {
	installDateMS, appErr := s.api.GetSystemInstallDate()
	installDate := time.Unix(0, installDateMS*int64(time.Millisecond))

	return installDate, normalizeAppErr(appErr)
}

// GetDiagnosticID returns a unique identifier used by the server for diagnostic reports.
//
// Minimum server version: 5.10
func (s *SystemService) GetDiagnosticID() string {
	// TODO: Consider deprecating/rewriting in favor of just using GetUnsanitizedConfig().
	return s.api.GetDiagnosticId()
}

// RequestTrialLicense requests a trial license and installs it in the server.
// If the server version is lower than 5.36.0, an error is returned.
//
// Minimum server version: 5.36
func (s *SystemService) RequestTrialLicense(requesterID string, users int, termsAccepted, receiveEmailsAccepted bool) error {
	currentVersion := semver.MustParse(s.api.GetServerVersion())
	requiredVersion := semver.MustParse("5.36.0")

	if currentVersion.LT(requiredVersion) {
		return errors.Errorf("current server version is lower than 5.36")
	}

	err := s.api.RequestTrialLicense(requesterID, users, termsAccepted, receiveEmailsAccepted)
	return normalizeAppErr(err)
}
