package pluginapi

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
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
	path, err := s.api.GetBundlePath()
	if err != nil {
		return nil, err
	}

	m, _, err := model.FindManifest(path)
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
