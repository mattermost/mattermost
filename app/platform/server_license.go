// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

// License returns the license stored in the server struct.
// This should be removed with MM-45839
func (ps *PlatformService) License() *model.License {
	license, _ := ps.licenseValue.Load().(*model.License)
	return license
}

func (ps *PlatformService) SetLicense(license *model.License) {
	ps.licenseValue.Store(license)
}
