// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
)

type MattermostPaidFeature string

const (
	PaidFeatureGuestAccounts           = MattermostPaidFeature("mattermost.feature.guest_accounts")
	PaidFeatureCustomUsergroups        = MattermostPaidFeature("mattermost.feature.custom_user_groups")
	PaidFeatureCreateMultipleTeams     = MattermostPaidFeature("mattermost.feature.create_multiple_teams")
	PaidFeatureStartcall               = MattermostPaidFeature("mattermost.feature.start_call")
	PaidFeaturePlaybooksRetrospective  = MattermostPaidFeature("mattermost.feature.playbooks_retro")
	PaidFeatureUnlimitedMessages       = MattermostPaidFeature("mattermost.feature.unlimited_messages")
	PaidFeatureUnlimitedFileStorage    = MattermostPaidFeature("mattermost.feature.unlimited_file_storage")
	PaidFeatureUnlimitedIntegrations   = MattermostPaidFeature("mattermost.feature.unlimited_integrations")
	PaidFeatureUnlimitedBoardcards     = MattermostPaidFeature("mattermost.feature.unlimited_board_cards")
	PaidFeatureAllProfessionalfeatures = MattermostPaidFeature("mattermost.feature.all_professional")
	PaidFeatureAllEnterprisefeatures   = MattermostPaidFeature("mattermost.feature.all_enterprise")
	UpgradeDowngradedWorkspace         = MattermostPaidFeature("mattermost.feature.upgrade_downgraded_workspace")
)

var validSKUs map[string]struct{} = map[string]struct{}{
	LicenseShortSkuProfessional: {},
	LicenseShortSkuEnterprise:   {},
}

// These are the features a non admin would typically ping an admin about
var paidFeatures map[MattermostPaidFeature]struct{} = map[MattermostPaidFeature]struct{}{
	PaidFeatureGuestAccounts:           {},
	PaidFeatureCustomUsergroups:        {},
	PaidFeatureCreateMultipleTeams:     {},
	PaidFeatureStartcall:               {},
	PaidFeaturePlaybooksRetrospective:  {},
	PaidFeatureUnlimitedMessages:       {},
	PaidFeatureUnlimitedFileStorage:    {},
	PaidFeatureUnlimitedIntegrations:   {},
	PaidFeatureUnlimitedBoardcards:     {},
	PaidFeatureAllProfessionalfeatures: {},
	PaidFeatureAllEnterprisefeatures:   {},
	UpgradeDowngradedWorkspace:         {},
}

type NotifyAdminToUpgradeRequest struct {
	TrialNotification bool                  `json:"trial_notification"`
	RequiredPlan      string                `json:"required_plan"`
	RequiredFeature   MattermostPaidFeature `json:"required_feature"`
}

type NotifyAdminData struct {
	CreateAt        int64                 `json:"create_at,omitempty"`
	UserId          string                `json:"user_id"`
	RequiredPlan    string                `json:"required_plan"`
	RequiredFeature MattermostPaidFeature `json:"required_feature"`
	Trial           bool                  `json:"trial"`
}

func (nad *NotifyAdminData) IsValid() *AppError {
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
