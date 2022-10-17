// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"github.com/mattermost/mattermost-server/v6/app/email"
	"github.com/mattermost/mattermost-server/v6/app/imaging"
	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/services/sharedchannel"
)

type SuiteService struct {
	platform                 *platform.PlatformService // required
	channels                 ChannelsIFace             // required
	email                    email.ServiceInterface    // required
	httpService              httpservice.HTTPService   // required
	audit                    *audit.Audit              // required
	sharedChannelSyncService *sharedchannel.Service    // safe to be nil

	ldap  einterfaces.LdapInterface  // safe to be nil
	saml  einterfaces.SamlInterface  // safe to be nil
	cloud einterfaces.CloudInterface // safe to be nil -- if license is nil --

	phase2PermissionsMigrationComplete bool
	// cached counts that are used during notice condition validation
	cachedPostCount   int64
	cachedUserCount   int64
	cachedDBMSVersion string
	// previously fetched notices
	cachedNotices model.ProductNotices

	imgDecoder *imaging.Decoder // can be initialized lazily
	imgEncoder *imaging.Encoder // can be initialized lazily

	PluginsEnvironment *plugin.Environment // safe to be nil
}

type SuiteServiceConfig struct {
	Platform                 *platform.PlatformService
	Channels                 ChannelsIFace
	EmailService             email.ServiceInterface
	HTTPService              httpservice.HTTPService
	Audit                    *audit.Audit
	SharedChannelSyncService *sharedchannel.Service

	Ldap  einterfaces.LdapInterface
	Saml  einterfaces.SamlInterface
	Cloud einterfaces.CloudInterface

	ImgDecoder *imaging.Decoder
	ImgEncoder *imaging.Encoder

	PluginsEnvironment *plugin.Environment
}

func NewSuiteService(cfg *SuiteServiceConfig) *SuiteService {
	return &SuiteService{
		platform:                 cfg.Platform,
		channels:                 cfg.Channels,
		email:                    cfg.EmailService,
		httpService:              cfg.HTTPService,
		audit:                    cfg.Audit,
		sharedChannelSyncService: cfg.SharedChannelSyncService,
		ldap:                     cfg.Ldap,
		saml:                     cfg.Saml,
		cloud:                    cfg.Cloud,
		imgDecoder:               cfg.ImgDecoder,
		imgEncoder:               cfg.ImgEncoder,
		PluginsEnvironment:       cfg.PluginsEnvironment,
	}
}

func (s *SuiteService) GetPluginsEnvironment() *plugin.Environment {
	return s.PluginsEnvironment
}
