// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetPlaybookDetailsURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks/playbookTestId",
		getPlaybookDetailsURL("http://mattermost.com", "playbookTestId"),
	)
}

func TestGetPlaybooksNewURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks/new",
		getPlaybooksNewURL("http://mattermost.com"),
	)
}

func TestGetPlaybooksURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks",
		getPlaybooksURL("http://mattermost.com"),
	)
}

func TestGetPlaybookDetailsRelativeURL(t *testing.T) {
	require.Equal(t,
		"/playbooks/playbooks/testPlaybookId",
		GetPlaybookDetailsRelativeURL("testPlaybookId"),
	)
}

func TestGetRunDetailsRelativeURL(t *testing.T) {
	require.Equal(t,
		"/playbooks/runs/testPlaybookRunId",
		GetRunDetailsRelativeURL("testPlaybookRunId"),
	)
}

func TestGetRunDetailsURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/runs/testPlaybookRunId",
		getRunDetailsURL("http://mattermost.com", "testPlaybookRunId"),
	)
}

func TestGetRunRetrospectiveURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/runs/testPlaybookRunId/retrospective",
		getRunRetrospectiveURL("http://mattermost.com", "testPlaybookRunId"),
	)
}
