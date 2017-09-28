package jira

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWebhookJIRAURL(t *testing.T) {
	var w Webhook
	w.Issue.Self = "http://localhost:8080/rest/api/2/issue/10006"
	assert.Equal(t, "http://localhost:8080", w.JIRAURL())

	w.Issue.Self = "http://localhost:8080/foo/bar/rest/api/2/issue/10006"
	assert.Equal(t, "http://localhost:8080/foo/bar", w.JIRAURL())
}
