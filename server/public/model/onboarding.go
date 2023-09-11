// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

// CompleteOnboardingRequest describes parameters of the requested plugin.
type CompleteOnboardingRequest struct {
	Organization   string   `json:"organization"`    // Organization is the name of the organization
	InstallPlugins []string `json:"install_plugins"` // InstallPlugins is a list of plugins to be installed
}

func (r *CompleteOnboardingRequest) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"install_plugins": r.InstallPlugins,
	}
}

// CompleteOnboardingRequest decodes a json-encoded request from the given io.Reader.
func CompleteOnboardingRequestFromReader(reader io.Reader) (*CompleteOnboardingRequest, error) {
	var r *CompleteOnboardingRequest
	err := json.NewDecoder(reader).Decode(&r)
	if err != nil {
		return nil, err
	}

	return r, nil
}
