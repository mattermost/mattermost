// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package worktemplates

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"

	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
)

func TestCanBeExecuted(t *testing.T) {
	wtcr := &ExecutionRequest{
		Visibility: model.WorkTemplateVisibilityPublic,
		WorkTemplate: model.WorkTemplate{
			Content: []model.WorkTemplateContent{
				{
					Playbook: &model.WorkTemplatePlaybook{
						Name:     "test playbook",
						ID:       "test-pb",
						Template: "test template pb",
					},
				},
				{
					Channel: &model.WorkTemplateChannel{
						ID:       "test-channel",
						Name:     "test channel",
						Playbook: "test-pb",
					},
				},
				{
					Board: &model.WorkTemplateBoard{
						Name:    "test board",
						Channel: "test-channel",
					},
				},
			},
		},
		PlaybookTemplates: []*PlaybookTemplate{
			{
				Title: "test template pb",
				Template: pbclient.PlaybookCreateOptions{
					CreatePublicPlaybookRun: true,
				},
			},
		},
	}

	t.Run("can run when all permissions are good", func(t *testing.T) {
		appErr := wtcr.CanBeExecuted(PermissionSet{
			CanCreatePublicChannel:  true,
			CanCreatePublicPlaybook: true,
			CanCreatePublicBoard:    true,
		})
		assert.Nil(t, appErr)
	})

	t.Run("cannot create private playbook if the license is not enterprise", func(t *testing.T) {
		wtcrMod := *wtcr
		wtcrMod.Visibility = model.WorkTemplateVisibilityPrivate
		appErr := wtcrMod.CanBeExecuted(PermissionSet{
			License:                  model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, ""),
			CanCreatePrivateChannel:  true,
			CanCreatePrivateBoard:    true,
			CanCreatePrivatePlaybook: true,
			CanCreatePublicChannel:   true, // needed for the channel run
		})
		require.NotNil(t, appErr)

		appErr = wtcrMod.CanBeExecuted(PermissionSet{
			License:                  nil,
			CanCreatePrivateChannel:  true,
			CanCreatePrivateBoard:    true,
			CanCreatePrivatePlaybook: true,
			CanCreatePublicChannel:   true,
		})
		require.NotNil(t, appErr)

		// enterprise and E20 ok
		appErr = wtcrMod.CanBeExecuted(PermissionSet{
			License:                  model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, ""),
			CanCreatePrivateChannel:  true,
			CanCreatePrivateBoard:    true,
			CanCreatePrivatePlaybook: true,
			CanCreatePublicChannel:   true,
		})
		require.Nil(t, appErr)
		appErr = wtcrMod.CanBeExecuted(PermissionSet{
			License:                  model.NewTestLicenseSKU(model.LicenseShortSkuE20, ""),
			CanCreatePrivateChannel:  true,
			CanCreatePrivateBoard:    true,
			CanCreatePrivatePlaybook: true,
			CanCreatePublicChannel:   true,
		})
		require.Nil(t, appErr)
	})

	t.Run("fails when something is not allowed", func(t *testing.T) {
		appErr := wtcr.CanBeExecuted(PermissionSet{
			CanCreatePublicChannel:  true,
			CanCreatePublicPlaybook: false,
			CanCreatePublicBoard:    true,
		})
		require.NotNil(t, appErr)
	})
}
