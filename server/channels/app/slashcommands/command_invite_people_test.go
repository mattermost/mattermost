// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestParseEmailList(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "single valid email",
			input:    "user@example.com",
			expected: []string{"user@example.com"},
		},
		{
			name:     "multiple valid emails",
			input:    "a@example.com b@example.com",
			expected: []string{"a@example.com", "b@example.com"},
		},
		{
			name:     "trailing commas stripped",
			input:    "a@example.com, b@example.com,",
			expected: []string{"a@example.com", "b@example.com"},
		},
		{
			name:     "non-email tokens filtered out",
			input:    "notanemail a@example.com alsoinvalid",
			expected: []string{"a@example.com"},
		},
		{
			name:     "comma immediately after email treated as one token",
			input:    "a@example.com,b@example.com",
			expected: []string{"a@example.com,b@example.com"},
		},
		{
			name:     "empty input",
			input:    "",
			expected: nil,
		},
		{
			name:     "all tokens invalid",
			input:    "notanemail alsoinvalid",
			expected: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := parseEmailList(tc.input)
			require.Equal(t, tc.expected, result)
		})
	}
}

func TestInvitePeopleProvider(t *testing.T) {
	th := setup(t).initBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendEmailNotifications = true
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	cmd := InvitePeopleProvider{}

	notTeamUser := th.createUser(t)

	// Test without required permissions
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    notTeamUser.Id,
	}

	actual := cmd.DoCommand(th.App, th.Context, args, model.NewId()+"@simulator.amazonses.com")
	assert.Equal(t, "api.command_invite_people.permission.app_error", actual.Text)

	// Test with required permissions.
	args.UserId = th.BasicUser.Id
	actual = cmd.DoCommand(th.App, th.Context, args, model.NewId()+"@simulator.amazonses.com")
	assert.Equal(t, "api.command.invite_people.sent", actual.Text)
}
