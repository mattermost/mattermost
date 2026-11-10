// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestIsTeamEmailAllowed(t *testing.T) {
	tests := []struct {
		name             string
		email            string
		remoteEmail      string
		emptyRemoteEmail bool
		isRemote         bool
		roles            string
		globalDomains    string
		teamDomains      string
		guestDomains     string
		want             bool
	}{
		{
			name:          "remote user with allowed original domain",
			email:         model.NewId(),
			remoteEmail:   "alice@remote.example",
			isRemote:      true,
			globalDomains: "remote.example",
			want:          true,
		},
		{
			name:          "remote user with blocked domain",
			email:         model.NewId(),
			remoteEmail:   "alice@blocked.example",
			isRemote:      true,
			globalDomains: "remote.example",
			want:          false,
		},
		{
			name:          "local user with allowed domain",
			email:         "alice@remote.example",
			globalDomains: "remote.example",
			want:          true,
		},
		{
			name:          "local user cannot use RemoteEmail",
			email:         "alice@blocked.example",
			remoteEmail:   "alice@remote.example",
			globalDomains: "remote.example",
			want:          false,
		},
		{
			name:          "remote user without RemoteEmail uses valid email",
			email:         "alice@remote.example",
			isRemote:      true,
			globalDomains: "remote.example",
			want:          true,
		},
		{
			name:             "remote user with empty RemoteEmail uses valid email",
			email:            "alice@remote.example",
			emptyRemoteEmail: true,
			isRemote:         true,
			globalDomains:    "remote.example",
			want:             true,
		},
		{
			name:          "remote user without RemoteEmail and synthetic email",
			email:         model.NewId(),
			isRemote:      true,
			globalDomains: "remote.example",
			want:          false,
		},
		{
			name:          "RemoteEmail takes precedence over local email",
			email:         "alice@allowed.example",
			remoteEmail:   "alice@blocked.example",
			isRemote:      true,
			globalDomains: "allowed.example",
			want:          false,
		},
		{
			name:          "allowed by team and server with mixed case",
			email:         model.NewId(),
			remoteEmail:   "Alice@TEAM.Example",
			isRemote:      true,
			globalDomains: "team.example",
			teamDomains:   "team.example",
			want:          true,
		},
		{
			name:          "blocked by team despite server allowance",
			email:         model.NewId(),
			remoteEmail:   "alice@global.example",
			isRemote:      true,
			globalDomains: "global.example,team.example",
			teamDomains:   "team.example",
			want:          false,
		},
		{
			name:          "blocked by server despite team allowance",
			email:         model.NewId(),
			remoteEmail:   "alice@team.example",
			isRemote:      true,
			globalDomains: "global.example",
			teamDomains:   "team.example",
			want:          false,
		},
		{
			name:          "remote guest with allowed guest domain",
			email:         model.NewId(),
			remoteEmail:   "alice@guest.example",
			isRemote:      true,
			roles:         model.SystemGuestRoleId,
			globalDomains: "company.example",
			guestDomains:  "guest.example",
			want:          true,
		},
		{
			name:         "remote guest with blocked guest domain",
			email:        model.NewId(),
			remoteEmail:  "alice@blocked.example",
			isRemote:     true,
			roles:        model.SystemGuestRoleId,
			guestDomains: "guest.example",
			want:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &model.Config{}
			config.TeamSettings.RestrictCreationToDomains = &tt.globalDomains
			config.GuestAccountsSettings.RestrictCreationToDomains = &tt.guestDomains

			service := &TeamService{
				config: func() *model.Config {
					return config
				},
			}

			user := &model.User{
				Email: tt.email,
				Roles: tt.roles,
			}

			if tt.isRemote {
				remoteID := model.NewId()
				user.RemoteId = &remoteID
			}

			if tt.remoteEmail != "" || tt.emptyRemoteEmail {
				user.SetProp(model.UserPropsKeyRemoteEmail, tt.remoteEmail)
			}

			team := &model.Team{
				AllowedDomains: tt.teamDomains,
			}

			require.Equal(t, tt.want,
				service.IsTeamEmailAllowed(user, team))
		})
	}
}
