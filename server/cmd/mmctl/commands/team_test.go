// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestCreateTeamCmd() {
	mockTeamName := "Mock Team"
	mockTeamDisplayname := "Mock Display Name"
	mockTeamEmail := "mock@mattermost.com"

	s.Run("Create team with no name returns error", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		err := createTeamCmdF(s.client, cmd, []string{})

		s.Require().Equal(err, errors.New("name is required"))
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Create team with a name but no display name returns error", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().String("name", mockTeamName, "")

		err := createTeamCmdF(s.client, cmd, []string{})
		s.Require().Equal(err, errors.New("display Name is required"))
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Create valid open team prints the created team", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().String("name", mockTeamName, "")
		cmd.Flags().String("display-name", mockTeamDisplayname, "")

		mockTeam := &model.Team{
			Name:            mockTeamName,
			DisplayName:     mockTeamDisplayname,
			Type:            model.TeamOpen,
			AllowOpenInvite: true,
		}

		s.client.
			EXPECT().
			CreateTeam(mockTeam).
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		err := createTeamCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Equal(mockTeam, printer.GetLines()[0])
		s.Require().Len(printer.GetLines(), 1)
	})

	s.Run("Create valid invite team with email prints the created team", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().String("name", mockTeamName, "")
		cmd.Flags().String("display-name", mockTeamDisplayname, "")
		cmd.Flags().String("email", mockTeamEmail, "")
		cmd.Flags().Bool("private", true, "")

		mockTeam := &model.Team{
			Name:            mockTeamName,
			DisplayName:     mockTeamDisplayname,
			Email:           mockTeamEmail,
			Type:            model.TeamInvite,
			AllowOpenInvite: false,
		}

		s.client.
			EXPECT().
			CreateTeam(mockTeam).
			Return(mockTeam, &model.Response{}, nil).
			Times(1)

		err := createTeamCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Equal(mockTeam, printer.GetLines()[0])
		s.Require().Len(printer.GetLines(), 1)
	})

	s.Run("Create returns an error when the client returns an error", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().String("name", mockTeamName, "")
		cmd.Flags().String("display-name", mockTeamDisplayname, "")

		mockTeam := &model.Team{
			Name:            mockTeamName,
			DisplayName:     mockTeamDisplayname,
			Type:            model.TeamOpen,
			AllowOpenInvite: true,
		}
		mockError := errors.New("remote error")

		s.client.
			EXPECT().
			CreateTeam(mockTeam).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := createTeamCmdF(s.client, cmd, []string{})
		s.Require().Equal("Team creation failed: remote error", err.Error())
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestRenameTeamCmdF() {
	s.Run("Team rename should fail when unknown existing team name is entered", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		args := []string{""}
		args[0] = "existingName"
		cmd.Flags().String("display-name", "newDisplayName", "Team Display Name")

		// Mocking : GetTeam searches with team id, if team not found proceeds with team name search
		s.client.
			EXPECT().
			GetTeam("existingName", "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		// Mocking : GetTeamByname is called, if GetTeam fails to return any team, as team name was passed instead of team id
		s.client.
			EXPECT().
			GetTeamByName("existingName", "").
			Return(nil, &model.Response{}, nil). // Error is nil as team not found will not return error from API
			Times(1)

		err := renameTeamCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "Unable to find team 'existingName', to see the all teams try 'team list' command")
	})

	s.Run("Team rename should fail when api fails to rename", func() {
		printer.Clean()
		cmd := &cobra.Command{}

		existingName := "existingTeamName"
		existingDisplayName := "existingDisplayName"
		newDisplayName := "NewDisplayName"
		args := []string{""}

		args[0] = existingName
		cmd.Flags().String("display-name", newDisplayName, "Display Name")

		// Only reduced model.Team struct for testing per say
		// as we are interested in updating only name and display name
		foundTeam := &model.Team{
			DisplayName: existingDisplayName,
		}
		renamedTeam := &model.Team{
			DisplayName: newDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(args[0], "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(args[0], "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		// Some UN-foreseeable error from the api
		mockError := model.NewAppError("at-random-location.go", "mock error", nil, "mocking a random error", 0)

		// Mock out UpdateTeam which calls the api to rename team
		s.client.
			EXPECT().
			UpdateTeam(renamedTeam).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := renameTeamCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "Cannot rename team '"+existingName+"', error : at-random-location.go: mock error, mocking a random error")
	})

	s.Run("Team rename should work as expected", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		existingName := "existingTeamName"
		existingDisplayName := "existingDisplayName"
		newDisplayName := "NewDisplayName"
		args := []string{""}

		args[0] = existingName
		cmd.Flags().String("display-name", newDisplayName, "Display Name")

		foundTeam := &model.Team{
			DisplayName: existingDisplayName,
		}
		updatedTeam := &model.Team{
			DisplayName: newDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(args[0], "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(args[0], "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateTeam(updatedTeam).
			Return(updatedTeam, &model.Response{}, nil).
			Times(1)

		err := renameTeamCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "'"+existingName+"' team renamed")
	})
}

func (s *MmctlUnitTestSuite) TestListTeamsCmdF() {
	s.Run("Error retrieving teams", func() {
		printer.Clean()
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetAllTeams("", 0, APILimitMaximum).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().EqualError(err, mockError.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("One archived team", func() {
		mockTeam := model.Team{
			Name:     "Team1",
			DeleteAt: 1,
		}

		s.client.
			EXPECT().
			GetAllTeams("", 0, APILimitMaximum).
			Return([]*model.Team{&mockTeam}, &model.Response{}, nil).
			Times(2)

		s.Run("JSON Format", func() {
			printer.Clean()

			err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
			s.Require().NoError(err)
			s.Require().Len(printer.GetLines(), 1)
			s.Require().Equal(&mockTeam, printer.GetLines()[0])
			s.Require().Len(printer.GetErrorLines(), 0)
		})

		s.Run("Plain Format", func() {
			printer.Clean()
			printer.SetFormat(printer.FormatPlain)
			defer printer.SetFormat(printer.FormatJSON)

			err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
			s.Require().NoError(err)
			s.Require().Len(printer.GetLines(), 1)
			s.Require().Equal(mockTeam.Name+" (archived)", printer.GetLines()[0])
			s.Require().Len(printer.GetErrorLines(), 0)
		})
	})

	s.Run("One non-archived team", func() {
		mockTeam := model.Team{
			Name: "Team1",
		}

		s.client.
			EXPECT().
			GetAllTeams("", 0, APILimitMaximum).
			Return([]*model.Team{&mockTeam}, &model.Response{}, nil).
			Times(2)

		s.Run("JSON Format", func() {
			printer.Clean()

			err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
			s.Require().NoError(err)
			s.Require().Len(printer.GetLines(), 1)
			s.Require().Equal(&mockTeam, printer.GetLines()[0])
			s.Require().Len(printer.GetErrorLines(), 0)
		})

		s.Run("Plain Format", func() {
			printer.Clean()
			printer.SetFormat(printer.FormatPlain)
			defer printer.SetFormat(printer.FormatJSON)

			err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
			s.Require().NoError(err)
			s.Require().Len(printer.GetLines(), 1)
			s.Require().Equal(mockTeam.Name, printer.GetLines()[0])
			s.Require().Len(printer.GetErrorLines(), 0)
		})
	})

	s.Run("Several teams", func() {
		mockTeams := []*model.Team{
			{
				Name: "Team1",
			},
			{
				Name:     "Team2",
				DeleteAt: 1,
			},
			{
				Name:     "Team3",
				DeleteAt: 1,
			},
			{
				Name: "Team4",
			},
		}

		s.client.
			EXPECT().
			GetAllTeams("", 0, APILimitMaximum).
			Return(mockTeams, &model.Response{}, nil).
			Times(2)

		s.Run("JSON Format", func() {
			printer.Clean()

			err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
			s.Require().NoError(err)
			s.Require().Len(printer.GetLines(), 4)
			s.Require().Equal(mockTeams[0], printer.GetLines()[0])
			s.Require().Equal(mockTeams[1], printer.GetLines()[1])
			s.Require().Equal(mockTeams[2], printer.GetLines()[2])
			s.Require().Equal(mockTeams[3], printer.GetLines()[3])
			s.Require().Len(printer.GetErrorLines(), 0)
		})

		s.Run("Plain Format", func() {
			printer.Clean()
			printer.SetFormat(printer.FormatPlain)
			defer printer.SetFormat(printer.FormatJSON)

			err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
			s.Require().NoError(err)
			s.Require().Len(printer.GetLines(), 4)
			s.Require().Equal(mockTeams[0].Name, printer.GetLines()[0])
			s.Require().Equal(mockTeams[1].Name+" (archived)", printer.GetLines()[1])
			s.Require().Equal(mockTeams[2].Name+" (archived)", printer.GetLines()[2])
			s.Require().Equal(mockTeams[3].Name, printer.GetLines()[3])
			s.Require().Len(printer.GetErrorLines(), 0)
		})
	})

	s.Run("Multiple team pages", func() {
		printer.Clean()

		mockTeamsPage1 := make([]*model.Team, APILimitMaximum)
		for i := 0; i < APILimitMaximum; i++ {
			mockTeamsPage1[i] = &model.Team{Name: fmt.Sprintf("Team%d", i)}
		}
		mockTeamsPage2 := []*model.Team{{Name: fmt.Sprintf("Team%d", APILimitMaximum)}}

		s.client.
			EXPECT().
			GetAllTeams("", 0, APILimitMaximum).
			Return(mockTeamsPage1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams("", 1, APILimitMaximum).
			Return(mockTeamsPage2, &model.Response{}, nil).
			Times(1)

		err := listTeamsCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), APILimitMaximum+1)
		for i := 0; i < APILimitMaximum+1; i++ {
			s.Require().Equal(printer.GetLines()[i].(*model.Team).Name, fmt.Sprintf("Team%d", i))
		}
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestDeleteTeamsCmd() {
	teamName := "team1"
	teamID := "teamId"

	s.Run("Delete teams with confirm false returns an error", func() {
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		err := deleteTeamsCmdF(s.client, cmd, []string{"some"})
		s.Require().NotNil(err)
		s.Require().Equal("could not proceed, either enable --confirm flag or use an interactive shell to complete operation: this is not an interactive shell", err.Error())
	})

	s.Run("Delete teams with team not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeamByName(teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		err := deleteTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Error(err)
		s.Require().Equal("Unable to find team 'team1'", printer.GetErrorLines()[0])
	})

	s.Run("Delete teams should delete team", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:   teamID,
			Name: teamName,
		}

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PermanentDeleteTeam(teamID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		err := deleteTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Nil(err)
		s.Require().Equal(&mockTeam, printer.GetLines()[0])
	})

	s.Run("Delete teams with error on PermanentDeleteTeam returns an error", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:   teamID,
			Name: teamName,
		}

		mockError := errors.New("an error occurred on deleting a team")

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PermanentDeleteTeam(teamID).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		err := deleteTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Error(err)
		s.Require().Equal("Unable to delete team 'team1' error: an error occurred on deleting a team",
			printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestSearchTeamCmd() {
	s.Run("Search for an existing team by Name", func() {
		printer.Clean()
		teamName := "teamName"
		mockTeam := &model.Team{Name: teamName, DisplayName: "DisplayName"}

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: teamName}).
			Return([]*model.Team{mockTeam}, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{teamName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(mockTeam, printer.GetLines()[0])
	})

	s.Run("Search for an existing team by DisplayName", func() {
		printer.Clean()
		displayName := "displayName"
		mockTeam := &model.Team{Name: "teamName", DisplayName: displayName}

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: displayName}).
			Return([]*model.Team{mockTeam}, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{displayName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(mockTeam, printer.GetLines()[0])
	})

	s.Run("Search nonexistent team by name", func() {
		printer.Clean()
		teamName := "teamName"

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: teamName}).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{teamName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to find team '"+teamName+"'", printer.GetErrorLines()[0])
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Search nonexistent team by displayName", func() {
		printer.Clean()
		displayName := "displayName"

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: displayName}).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{displayName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Equal("Unable to find team '"+displayName+"'", printer.GetErrorLines()[0])
	})

	s.Run("Test search with multiple arguments", func() {
		printer.Clean()
		mockTeam1Name := "Mock Team 1 Name"
		mockTeam2DisplayName := "Mock Team 2 displayName"

		mockTeam1 := &model.Team{Name: mockTeam1Name, DisplayName: "displayName"}
		mockTeam2 := &model.Team{Name: "teamName", DisplayName: mockTeam2DisplayName}

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: mockTeam1Name}).
			Return([]*model.Team{mockTeam1}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: mockTeam2DisplayName}).
			Return([]*model.Team{mockTeam2}, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{mockTeam1Name, mockTeam2DisplayName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(mockTeam1, printer.GetLines()[0])
		s.Require().Equal(mockTeam2, printer.GetLines()[1])
	})

	s.Run("Test get multiple results when search term matches name and displayName of different teams", func() {
		printer.Clean()
		teamVariableName := "Name"

		mockTeam1 := &model.Team{Name: "A", DisplayName: teamVariableName}
		mockTeam2 := &model.Team{Name: teamVariableName, DisplayName: "displayName"}

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: teamVariableName}).
			Return([]*model.Team{mockTeam1, mockTeam2}, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{teamVariableName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(mockTeam1, printer.GetLines()[0])
		s.Require().Equal(mockTeam2, printer.GetLines()[1])
	})

	s.Run("Test duplicates are removed from search results", func() {
		printer.Clean()
		teamVariableName := "Name"

		mockTeam1 := &model.Team{Name: "team1", DisplayName: teamVariableName}
		mockTeam2 := &model.Team{Name: "team2", DisplayName: teamVariableName}
		mockTeam3 := &model.Team{Name: "team3", DisplayName: teamVariableName}
		mockTeam4 := &model.Team{Name: "team4", DisplayName: teamVariableName}

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: "team"}).
			Return([]*model.Team{mockTeam1, mockTeam2, mockTeam3, mockTeam4}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: teamVariableName}).
			Return([]*model.Team{mockTeam1, mockTeam2, mockTeam3, mockTeam4}, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{"team", teamVariableName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 4)
	})

	s.Run("Test search results are sorted", func() {
		printer.Clean()
		teamVariableName := "Name"

		mockTeam1 := &model.Team{Name: "A", DisplayName: teamVariableName}
		mockTeam2 := &model.Team{Name: "e", DisplayName: teamVariableName}
		mockTeam3 := &model.Team{Name: "C", DisplayName: teamVariableName}
		mockTeam4 := &model.Team{Name: "D", DisplayName: teamVariableName}
		mockTeam5 := &model.Team{Name: "1", DisplayName: teamVariableName}

		s.client.
			EXPECT().
			SearchTeams(&model.TeamSearch{Term: teamVariableName}).
			Return([]*model.Team{mockTeam1, mockTeam2, mockTeam3, mockTeam4, mockTeam5}, &model.Response{}, nil).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{teamVariableName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 5)
		s.Require().Equal(mockTeam5, printer.GetLines()[0]) // 1
		s.Require().Equal(mockTeam1, printer.GetLines()[1]) // A
		s.Require().Equal(mockTeam3, printer.GetLines()[2]) // C
		s.Require().Equal(mockTeam4, printer.GetLines()[3]) // D
		s.Require().Equal(mockTeam2, printer.GetLines()[4]) // e
	})

	s.Run("Search returns an error when the client returns an error", func() {
		printer.Clean()
		mockError := errors.New("remote error")
		teamName := "teamName"
		s.client.EXPECT().
			SearchTeams(&model.TeamSearch{Term: teamName}).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := searchTeamCmdF(s.client, &cobra.Command{}, []string{teamName})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestModifyTeamsCmd() {
	teamName := "team1"
	teamID := "teamId"

	s.Run("Modify teams with no flags returns an error", func() {
		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", false, "")
		cmd.Flags().Bool("public", false, "")
		err := modifyTeamsCmdF(s.client, cmd, []string{"some"})
		s.Require().NotNil(err)
		s.Require().Equal(err.Error(), "must specify one of --private or --public")
	})

	s.Run("Modify teams with both flags returns an error", func() {
		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", true, "")
		cmd.Flags().Bool("public", true, "")
		err := modifyTeamsCmdF(s.client, cmd, []string{"some"})
		s.Require().NotNil(err)
		s.Require().Equal(err.Error(), "must specify one of --private or --public")
	})

	s.Run("Modify teams with team not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeamByName(teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", true, "")

		err := modifyTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Nil(err)
		s.Require().Equal("Unable to find team 'team1'", printer.GetErrorLines()[0])
	})

	s.Run("Modify teams, set to private", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:              teamID,
			Name:            teamName,
			AllowOpenInvite: true,
			Type:            model.TeamOpen,
		}

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateTeamPrivacy(teamID, model.TeamInvite).
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("private", true, "")

		err := modifyTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Nil(err)
		s.Require().Equal(&mockTeam, printer.GetLines()[0])
	})

	s.Run("Modify teams, set to public", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:              teamID,
			Name:            teamName,
			AllowOpenInvite: false,
			Type:            model.TeamInvite,
		}

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateTeamPrivacy(teamID, model.TeamOpen).
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("public", true, "")

		err := modifyTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Nil(err)
		s.Require().Equal(&mockTeam, printer.GetLines()[0])
	})

	s.Run("Modify teams with error on UpdateTeamPrivacy returns an error", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:              teamID,
			Name:            teamName,
			AllowOpenInvite: false,
			Type:            model.TeamInvite,
		}

		mockError := errors.New("an error occurred modifying a team")

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateTeamPrivacy(teamID, model.TeamOpen).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("public", true, "")

		err := modifyTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Nil(err)
		s.Require().Equal("Unable to modify team 'team1' error: an error occurred modifying a team",
			printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestRestoreTeamsCmd() {
	teamName := "team1"
	teamID := "teamId"
	cmd := &cobra.Command{}

	s.Run("Restore teams with team not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeamByName(teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := restoreTeamsCmdF(s.client, cmd, []string{"team1"})
		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to find team '%s'", teamName))

		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Restore team", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:   teamID,
			Name: teamName,
		}

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreTeam(teamID).
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		err := restoreTeamsCmdF(s.client, cmd, []string{"team1"})
		s.Require().Nil(err)
		s.Require().Equal(&mockTeam, printer.GetLines()[0])
	})

	s.Run("Restore team with error on RestoreTeam returns an error", func() {
		printer.Clean()
		mockTeam := model.Team{
			Id:   teamID,
			Name: teamName,
		}

		mockError := errors.New("an error occurred restoring a team")

		s.client.
			EXPECT().
			GetTeam(teamName, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreTeam(teamID).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := restoreTeamsCmdF(s.client, cmd, []string{"team1"})
		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to restore team '%s' error: an error occurred restoring a team", teamName))

		s.Require().EqualError(err, expected.Error())
	})
}
