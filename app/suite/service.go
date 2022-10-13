// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"github.com/mattermost/mattermost-server/v6/app/email"
	"github.com/mattermost/mattermost-server/v6/app/imaging"
	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/services/sharedchannel"
)

type SuiteService struct {
	platform                 *platform.PlatformService
	channels                 ChannelsIFace
	email                    email.ServiceInterface
	httpService              httpservice.HTTPService
	audit                    *audit.Audit
	sharedChannelSyncService *sharedchannel.Service

	ldap einterfaces.LdapInterface
	saml einterfaces.SamlInterface

	phase2PermissionsMigrationComplete bool

	imgDecoder *imaging.Decoder
	imgEncoder *imaging.Encoder

	PluginsEnvironment *plugin.Environment
}

func NewSuiteService(p *platform.PlatformService) *SuiteService {
	return &SuiteService{
		platform: p,
	}
}

func (s *SuiteService) GetPluginsEnvironment() *plugin.Environment {
	return s.PluginsEnvironment
}
