// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

// PlatformService is the service for the platform related tasks. It is
// responsible for non-entity related functionalities that are required
// by a product such as database access, configuration access, licensing etc.
type PlatformService struct {
}

// New creates a new PlatformService.
func New(c ServiceConfig) (*PlatformService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &PlatformService{}, nil
}
