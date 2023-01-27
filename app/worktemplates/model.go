// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package worktemplates

import (
	"errors"
	"net/http"

	pbclient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/model"
)

type ExecutionRequest struct {
	TeamID            string              `json:"team_id"`
	Name              string              `json:"name"`
	Visibility        string              `json:"visibility"`
	WorkTemplate      model.WorkTemplate  `json:"work_template"`
	PlaybookTemplates []*PlaybookTemplate `json:"playbook_templates"`

	foundPlaybookTemplates map[string]*pbclient.PlaybookCreateOptions
}

type PermissionSet struct {
	License *model.License

	// channels
	CanCreatePublicChannel  bool
	CanCreatePrivateChannel bool
	// playbooks
	CanCreatePublicPlaybook  bool
	CanCreatePrivatePlaybook bool
	// boards
	CanCreatePublicBoard  bool
	CanCreatePrivateBoard bool
}

func (r *ExecutionRequest) CanBeExecuted(p PermissionSet) *model.AppError {
	public := r.Visibility == model.WorkTemplateVisibilityPublic
	for _, c := range r.WorkTemplate.Content {
		if c.Channel != nil {
			if public && !p.CanCreatePublicChannel {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_public_channel", nil, "", http.StatusForbidden)
			}
			if !public && !p.CanCreatePrivateChannel {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_private_channel", nil, "", http.StatusForbidden)
			}
			continue
		}

		if c.Board != nil {
			if public && !p.CanCreatePublicBoard {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_public_board", nil, "", http.StatusForbidden)
			}
			if !public && !p.CanCreatePrivateBoard {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_private_board", nil, "", http.StatusForbidden)
			}
			continue
		}

		if c.Playbook != nil {
			if public && !p.CanCreatePublicPlaybook {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_public_playbook", nil, "", http.StatusForbidden)
			}
			if !public && !p.CanCreatePrivatePlaybook {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_private_playbook", nil, "", http.StatusForbidden)
			}
			// private playbook is an E20/Enterprise feature
			if !public && (p.License == nil || (p.License.SkuShortName != model.LicenseShortSkuE20 && p.License.SkuShortName != model.LicenseShortSkuEnterprise)) {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.license_cannot_create_private_playbook", nil, "", http.StatusForbidden)
			}

			// we need to check what's the template default run execution mode
			// to determine how the channel is created
			tmpl, err := r.FindPlaybookTemplate(c.Playbook.Template)
			if err != nil {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_find_playbook_template", nil, err.Error(), http.StatusInternalServerError)
			}
			if tmpl.CreatePublicPlaybookRun && !p.CanCreatePublicChannel {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_public_run", nil, "", http.StatusForbidden)
			}
			if !tmpl.CreatePublicPlaybookRun && !p.CanCreatePrivateChannel {
				return model.NewAppError("WorkTemplateExecutionRequest.CanBeExecuted", "app.worktemplate.execution_request.cannot_create_private_run", nil, "", http.StatusForbidden)
			}
			continue
		}

	}
	return nil
}

// FindPlaybookTemplate returns the playbook template with the given title.
// it also feed a cache to avoid looking for the same template twice.
func (r *ExecutionRequest) FindPlaybookTemplate(templateTitle string) (*pbclient.PlaybookCreateOptions, error) {
	if r.foundPlaybookTemplates == nil {
		r.foundPlaybookTemplates = make(map[string]*pbclient.PlaybookCreateOptions)
	}

	if pt, ok := r.foundPlaybookTemplates[templateTitle]; ok {
		if pt == nil {
			return nil, errors.New("playbook template not found")
		}
		return pt, nil
	}

	for _, pt := range r.PlaybookTemplates {
		if pt.Title == templateTitle {
			r.foundPlaybookTemplates[templateTitle] = &pt.Template
			return &pt.Template, nil
		}
	}
	r.foundPlaybookTemplates[templateTitle] = nil
	return nil, errors.New("playbook template not found")
}

type PlaybookTemplate struct {
	Title    string                         `json:"title"`
	Template pbclient.PlaybookCreateOptions `json:"template"`
}
