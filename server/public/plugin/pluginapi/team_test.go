package pluginapi_test

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/plugin/pluginapi"
)

func TestCreateTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CreateTeam", &model.Team{Name: "1"}).Return(&model.Team{Name: "1", Id: "2"}, nil)

		team := &model.Team{Name: "1"}
		err := client.Team.Create(team)
		require.NoError(t, err)
		require.Equal(t, &model.Team{Name: "1", Id: "2"}, team)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("CreateTeam", &model.Team{Name: "1"}).Return(nil, appErr)

		team := &model.Team{Name: "1"}
		err := client.Team.Create(team)
		require.Equal(t, appErr, err)
		require.Equal(t, &model.Team{Name: "1"}, team)
	})
}

func TestGetTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeam", "1").Return(&model.Team{Id: "2"}, nil)

		team, err := client.Team.Get("1")
		require.NoError(t, err)
		require.Equal(t, &model.Team{Id: "2"}, team)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeam", "1").Return(nil, appErr)

		team, err := client.Team.Get("1")
		require.Equal(t, appErr, err)
		require.Zero(t, team)
	})
}

func TestGetTeamByName(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamByName", "1").Return(&model.Team{Id: "2"}, nil)

		team, err := client.Team.GetByName("1")
		require.NoError(t, err)
		require.Equal(t, &model.Team{Id: "2"}, team)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamByName", "1").Return(nil, appErr)

		team, err := client.Team.GetByName("1")
		require.Equal(t, appErr, err)
		require.Zero(t, team)
	})
}

func TestUpdateTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("UpdateTeam", &model.Team{Name: "1"}).Return(&model.Team{Name: "1", Id: "2"}, nil)

		team := &model.Team{Name: "1"}
		err := client.Team.Update(team)
		require.NoError(t, err)
		require.Equal(t, &model.Team{Name: "1", Id: "2"}, team)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("UpdateTeam", &model.Team{Name: "1"}).Return(nil, appErr)

		team := &model.Team{Name: "1"}
		err := client.Team.Update(team)
		require.Equal(t, appErr, err)
		require.Equal(t, &model.Team{Name: "1"}, team)
	})
}

func TestListTeams(t *testing.T) {
	t.Run("list all", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeams").Return([]*model.Team{{Id: "1"}, {Id: "2"}}, nil)

		teams, err := client.Team.List()
		require.NoError(t, err)
		require.Equal(t, []*model.Team{{Id: "1"}, {Id: "2"}}, teams)
	})

	t.Run("list scoped to user", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamsForUser", "3").Return([]*model.Team{{Id: "1"}, {Id: "2"}}, nil)

		teams, err := client.Team.List(pluginapi.FilterTeamsByUser("3"))
		require.NoError(t, err)
		require.Equal(t, []*model.Team{{Id: "1"}, {Id: "2"}}, teams)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeams").Return(nil, appErr)

		teams, err := client.Team.List()
		require.Equal(t, appErr, err)
		require.Len(t, teams, 0)
	})
}

func TestSearchTeams(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("SearchTeams", "1").Return([]*model.Team{{Id: "1"}, {Id: "2"}}, nil)

		teams, err := client.Team.Search("1")
		require.NoError(t, err)
		require.Equal(t, []*model.Team{{Id: "1"}, {Id: "2"}}, teams)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("SearchTeams", "1").Return(nil, appErr)

		teams, err := client.Team.Search("1")
		require.Equal(t, appErr, err)
		require.Zero(t, teams)
	})
}

func TestDeleteTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("DeleteTeam", "1").Return(nil)

		err := client.Team.Delete("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("DeleteTeam", "1").Return(appErr)

		err := client.Team.Delete("1")
		require.Equal(t, appErr, err)
	})
}

func TestGetTeamIcon(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamIcon", "1").Return([]byte{2}, nil)

		content, err := client.Team.GetIcon("1")
		require.NoError(t, err)
		contentBytes, err := io.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{2}, contentBytes)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamIcon", "1").Return(nil, appErr)

		content, err := client.Team.GetIcon("1")
		require.Equal(t, appErr, err)
		require.Zero(t, content)
	})
}

func TestSetIcon(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("SetTeamIcon", "1", []byte{2}).Return(nil)

		err := client.Team.SetIcon("1", bytes.NewReader([]byte{2}))
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("SetTeamIcon", "1", []byte{2}).Return(appErr)

		err := client.Team.SetIcon("1", bytes.NewReader([]byte{2}))
		require.Equal(t, appErr, err)
	})
}

func TestDeleteIcon(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("RemoveTeamIcon", "1").Return(nil)

		err := client.Team.DeleteIcon("1")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("RemoveTeamIcon", "1").Return(appErr)

		err := client.Team.DeleteIcon("1")
		require.Equal(t, appErr, err)
	})
}

func TestGetTeamUsers(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetUsersInTeam", "1", 2, 3).Return([]*model.User{{Id: "1"}, {Id: "2"}}, nil)

		users, err := client.Team.ListUsers("1", 2, 3)
		require.NoError(t, err)
		require.Equal(t, []*model.User{{Id: "1"}, {Id: "2"}}, users)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetUsersInTeam", "1", 2, 3).Return(nil, appErr)

		users, err := client.Team.ListUsers("1", 2, 3)
		require.Equal(t, appErr, err)
		require.Len(t, users, 0)
	})
}

func TestGetTeamUnreads(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamsUnreadForUser", "1").Return([]*model.TeamUnread{{TeamId: "1"}, {TeamId: "2"}}, nil)

		unreads, err := client.Team.ListUnreadForUser("1")
		require.NoError(t, err)
		require.Equal(t, []*model.TeamUnread{{TeamId: "1"}, {TeamId: "2"}}, unreads)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamsUnreadForUser", "1").Return(nil, appErr)

		unreads, err := client.Team.ListUnreadForUser("1")
		require.Equal(t, appErr, err)
		require.Len(t, unreads, 0)
	})
}

func TestCreateTeamMember(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CreateTeamMember", "1", "2").Return(&model.TeamMember{TeamId: "3"}, nil)

		member, err := client.Team.CreateMember("1", "2")
		require.NoError(t, err)
		require.Equal(t, &model.TeamMember{TeamId: "3"}, member)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("CreateTeamMember", "1", "2").Return(nil, appErr)

		member, err := client.Team.CreateMember("1", "2")
		require.Equal(t, appErr, err)
		require.Zero(t, member)
	})
}

func TestCreateTeamMembers(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CreateTeamMembers", "1", []string{"2"}, "3").Return([]*model.TeamMember{{TeamId: "4"}, {TeamId: "5"}}, nil)

		members, err := client.Team.CreateMembers("1", []string{"2"}, "3")
		require.NoError(t, err)
		require.Equal(t, []*model.TeamMember{{TeamId: "4"}, {TeamId: "5"}}, members)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("CreateTeamMembers", "1", []string{"2"}, "3").Return(nil, appErr)

		members, err := client.Team.CreateMembers("1", []string{"2"}, "3")
		require.Equal(t, appErr, err)
		require.Len(t, members, 0)
	})
}

func TestGetTeamMember(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamMember", "1", "2").Return(&model.TeamMember{TeamId: "3"}, nil)

		member, err := client.Team.GetMember("1", "2")
		require.NoError(t, err)
		require.Equal(t, &model.TeamMember{TeamId: "3"}, member)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamMember", "1", "2").Return(nil, appErr)

		member, err := client.Team.GetMember("1", "2")
		require.Equal(t, appErr, err)
		require.Zero(t, member)
	})
}

func TestGetTeamMembers(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamMembers", "1", 2, 3).Return([]*model.TeamMember{{TeamId: "4"}, {TeamId: "5"}}, nil)

		members, err := client.Team.ListMembers("1", 2, 3)
		require.NoError(t, err)
		require.Equal(t, []*model.TeamMember{{TeamId: "4"}, {TeamId: "5"}}, members)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamMembers", "1", 2, 3).Return(nil, appErr)

		members, err := client.Team.ListMembers("1", 2, 3)
		require.Equal(t, appErr, err)
		require.Len(t, members, 0)
	})
}

func TestGetUserMemberships(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamMembersForUser", "1", 2, 3).Return([]*model.TeamMember{{TeamId: "4"}, {TeamId: "5"}}, nil)

		members, err := client.Team.ListMembersForUser("1", 2, 3)
		require.NoError(t, err)
		require.Equal(t, []*model.TeamMember{{TeamId: "4"}, {TeamId: "5"}}, members)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamMembersForUser", "1", 2, 3).Return(nil, appErr)

		members, err := client.Team.ListMembersForUser("1", 2, 3)
		require.Equal(t, appErr, err)
		require.Len(t, members, 0)
	})
}

func TestUpdateTeamMemberRoles(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("UpdateTeamMemberRoles", "1", "2", "3").Return(&model.TeamMember{TeamId: "3"}, nil)

		membership, err := client.Team.UpdateMemberRoles("1", "2", "3")
		require.NoError(t, err)
		require.Equal(t, &model.TeamMember{TeamId: "3"}, membership)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("UpdateTeamMemberRoles", "1", "2", "3").Return(nil, appErr)

		membership, err := client.Team.UpdateMemberRoles("1", "2", "3")
		require.Equal(t, appErr, err)
		require.Zero(t, membership)
	})
}

func TestDeleteTeamMember(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("DeleteTeamMember", "1", "2", "3").Return(nil)

		err := client.Team.DeleteMember("1", "2", "3")
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("DeleteTeamMember", "1", "2", "3").Return(appErr)

		err := client.Team.DeleteMember("1", "2", "3")
		require.Equal(t, appErr, err)
	})
}

func TestGetTeamStats(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetTeamStats", "1").Return(&model.TeamStats{TeamId: "3"}, nil)

		stats, err := client.Team.GetStats("1")
		require.NoError(t, err)
		require.Equal(t, &model.TeamStats{TeamId: "3"}, stats)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetTeamStats", "1").Return(nil, appErr)

		stats, err := client.Team.GetStats("1")
		require.Equal(t, appErr, err)
		require.Zero(t, stats)
	})
}
