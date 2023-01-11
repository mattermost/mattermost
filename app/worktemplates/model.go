// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.package main
package worktemplates

import (
	"errors"
	"fmt"

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
	// channels
	CanCreatePublicChannel  bool
	CanCreatePrivateChannel bool
	// playbooks
	CanCreatePublicPlaybook  bool
	CanCreatePrivatePlaybook bool
	CanCreatePlaybookRun     bool
	// boards
	CanCreatePublicBoard  bool
	CanCreatePrivateBoard bool
}

func (r *ExecutionRequest) CanBeExecuted(p PermissionSet) (*bool, error) {
	truePtr := model.NewBool(true)
	falsePtr := model.NewBool(false)
	public := r.Visibility == model.WorkTemplateVisibilityPublic
	for _, c := range r.WorkTemplate.Content {
		if c.Channel != nil {
			if public && !p.CanCreatePublicChannel {
				return falsePtr, errors.New("cannot create public channel")
			}
			if !public && !p.CanCreatePrivateChannel {
				return falsePtr, errors.New("cannot create private channel")
			}
			continue
		}

		if c.Board != nil {
			if public && !p.CanCreatePublicBoard {
				return falsePtr, errors.New("cannot create public board")
			}
			if !public && !p.CanCreatePrivateBoard {
				return falsePtr, errors.New("cannot create private board")
			}
			continue
		}

		if c.Playbook != nil {
			if !p.CanCreatePlaybookRun {
				return falsePtr, errors.New("cannot create playbook run")
			}
			if public && !p.CanCreatePublicPlaybook {
				return falsePtr, errors.New("cannot create public playbook")
			}
			if !public && !p.CanCreatePrivatePlaybook {
				return falsePtr, errors.New("cannot create private playbook")
			}

			// we need to check what's the template default run execution mode
			// to determine how the channel is created
			tmpl, err := r.FindPlaybookTemplate(c.Playbook.Template)
			if err != nil {
				return nil, fmt.Errorf("unable to find playbook template %s: %w", c.Playbook.Template, err)
			}
			if tmpl.CreatePublicPlaybookRun && !p.CanCreatePublicChannel {
				return falsePtr, errors.New("cannot create public run")
			}
			if !tmpl.CreatePublicPlaybookRun && !p.CanCreatePrivateChannel {
				return falsePtr, errors.New("cannot create private run")
			}
			continue
		}

	}
	return truePtr, nil
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
