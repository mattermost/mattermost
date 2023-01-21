// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"strings"
)

type MattermostFeature string

const (
	PaidFeatureGuestAccounts           = MattermostFeature("mattermost.feature.guest_accounts")
	PaidFeatureCustomUsergroups        = MattermostFeature("mattermost.feature.custom_user_groups")
	PaidFeatureCreateMultipleTeams     = MattermostFeature("mattermost.feature.create_multiple_teams")
	PaidFeatureStartcall               = MattermostFeature("mattermost.feature.start_call")
	PaidFeaturePlaybooksRetrospective  = MattermostFeature("mattermost.feature.playbooks_retro")
	PaidFeatureUnlimitedMessages       = MattermostFeature("mattermost.feature.unlimited_messages")
	PaidFeatureUnlimitedFileStorage    = MattermostFeature("mattermost.feature.unlimited_file_storage")
	PaidFeatureAllProfessionalfeatures = MattermostFeature("mattermost.feature.all_professional")
	PaidFeatureAllEnterprisefeatures   = MattermostFeature("mattermost.feature.all_enterprise")
	UpgradeDowngradedWorkspace         = MattermostFeature("mattermost.feature.upgrade_downgraded_workspace")
	PluginFeature                      = MattermostFeature("mattermost.feature.plugin")
)

var validSKUs map[string]struct{} = map[string]struct{}{
	LicenseShortSkuProfessional: {},
	LicenseShortSkuEnterprise:   {},
}

// These are the features a non admin would typically ping an admin about
var paidFeatures map[MattermostFeature]struct{} = map[MattermostFeature]struct{}{
	PaidFeatureGuestAccounts:           {},
	PaidFeatureCustomUsergroups:        {},
	PaidFeatureCreateMultipleTeams:     {},
	PaidFeatureStartcall:               {},
	PaidFeaturePlaybooksRetrospective:  {},
	PaidFeatureUnlimitedMessages:       {},
	PaidFeatureUnlimitedFileStorage:    {},
	PaidFeatureAllProfessionalfeatures: {},
	PaidFeatureAllEnterprisefeatures:   {},
	UpgradeDowngradedWorkspace:         {},
}

type NotifyAdminToUpgradeRequest struct {
	TrialNotification bool              `json:"trial_notification"`
	RequiredPlan      string            `json:"required_plan"`
	RequiredFeature   MattermostFeature `json:"required_feature"`
}

type NotifyAdminData struct {
	CreateAt        int64             `json:"create_at,omitempty"`
	UserId          string            `json:"user_id"`
	RequiredPlan    string            `json:"required_plan"`
	RequiredFeature MattermostFeature `json:"required_feature"`
	Trial           bool              `json:"trial"`
	SentAt          int64             `json:"sent_at"`
}

func (nad *NotifyAdminData) IsValid() *AppError {
	if strings.HasPrefix(string(nad.RequiredFeature), string(PluginFeature)) {
		return nil
	}
	if _, planOk := validSKUs[nad.RequiredPlan]; !planOk {
		return NewAppError("NotifyAdmin.IsValid", fmt.Sprintf("Invalid plan, %s provided", nad.RequiredPlan), nil, "", http.StatusBadRequest)
	}

	if _, featureOk := paidFeatures[nad.RequiredFeature]; !featureOk {
		return NewAppError("NotifyAdmin.IsValid", fmt.Sprintf("Invalid feature, %s provided", nad.RequiredFeature), nil, "", http.StatusBadRequest)
	}

	return nil
}

func (nad *NotifyAdminData) PreSave() {
	nad.CreateAt = GetMillis()
}
