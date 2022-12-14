// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitWorkTemplate() {
	api.BaseRoutes.WorkTemplates.Handle("/categories", api.APISessionRequired(needsWorkTemplateFeatureFlag(getWorkTemplateCategories))).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/categories/{category}/templates", api.APISessionRequired(needsWorkTemplateFeatureFlag(getWorkTemplates))).Methods("GET")
	api.BaseRoutes.WorkTemplates.Handle("/dev", api.APIHandler(devStuff)).Methods("GET")
}

func needsWorkTemplateFeatureFlag(h handlerFunc) handlerFunc {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		if !c.App.Config().FeatureFlags.WorkTemplate {
			http.NotFound(w, r)
			return
		}

		h(c, w, r)
	}
}

func getWorkTemplateCategories(c *Context, w http.ResponseWriter, r *http.Request) {
	t := c.AppContext.GetT()

	categories, appErr := c.App.GetWorkTemplateCategories(t)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("getWorkTemplateCategories", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getWorkTemplates(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireCategory()
	if c.Err != nil {
		return
	}
	t := c.AppContext.GetT()

	workTemplates, appErr := c.App.GetWorkTemplates(c.Params.Category, c.App.Config().FeatureFlags.ToMap(), t)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(workTemplates)
	if err != nil {
		c.Err = model.NewAppError("getWorkTemplates", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func devStuff(c *Context, w http.ResponseWriter, r *http.Request) {
	wtcr := &app.WorkTemplateCreationRequest{}
	err := json.Unmarshal(executeReq, wtcr)
	if err != nil {
		c.Err = model.NewAppError("devStuff", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	appErr := c.App.ExecuteWorkTemplate(c.AppContext, wtcr)
	if appErr != nil {
		c.Err = appErr
		return
	}
}

var executeReq = []byte(`{
    "team_id": "xpe799umdtry5pit8e34o9gqwh",
    "name": "",
    "visibility": "public",
    "work_template": {
        "id": "product+product_roadmap",
        "category": "product_team",
        "useCase": "Feature Release",
        "visibility": "public",
        "illustration": "https://via.placeholder.com/204x123.png",
        "description": {
            "channel": {
                "message": "This is the channels section description"
            },
            "board": {
                "message": "This is the boards section description"
            },
            "playbook": {
                "message": "This is the playbooks section description"
            },
            "integration": {
                "message": "Increase productivity in your channel by integrating a Jira bot and Github bot.",
                "illustration": "https://via.placeholder.com/509x352.png?text=Integrations"
            }
        },
        "content": [
            {
                "channel": {
                    "id": "channel_id_1",
                    "name": "Feature release",
                    "illustration": "https://via.placeholder.com/509x352.png?text=Channel+feature+release",
					"playbook": "playbook_id_1"
                }
            },
            {
                "board": {
                    "id": "board_id_1",
                    "name": "Meeting Agenda",
                    "illustration": "https://via.placeholder.com/509x352.png?text=Board+meeting+agenda"
                }
            },
            {
                "board": {
                    "id": "board_id_2",
                    "name": "Project Task",
                    "illustration": "https://via.placeholder.com/509x352.png?text=Board+project+task"
                }
            },
            {
                "playbook": {
                    "id": "playbook_id_1",
                    "name": "Feature release",
                    "template": "Product Release",
                    "illustration": "https://via.placeholder.com/509x352.png?text=Playbook+feature+release"
                }
            },
            {
                "integration": {
                    "id": "github"
                }
            },
            {
                "integration": {
                    "id": "jira"
                }
            }
        ]
    },
    "playbook_templates": [
        {
            "title": "Product Release",
            "template": {
                "title": "Product Release",
                "description": "Customize this playbook to reflect your own product release process.",
                "team_id": "",
                "public": true,
                "create_public_playbook_run": false,
                "delete_at": 0,
                "num_stages": 4,
                "num_steps": 0,
                "num_runs": 0,
                "num_actions": 3,
                "last_run_at": 0,
                "checklists": [
                    {
                        "title": "Prepare code",
                        "items": [
                            {
                                "title": "Triage and check for pending tickets and PRs to merge",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Start drafting changelog, feature documentation, and marketing materials",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Review and update project dependencies as needed",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "QA prepares release testing assignments",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Merge database upgrade",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            }
                        ]
                    },
                    {
                        "title": "Release testing",
                        "items": [
                            {
                                "title": "Cut a Release Candidate (RC-1)",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "QA runs smoke tests on the pre-release build",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "QA runs automated load tests and upgrade tests on the pre-release build",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Triage and merge regression bug fixes",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            }
                        ]
                    },
                    {
                        "title": "Prepare release for production",
                        "items": [
                            {
                                "title": "QA final approves the release",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Cut the final release build and publish",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Deploy changelog, upgrade notes, and feature documentation",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Confirm minimum server requirements are updated in documentation",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Update release download links in relevant docs and webpages",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Publish announcements and marketing",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            }
                        ]
                    },
                    {
                        "title": "Post-release",
                        "items": [
                            {
                                "title": "Schedule a release retrospective",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Add dates for the next release to the release calendar and communicate to stakeholders",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Compose release metrics",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Prepare security update communications",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            },
                            {
                                "title": "Archive the incident channel and create a new one for the next release",
                                "description": "",
                                "command": "",
                                "command_last_run": 0,
                                "state": "",
                                "due_date": 0
                            }
                        ]
                    }
                ],
                "members": [],
                "reminder_message_template": "### Changes since last update\n-\n\n### Outstanding PRs\n- ",
                "reminder_timer_default_seconds": 86400,
                "status_update_enabled": true,
                "invited_user_ids": [],
                "invited_group_ids": [],
                "invite_users_enabled": false,
                "default_owner_id": "",
                "default_owner_enabled": false,
                "broadcast_channel_ids": [],
                "broadcast_enabled": true,
                "webhook_on_creation_urls": [],
                "webhook_on_creation_enabled": false,
                "webhook_on_status_update_urls": [],
                "webhook_on_status_update_enabled": true,
                "message_on_join": "Hello and welcome!\n\nThis channel was created as part of the **Product Release** playbook and is where conversations related to this release are held. You can customize this message using markdown so that every new channel member can be welcomed with helpful context and resources.",
                "message_on_join_enabled": true,
                "retrospective_reminder_interval_seconds": 0,
                "retrospective_template": "### Start\n-\n\n### Stop\n-\n\n### Keep\n- ",
                "retrospective_enabled": true,
                "signal_any_keywords": [],
                "signal_any_keywords_enabled": false,
                "category_name": "",
                "categorize_channel_enabled": false,
                "run_summary_template_enabled": true,
                "run_summary_template": "**About**\n- Version number: TBD\n- Target-date: TBD\n\n**Resources**\n- Jira filtered view: [link TBD](#)\n- Blog post draft: [link TBD](#)",
                "channel_name_template": "Release (vX.Y)",
                "default_playbook_member_role": "",
                "metrics": [],
                "is_favorite": false,
                "active_runs": 0,
                "create_channel_member_on_new_participant": true,
                "remove_channel_member_on_removed_participant": true,
                "channel_id": "",
                "channel_mode": "create_new_channel"
            }
        }
    ]
}`)
