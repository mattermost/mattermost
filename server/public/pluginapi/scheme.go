package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// SchemeService exposes methods to manipulate schemes.
type SchemeService struct {
	api plugin.API
}

// GetByName gets a scheme by its unique name.
//
// Minimum server version: 11.10
func (s *SchemeService) GetByName(name string) (*model.Scheme, error) {
	scheme, appErr := s.api.GetSchemeByName(name)

	return scheme, normalizeAppErr(appErr)
}

// Create creates a scheme and its generated roles. The scheme's role fields are
// server-assigned; any caller-supplied values are ignored.
//
// Requires a license covering custom permissions schemes; without one the call
// is refused. The seeded space preset schemes exist on every edition, so
// pointing a space at one needs no license — this gate covers minting a new one.
//
// Minimum server version: 11.10
func (s *SchemeService) Create(scheme *model.Scheme) (*model.Scheme, error) {
	created, appErr := s.api.CreateScheme(scheme)

	return created, normalizeAppErr(appErr)
}

// Delete soft-deletes a scheme and its generated roles, reverting any teams or
// channels using it to the system-default roles. A scheme a space backing
// channel still references is refused — detach the space first.
//
// Requires a license covering custom permissions schemes; without one the call
// is refused.
//
// Minimum server version: 11.10
func (s *SchemeService) Delete(schemeID string) (*model.Scheme, error) {
	deleted, appErr := s.api.DeleteScheme(schemeID)

	return deleted, normalizeAppErr(appErr)
}

// GetRolesForChannel returns the generated role names of the scheme governing
// the given channel, in guest, user, admin order.
//
// Minimum server version: 11.10
func (s *SchemeService) GetRolesForChannel(channelID string) (guestRoleName, userRoleName, adminRoleName string, err error) {
	guest, user, admin, appErr := s.api.GetSchemeRolesForChannel(channelID)

	return guest, user, admin, normalizeAppErr(appErr)
}
