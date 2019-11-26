package pluginapi

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// SystemService exposes methods to query system properties.
type SystemService struct {
	api plugin.API
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
