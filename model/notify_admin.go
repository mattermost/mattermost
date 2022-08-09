// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
)

var validCloudSKUs map[string]interface{} = map[string]interface{}{
	"cloud-starter":      nil,
	"cloud-professional": nil,
	"cloud-enterprise":   nil,
}

// These are the features a non admin would typically ping an admin about
var nonAdminPaidFeatures map[string]interface{} = map[string]interface{}{
	"Guest Accounts":            nil,
	"Custom User groups":        nil,
	"Create Multiple Teams":     nil,
	"Start call":                nil,
	"Playbooks Retrospective":   nil,
	"Unlimited Messages":        nil,
	"Unlimited File Storage":    nil,
	"All Professional features": nil,
}

type NotifyAdminData struct {
	Id              string `json:"id,omitempty"`
	CreateAt        int64  `json:"create_at,omitempty"`
	UserId          string `json:"user_id"`
	RequiredPlan    string `json:"required_plan"`
	RequiredFeature string `json:"required_feature"`
	Trial           bool   `json:"trial"`
}

func (nad *NotifyAdminData) IsValid() *AppError {
	if _, planOk := validCloudSKUs[nad.RequiredPlan]; !planOk {
		return NewAppError("NotifyAdmin.IsValid", fmt.Sprintf("Invalid plan, %s provided", nad.RequiredPlan), nil, "", http.StatusBadRequest)
	}

	if _, featureOk := nonAdminPaidFeatures[nad.RequiredFeature]; !featureOk {
		return NewAppError("NotifyAdmin.IsValid", fmt.Sprintf("Invalid feature, %s provided", nad.RequiredFeature), nil, "", http.StatusBadRequest)
	}

	return nil
}

func (nad *NotifyAdminData) PreSave() {
	if nad.Id == "" {
		nad.Id = NewId()
	}

	nad.CreateAt = GetMillis()
}
