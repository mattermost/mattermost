package jira

import (
	"bytes"
	"net/url"
	"strings"
	"text/template"
)

type Webhook struct {
	WebhookEvent string
	Issue        struct {
		Self   string
		Key    string
		Fields struct {
			Summary   string
			IssueType struct {
				Name    string
				IconURL string
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
func (w *Webhook) PostText() (string, error) {
	switch w.WebhookEvent {
	case "jira:issue_created", "jira:issue_updated", "jira:issue_deleted":
		if tpl, err := template.New("post").Funcs(template.FuncMap{
			"title":  strings.Title,
			"indent": func(s, indent string) string { return indent + strings.Replace(s, "\n", "\n"+indent, -1) },
		}).New("post").Parse(`` +
			"#### " +
			"[![{{.User.Name}}]({{index .User.AvatarUrls \"16x16\"}})]({{.JIRAURL}}/secure/ViewProfile.jspa?name={{urlquery .User.Name}}) " +
			"[{{.User.DisplayName}}]({{.JIRAURL}}/secure/ViewProfile.jspa?name={{urlquery .User.Name}})** " +
			"{{.Verb}} " +
			"[![{{.Issue.Fields.IssueType.Name}}]({{.Issue.Fields.IssueType.IconURL}})]({{.JIRAURL}}/browse/{{.Issue.Key}}) " +
			"[[{{.Issue.Key}}] {{.Issue.Fields.Summary}}]({{.JIRAURL}}/browse/{{.Issue.Key}})**" +
			"{{range .ChangeLog.Items}}" +
			"\n* **{{title .Field}}**: {{if eq .Field \"description\"}}\n  ```\n{{indent .ToString \"  \"}}\n  ```{{else}}~~{{.FromString}}~~ {{.ToString}}{{end}}" +
			"{{end}}" +
			"{{if .Comment.Body}}\n\n> {{.Comment.Body}}{{end}}",
		); err != nil {
			return "", err
		} else if issueSelf, err := url.Parse(w.Issue.Self); err != nil {
			return "", err
		} else {
			var buf bytes.Buffer
			if err := tpl.Execute(&buf, struct {
				*Webhook
				JIRAURL string
				Verb    string
			}{
				Webhook: w,
				JIRAURL: strings.TrimRight(issueSelf.ResolveReference(&url.URL{Path: "/"}).String(), "/"),
				Verb:    strings.TrimPrefix(w.WebhookEvent, "jira:issue_"),
			}); err != nil {
				return "", err
			}
			return buf.String(), err
		}
	}
	return "", nil
}
