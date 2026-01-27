// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type AgentsIntegrityResponse struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}
