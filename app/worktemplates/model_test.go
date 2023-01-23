// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package worktemplates

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

	t.Run("fails when something is not allowed", func(t *testing.T) {
		appErr := wtcr.CanBeExecuted(PermissionSet{
			CanCreatePublicChannel:  true,
			CanCreatePublicPlaybook: false,
			CanCreatePublicBoard:    true,
		})
		require.Error(t, appErr)
	})

	t.Run("returns an error and no res when playbook template is not found", func(t *testing.T) {
		wtcrMod := *wtcr
		wtcrMod.foundPlaybookTemplates = map[string]*pbclient.PlaybookCreateOptions{}
		wtcrMod.PlaybookTemplates = []*PlaybookTemplate{}
		appErr := wtcrMod.CanBeExecuted(PermissionSet{
			CanCreatePublicChannel:  true,
			CanCreatePublicPlaybook: true,
			CanCreatePublicBoard:    true,
		})
		require.Error(t, appErr)
	})
}
