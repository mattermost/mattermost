// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type SamlInterface interface {
	ConfigureSP(c *request.Context) error
	BuildRequest(c *request.Context, relayState string) (*model.SamlAuthRequest, *model.AppError)
	DoLogin(c *request.Context, encodedXML string, relayState map[string]string) (*model.User, *model.AppError)
	GetMetadata(c *request.Context) (string, *model.AppError)
	CheckProviderAttributes(c *request.Context, SS *model.SamlSettings, ouser *model.User, patch *model.UserPatch) string
}
