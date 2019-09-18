// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type SamlInterface interface {
	ConfigureSP() error
	BuildRequest(relayState string) (*model.SamlAuthRequest, error)
	DoLogin(encodedXML string, relayState map[string]string) (*model.User, error)
	GetMetadata() (string, error)
}
