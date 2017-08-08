// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jira

import (
	"bytes"
	"net/url"
	"strings"
	"text/template"

	"github.com/mattermost/platform/model"
)

type Webhook struct {
	WebhookEvent string
	Issue        struct {
		Self   string
		Key    string
		Fields struct {
			Assignee *struct {
				DisplayName string
				Name        string
			}
			Summary     string
			Description string
			Priority    *struct {
				Id   string
				Name string
			}
			IssueType struct {
				Name    string
				IconURL string
			}
			Resolution *struct {
				Id string
			}
			Status struct {
				Id string
			}
		}
	}
	User struct {
		Name        string
		AvatarUrls  map[string]string
		DisplayName string
	}
	Comment struct {
		Body string
	}
	ChangeLog struct {
		Items []struct {
			FromString string
			ToString   string
			Field      string
		}
	}
}

// Returns the text to be placed in the resulting post or an empty string if nothing should be
// posted.
func (w *Webhook) SlackAttachment() (*model.SlackAttachment, error) {
	switch w.WebhookEvent {
	case "jira:issue_created":
	case "jira:issue_updated":
		isResolutionChange := false
		for _, change := range w.ChangeLog.Items {
			if change.Field == "resolution" {
				isResolutionChange = (change.FromString == "") != (change.ToString == "")
				break
			}
		}
		if !isResolutionChange {
			return nil, nil
		}
	case "jira:issue_deleted":
		if w.Issue.Fields.Resolution != nil {
			return nil, nil
		}
	default:
		return nil, nil
	}

	pretext, err := w.renderText("" +
		"{{.User.DisplayName}} {{.Verb}} {{.Issue.Fields.IssueType.Name}} " +
		"[{{.Issue.Key}}]({{.JIRAURL}}/browse/{{.Issue.Key}})" +
		"")
	if err != nil {
		return nil, err
	}

	text, err := w.renderText("" +
		"[{{.Issue.Fields.Summary}}]({{.JIRAURL}}/browse/{{.Issue.Key}})" +
		"{{if eq .WebhookEvent \"jira:issue_created\"}}{{if ne .Issue.Fields.Description \"\"}}" +
		"{{if len .Issue.Fields.Description | lt 3000}}" +
		"\n\n{{printf \"%.3000s\" .Issue.Fields.Description}}..." +
		"{{else}}" +
		"\n\n{{.Issue.Fields.Description}}" +
		"{{end}}" +
		"{{end}}{{end}}" +
		"")
	if err != nil {
		return nil, err
	}

	var fields []*model.SlackAttachmentField
	if w.WebhookEvent == "jira:issue_created" {
		if w.Issue.Fields.Assignee != nil {
			fields = append(fields, &model.SlackAttachmentField{
				Title: "Assignee",
				Value: w.Issue.Fields.Assignee.DisplayName,
				Short: true,
			})
		}
		if w.Issue.Fields.Priority != nil {
			fields = append(fields, &model.SlackAttachmentField{
				Title: "Priority",
				Value: w.Issue.Fields.Priority.Name,
				Short: true,
			})
		}
	}

	return &model.SlackAttachment{
		Fallback: pretext,
		Color:    "#95b7d0",
		Pretext:  pretext,
		Text:     text,
		Fields:   fields,
	}, nil
}

func (w *Webhook) renderText(tplBody string) (string, error) {
	issueSelf, err := url.Parse(w.Issue.Self)
	if err != nil {
		return "", err
	}
	jiraURL := strings.TrimRight(issueSelf.ResolveReference(&url.URL{Path: "/"}).String(), "/")
	verb := strings.TrimPrefix(w.WebhookEvent, "jira:issue_")

	if w.WebhookEvent == "jira:issue_updated" {
		for _, change := range w.ChangeLog.Items {
			if change.Field == "resolution" {
				if change.ToString == "" && change.FromString != "" {
					verb = "reopened"
				} else if change.ToString != "" && change.FromString == "" {
					verb = "resolved"
				}
				break
			}
		}
	}

	tpl, err := template.New("post").Parse(tplBody)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tpl.Execute(&buf, struct {
		*Webhook
		JIRAURL string
		Verb    string
	}{
		Webhook: w,
		JIRAURL: jiraURL,
		Verb:    verb,
	}); err != nil {
		return "", err
	}
	return buf.String(), nil
}
