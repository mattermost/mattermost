package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/server/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLRunList(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("list by participantOrFollower", func(t *testing.T) {
		var rResultTest struct {
			Data struct {
				Runs struct {
					TotalCount int
					Edges      []struct {
						Node struct {
							ID         string
							Name       string
							IsFavorite bool
						}
					}
				}
			}
			Errors []struct {
				Message string
				Path    string
			}
		}
		testRunsQuery := `
		query Runs($userID: String!) {
			runs(participantOrFollowerID: $userID) {
				totalCount
				edges {
					node {
						id
						name
						isFavorite
					}
				}
			}
		}
		`
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testRunsQuery,
			OperationName: "Runs",
			Variables:     map[string]interface{}{"userID": "me"},
		}, &rResultTest)
		require.NoError(t, err)

		assert.Len(t, rResultTest.Data.Runs.Edges, 1)
		assert.Equal(t, 1, rResultTest.Data.Runs.TotalCount)
		assert.Equal(t, e.BasicRun.ID, rResultTest.Data.Runs.Edges[0].Node.ID)
		assert.Equal(t, e.BasicRun.Name, rResultTest.Data.Runs.Edges[0].Node.Name)
		assert.False(t, rResultTest.Data.Runs.Edges[0].Node.IsFavorite)
	})

	t.Run("list by channel", func(t *testing.T) {
		var rResultTest struct {
			Data struct {
				Runs struct {
					TotalCount int
					Edges      []struct {
						Node struct {
							ID         string
							Name       string
							IsFavorite bool
						}
					}
				}
			}
			Errors []struct {
				Message string
				Path    string
			}
		}
		testRunsQuery := `
		query Runs($channelID: String!) {
			runs(channelID: $channelID) {
				totalCount
				edges {
					node {
						id
						name
						isFavorite
					}
				}
			}
		}
		`
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testRunsQuery,
			OperationName: "Runs",
			Variables:     map[string]interface{}{"channelID": e.BasicRun.ChannelID},
		}, &rResultTest)
		require.NoError(t, err)

		assert.Len(t, rResultTest.Data.Runs.Edges, 1)
		assert.Equal(t, 1, rResultTest.Data.Runs.TotalCount)
		assert.Equal(t, e.BasicRun.ID, rResultTest.Data.Runs.Edges[0].Node.ID)
		assert.Equal(t, e.BasicRun.Name, rResultTest.Data.Runs.Edges[0].Node.Name)
		assert.False(t, rResultTest.Data.Runs.Edges[0].Node.IsFavorite)
	})

	// Make more runs in the channel
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Basic create",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
		ChannelID:   e.BasicRun.ChannelID,
	})
	require.NoError(e.T, err)
	require.NotNil(e.T, run)

	run2, err2 := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Basic create",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
		ChannelID:   e.BasicRun.ChannelID,
	})
	require.NoError(e.T, err2)
	require.NotNil(e.T, run2)

	t.Run("paging", func(t *testing.T) {
		var rResultTest struct {
			Data struct {
				Runs struct {
					TotalCount int
					Edges      []struct {
						Node struct {
							ID         string
							Name       string
							IsFavorite bool
						}
					}
					PageInfo struct {
						EndCursor   string
						HasNextPage bool
					}
				}
			}
			Errors []struct {
				Message string
				Path    string
			}
		}
		testRunsQuery := `
		query Runs($channelID: String!, $first: Int, $after: String) {
			runs(channelID: $channelID, first: $first, after: $after) {
				totalCount
				edges {
					node {
						id
						name
						isFavorite
					}
				}
				pageInfo {
					endCursor
					hasNextPage
				}
			}
		}
		`
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testRunsQuery,
			OperationName: "Runs",
			Variables:     map[string]interface{}{"channelID": e.BasicRun.ChannelID, "first": 2},
		}, &rResultTest)
		require.NoError(t, err)

		assert.Len(t, rResultTest.Data.Runs.Edges, 2)
		assert.Equal(t, 3, rResultTest.Data.Runs.TotalCount)
		assert.True(t, rResultTest.Data.Runs.PageInfo.HasNextPage)
		assert.Equal(t, "1", rResultTest.Data.Runs.PageInfo.EndCursor)

		err2 := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testRunsQuery,
			OperationName: "Runs",
			Variables:     map[string]interface{}{"channelID": e.BasicRun.ChannelID, "first": 2, "after": "1"},
		}, &rResultTest)
		require.NoError(t, err2)

		assert.Len(t, rResultTest.Data.Runs.Edges, 1)
		assert.Equal(t, 3, rResultTest.Data.Runs.TotalCount)
		assert.False(t, rResultTest.Data.Runs.PageInfo.HasNextPage)
	})
}

func TestGraphQLChangeRunParticipants(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	user3, _, err := e.ServerAdminClient.CreateUser(&model.User{
		Email:    "thirduser@example.com",
		Username: "thirduser",
		Password: "Password123!",
	})
	require.NoError(t, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(e.BasicTeam.Id, user3.Id)
	require.NoError(t, err)

	userNotInTeam, _, err := e.ServerAdminClient.CreateUser(&model.User{
		Email:    "notinteam@example.com",
		Username: "notinteam",
		Password: "Password123!",
	})
	require.NoError(t, err)

	// if the test fits this testTable structure, add it here
	// otherwise, create another t.Run()
	testCases := []struct {
		Name                     string
		PlaybookCreateOptions    client.PlaybookCreateOptions
		PlaybookRunCreateOptions client.PlaybookRunCreateOptions
		ParticipantsToBeAdded    []string
		ExpectedRunParticipants  []string
		ExpectedRunFollowers     []string
		ExpectedChannelMembers   []string
		UnexpectedChannelMembers []string
	}{
		{
			Name: "Add 2 participants, actions ON, reporter = owner",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: true,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser.Id,
			},
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			UnexpectedChannelMembers: []string{},
		},
		{
			Name: "Add 1 participant, actions ON, reporter != owner",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: true,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser2.Id,
			},
			ParticipantsToBeAdded:    []string{user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			UnexpectedChannelMembers: []string{},
		},
		{
			Name: "Add 2 participants, actions OFF, reporter = owner",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: false,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser.Id,
			},
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id},
			UnexpectedChannelMembers: []string{e.RegularUser2.Id, user3.Id},
		},
		{
			Name: "Add 2 participants, actions OFF, one from another different team",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: false,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser.Id,
			},
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, userNotInTeam.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id},
			UnexpectedChannelMembers: []string{e.RegularUser2.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			tc.PlaybookCreateOptions.Title = "Playbook title"
			tc.PlaybookCreateOptions.TeamID = e.BasicTeam.Id
			pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), tc.PlaybookCreateOptions)
			require.NoError(t, err)

			tc.PlaybookRunCreateOptions.Name = "Run title"
			tc.PlaybookRunCreateOptions.TeamID = e.BasicTeam.Id
			tc.PlaybookRunCreateOptions.PlaybookID = pbID
			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), tc.PlaybookRunCreateOptions)
			require.NoError(t, err)

			_, err = addParticipants(e.PlaybooksClient, run.ID, tc.ParticipantsToBeAdded)
			require.NoError(t, err)

			// assert participants
			run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
			require.NoError(t, err)
			require.Len(t, run.ParticipantIDs, len(tc.ExpectedRunParticipants))
			for _, ep := range tc.ExpectedRunParticipants {
				found := false
				for _, p := range run.ParticipantIDs {
					if p == ep {
						found = true
						break
					}
				}
				assert.True(t, found, fmt.Sprintf("Participant %s not found", ep))
			}
			// assert followers
			meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
			require.NoError(t, err)
			require.Len(t, meta.Followers, len(tc.ExpectedRunFollowers))
			for _, ef := range tc.ExpectedRunFollowers {
				found := false
				for _, f := range meta.Followers {
					if f == ef {
						found = true
						break
					}
				}
				assert.True(t, found, fmt.Sprintf("Follower %s not found", ef))
			}
			//assert channel members
			for _, ecm := range tc.ExpectedChannelMembers {
				member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, ecm)
				require.Nil(t, err)
				assert.Equal(t, ecm, member.UserId)
			}
			// assert unexpected channel members
			for _, ucm := range tc.UnexpectedChannelMembers {
				_, err = e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, ucm)
				require.Error(t, err)
				assert.Contains(t, err.Error(), "No channel member found for that user ID and channel ID")
			}
		})

	}

	t.Run("remove two participants", func(t *testing.T) {
		response, err := removeParticipants(e.PlaybooksClient, e.BasicRun.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 1)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), e.BasicRun.ChannelID, e.RegularUser2.Id)
		require.NotNil(t, err)
		assert.Nil(t, member)

		member, err = e.A.GetChannelMember(request.EmptyContext(nil), e.BasicRun.ChannelID, user3.Id)
		require.NotNil(t, err)
		assert.Nil(t, member)
	})

	t.Run("remove two participants without removing from channel members", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                                   "TestPlaybookNoMembersNoChannelRemove",
			TeamID:                                  e.BasicTeam.Id,
			Public:                                  true,
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: false,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		response, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		response, err = removeParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 1)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, e.RegularUser2.Id)
		require.Nil(t, err)
		assert.NotNil(t, member)

		member, err = e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, user3.Id)
		require.Nil(t, err)
		assert.NotNil(t, member)
	})

	t.Run("add participant to a public run with private channel", func(t *testing.T) {
		// This flow test a user with run access (regularUser) that adds another user (regularUser2)
		// to a public run with a private channel
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                               "TestPrivatePlaybookNoMembers",
			TeamID:                              e.BasicTeam.Id,
			Public:                              true,
			CreatePublicPlaybookRun:             false,
			CreateChannelMemberOnNewParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		response, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 2)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])
		assert.Equal(t, e.RegularUser2.Id, meta.Followers[1])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, e.RegularUser2.Id)
		require.Nil(t, err)
		assert.Equal(t, e.RegularUser2.Id, member.UserId)
	})

	t.Run("join a public run with private channel", func(t *testing.T) {

		// This flow test a user (regularUser2) that wants to participate a public run with a private channel

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                               "TestPrivatePlaybookNoMembers",
			TeamID:                              e.BasicTeam.Id,
			Public:                              true,
			CreatePublicPlaybookRun:             false,
			CreateChannelMemberOnNewParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		response, err := addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 2)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])
		assert.Equal(t, e.RegularUser2.Id, meta.Followers[1])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, e.RegularUser2.Id)
		require.Nil(t, err)
		assert.Equal(t, e.RegularUser2.Id, member.UserId)
	})

	t.Run("not participant tries to add other participant", func(t *testing.T) {

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                               "TestPrivatePlaybookNoMembers",
			TeamID:                              e.BasicTeam.Id,
			Public:                              true,
			CreatePublicPlaybookRun:             true,
			CreateChannelMemberOnNewParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		// Should not be able to add participants, because is not a participant
		response, err := addParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)

		// Should be able to join the run
		response, err = addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)

		// After joining the run user should be able to add other participants
		response, err = addParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 3)
	})

	t.Run("leave run", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                                   "TestPrivatePlaybookNoMembers",
			TeamID:                                  e.BasicTeam.Id,
			Public:                                  true,
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		// join the run
		response, err := addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)

		// leave run
		response, err = removeParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)
	})

	t.Run("not participant tries to remove participant", func(t *testing.T) {

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                   "TestPrivatePlaybookNoMembers",
			TeamID:                  e.BasicTeam.Id,
			Public:                  true,
			CreatePublicPlaybookRun: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		// add participant
		response, err := addParticipants(e.PlaybooksClient, run.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)

		// try to remove the participant
		response, err = removeParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)

		// join the run
		response, err = addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 3)

		// now should be able to remove participant
		response, err = removeParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])
	})
}

func TestGraphQLChangeRunOwner(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// create a third user to test change owner
	user3, _, err := e.ServerAdminClient.CreateUser(&model.User{
		Email:    "thirduser@example.com",
		Username: "thirduser",
		Password: "Password123!",
	})
	require.NoError(t, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(e.BasicTeam.Id, user3.Id)
	require.NoError(t, err)

	t.Run("set another participant as owner", func(t *testing.T) {
		// add another participant
		response, err := addParticipants(e.PlaybooksClient, e.BasicRun.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		response, err = changeRunOwner(e.PlaybooksClient, e.BasicRun.ID, user3.Id)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Equal(t, user3.Id, run.OwnerUserID)
	})

	t.Run("not participant tries to change an owner", func(t *testing.T) {
		response, err := changeRunOwner(e.PlaybooksClient2, e.BasicRun.ID, e.RegularUser.Id)
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)
	})

	t.Run("set not participant as owner", func(t *testing.T) {
		response, err := changeRunOwner(e.PlaybooksClient, e.BasicRun.ID, e.RegularUser2.Id)
		require.Empty(t, response.Errors)
		require.NoError(t, err)
	})

}

func TestSetRunFavorite(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRun := func() *client.PlaybookRun {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	t.Run("change favorite to true", func(t *testing.T) {
		run := createRun()

		response, err := setRunFavorite(e.PlaybooksClient, run.ID, true)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err := getRunFavorite(e.PlaybooksClient, run.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)
	})

	t.Run("from true to false returns false", func(t *testing.T) {
		run := createRun()

		response, err := setRunFavorite(e.PlaybooksClient, run.ID, true)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		isFavorite, err := getRunFavorite(e.PlaybooksClient, run.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)

		// now that we have this run favorite set to true, if we change it again,
		// it should return false
		response, err = setRunFavorite(e.PlaybooksClient, run.ID, false)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		isFavorite, err = getRunFavorite(e.PlaybooksClient, run.ID)
		require.NoError(t, err)
		require.False(t, isFavorite)
	})

	t.Run("if already true, should give error", func(t *testing.T) {
		run := createRun()

		response, err := setRunFavorite(e.PlaybooksClient, run.ID, true)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		isFavorite, err := getRunFavorite(e.PlaybooksClient, run.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)

		response, err = setRunFavorite(e.PlaybooksClient, run.ID, true)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors)
	})

	t.Run("if already false, should give error", func(t *testing.T) {
		run := createRun()

		response, err := setRunFavorite(e.PlaybooksClient, run.ID, false)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors)
	})

	t.Run("if user is not from the team", func(t *testing.T) {
		run := createRun()

		response, err := setRunFavorite(e.PlaybooksClientNotInTeam, run.ID, true)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors)

		isFavorite, err := getRunFavorite(e.PlaybooksClient, run.ID)
		require.NoError(t, err)
		require.False(t, isFavorite)
	})
}

func TestResolverFavorites(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRun := func() *client.PlaybookRun {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	runs := []*client.PlaybookRun{
		createRun(),
		createRun(),
	}
	response, err := setRunFavorite(e.PlaybooksClient, runs[0].ID, true)
	require.NoError(t, err)
	require.Empty(t, response.Errors)
	response, err = setRunFavorite(e.PlaybooksClient, runs[1].ID, true)
	require.NoError(t, err)
	require.Empty(t, response.Errors)

	favorites, err := getRunFavorites(e.PlaybooksClient)
	require.NoError(t, err)
	require.True(t, favorites[runs[0].ID])
	require.True(t, favorites[runs[1].ID])
}

func TestResolverPlaybooks(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRun := func() *client.PlaybookRun {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	runs := []*client.PlaybookRun{
		createRun(),
		createRun(),
	}

	playbooks, err := getRunPlaybooks(e.PlaybooksClient)
	require.NoError(t, err)
	require.Equal(t, e.BasicPlaybook.ID, playbooks[runs[0].ID])
	require.Equal(t, e.BasicPlaybook.ID, playbooks[runs[1].ID])
}

func TestUpdateRun(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRun := func() *client.PlaybookRun {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	t.Run("update run summary", func(t *testing.T) {
		run := createRun()
		require.Equal(t, "", run.Summary)
		oldSummaryModifiedAt := run.SummaryModifiedAt

		updates := map[string]interface{}{
			"summary": "The updated summary",
		}
		response, err := updateRun(e.PlaybooksClient, run.ID, updates)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the summary is updated
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, updates["summary"], editedRun.Summary)
		require.Greater(t, editedRun.SummaryModifiedAt, oldSummaryModifiedAt)
	})

	t.Run("update run name", func(t *testing.T) {
		run := createRun()
		require.Equal(t, "Run with private channel", run.Name)

		updates := map[string]interface{}{
			"name": "The updated name",
		}
		response, err := updateRun(e.PlaybooksClient, run.ID, updates)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the name is updated
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, updates["name"], editedRun.Name)
	})

	t.Run("update run actions", func(t *testing.T) {
		run := createRun()

		// data previous to update
		prevRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.False(t, prevRun.StatusUpdateBroadcastChannelsEnabled)
		assert.False(t, prevRun.StatusUpdateBroadcastWebhooksEnabled)
		assert.Empty(t, prevRun.WebhookOnStatusUpdateURLs)
		assert.Empty(t, prevRun.BroadcastChannelIDs)
		assert.True(t, prevRun.CreateChannelMemberOnNewParticipant)
		assert.True(t, prevRun.RemoveChannelMemberOnRemovedParticipant)

		//update
		updates := map[string]interface{}{
			"statusUpdateBroadcastChannelsEnabled":    true,
			"statusUpdateBroadcastWebhooksEnabled":    true,
			"broadcastChannelIDs":                     []string{e.BasicPublicChannel.Id},
			"webhookOnStatusUpdateURLs":               []string{"https://url1", "https://url2"},
			"createChannelMemberOnNewParticipant":     false,
			"removeChannelMemberOnRemovedParticipant": false,
		}
		response, err := updateRun(e.PlaybooksClient, run.ID, updates)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the action settings are updated
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.True(t, editedRun.StatusUpdateBroadcastChannelsEnabled)
		require.True(t, editedRun.StatusUpdateBroadcastWebhooksEnabled)
		require.Equal(t, updates["broadcastChannelIDs"], editedRun.BroadcastChannelIDs)
		require.Equal(t, updates["webhookOnStatusUpdateURLs"], editedRun.WebhookOnStatusUpdateURLs)
		require.False(t, editedRun.CreateChannelMemberOnNewParticipant)
		require.False(t, editedRun.RemoveChannelMemberOnRemovedParticipant)
	})

	t.Run("update fails due to lack of permissions", func(t *testing.T) {
		run := createRun()

		//update
		updates := map[string]interface{}{
			"statusUpdateBroadcastChannelsEnabled":    true,
			"statusUpdateBroadcastWebhooksEnabled":    true,
			"broadcastChannelIDs":                     []string{e.BasicPublicChannel.Id},
			"webhookOnStatusUpdateURLs":               []string{"https://url1", "https://url2"},
			"createChannelMemberOnNewParticipant":     false,
			"removeChannelMemberOnRemovedParticipant": false,
		}
		response, err := updateRun(e.PlaybooksClient2, run.ID, updates)
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the action settings are not updated
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.False(t, editedRun.StatusUpdateBroadcastChannelsEnabled)
		require.False(t, editedRun.StatusUpdateBroadcastWebhooksEnabled)
		assert.Empty(t, editedRun.WebhookOnStatusUpdateURLs)
		assert.Empty(t, editedRun.BroadcastChannelIDs)
		require.True(t, editedRun.CreateChannelMemberOnNewParticipant)
		require.True(t, editedRun.RemoveChannelMemberOnRemovedParticipant)
	})
}

func TestUpdateRunTaskActions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("task actions mutation create and update", func(t *testing.T) {
		createNewRunWithNoChecklists := func(t *testing.T) *client.PlaybookRun {
			t.Helper()

			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
				Name:        "Run name",
				OwnerUserID: e.RegularUser.Id,
				TeamID:      e.BasicTeam.Id,
				PlaybookID:  e.BasicPlaybook.ID,
			})
			require.NoError(t, err)
			require.Len(t, run.Checklists, 0)

			return run
		}
		run := createNewRunWithNoChecklists(t)
		// Create a valid, empty checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "First Checklist",
			Items: []client.ChecklistItem{{
				Title: "First item",
			}},
		})
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.Checklists, 1)
		require.Len(t, run.Checklists[0].Items, 1)

		// create a new task action
		triggerPayload := "{\"keywords\":[\"one\", \"two\"], \"user_ids\":[\"abc\"]}"
		actionPayload := "{\"enabled\":false}"
		response, err := UpdateRunTaskActions(e.PlaybooksClient, run.ID, 0, 0, &[]app.TaskAction{
			{
				Trigger: app.Trigger{
					Type:    app.KeywordsByUsersTriggerType,
					Payload: triggerPayload,
				},
				Actions: []app.Action{{
					Type:    app.MarkItemAsDoneActionType,
					Payload: actionPayload,
				}},
			},
		})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the taskaction is created
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Len(t, editedRun.Checklists[0].Items, 1)
		require.Len(t, editedRun.Checklists[0].Items[0].TaskActions, 1)
		require.Equal(t, string(app.KeywordsByUsersTriggerType), editedRun.Checklists[0].Items[0].TaskActions[0].Trigger.Type)
		require.Equal(t, triggerPayload, editedRun.Checklists[0].Items[0].TaskActions[0].Trigger.Payload)
		require.Equal(t, string(app.MarkItemAsDoneActionType), editedRun.Checklists[0].Items[0].TaskActions[0].Actions[0].Type)
		require.Equal(t, actionPayload, editedRun.Checklists[0].Items[0].TaskActions[0].Actions[0].Payload)

		// Edit the task action
		newTriggerPayload := "{\"keywords\":[\"one\", \"two\", \"edited\"], \"user_ids\":[\"abc\"]}"
		response, err = UpdateRunTaskActions(e.PlaybooksClient, run.ID, 0, 0, &[]app.TaskAction{
			{
				Trigger: app.Trigger{
					Type:    app.KeywordsByUsersTriggerType,
					Payload: newTriggerPayload,
				},
				Actions: []app.Action{{
					Type:    app.MarkItemAsDoneActionType,
					Payload: actionPayload,
				}},
			},
		})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the taskaction is updated
		editedRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Len(t, editedRun.Checklists[0].Items, 1)
		require.Len(t, editedRun.Checklists[0].Items[0].TaskActions, 1)
		require.Equal(t, string(app.KeywordsByUsersTriggerType), editedRun.Checklists[0].Items[0].TaskActions[0].Trigger.Type)
		require.Equal(t, newTriggerPayload, editedRun.Checklists[0].Items[0].TaskActions[0].Trigger.Payload)
		require.Equal(t, string(app.MarkItemAsDoneActionType), editedRun.Checklists[0].Items[0].TaskActions[0].Actions[0].Type)
		require.Equal(t, actionPayload, editedRun.Checklists[0].Items[0].TaskActions[0].Actions[0].Payload)
	})
}

func TestBadGraphQLRequest(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	testRunsQuery := `
		query Runs($userID: String!) {
			runs(participantOrFollowerID: $userID) {
				totalCount
				these
				fields
				dont
				exist
			}
		}
		`
	var result struct {
		Data   struct{}
		Errors []struct {
			Message string
			Path    string
		}
	}
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testRunsQuery,
		OperationName: "Runs",
		Variables:     map[string]interface{}{"userID": "me"},
	}, &result)
	require.NoError(t, err)
	require.Len(t, result.Errors, 4)
}

// AddParticipants adds participants to the run
func addParticipants(c *client.Client, playbookRunID string, userIDs []string) (graphql.Response, error) {
	mutation := `
	mutation AddRunParticipants($runID: String!, $userIDs: [String!]!) {
		addRunParticipants(runID: $runID, userIDs: $userIDs)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "AddRunParticipants",
		Variables: map[string]interface{}{
			"runID":   playbookRunID,
			"userIDs": userIDs,
		},
	}, &response)

	return response, err
}

// RemoveParticipants removes participants from the run
func removeParticipants(c *client.Client, playbookRunID string, userIDs []string) (graphql.Response, error) {
	mutation := `
	mutation RemoveRunParticipants($runID: String!, $userIDs: [String!]!) {
		removeRunParticipants(runID: $runID, userIDs: $userIDs)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "RemoveRunParticipants",
		Variables: map[string]interface{}{
			"runID":   playbookRunID,
			"userIDs": userIDs,
		},
	}, &response)

	return response, err
}

// ChangeRunOwner changes run owner
func changeRunOwner(c *client.Client, playbookRunID string, newOwnerID string) (graphql.Response, error) {
	mutation := `
	mutation ChangeRunOwner($runID: String!, $ownerID: String!) {
		changeRunOwner(runID: $runID, ownerID: $ownerID)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "ChangeRunOwner",
		Variables: map[string]interface{}{
			"runID":   playbookRunID,
			"ownerID": newOwnerID,
		},
	}, &response)

	return response, err
}

func setRunFavorite(c *client.Client, playbookRunID string, fav bool) (graphql.Response, error) {
	mutation := `mutation SetRunFavorite($id: String!, $fav: Boolean!) {
		setRunFavorite(id: $id, fav: $fav)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "SetRunFavorite",
		Variables: map[string]interface{}{
			"id":  playbookRunID,
			"fav": fav,
		},
	}, &response)

	return response, err
}

func getRunFavorites(c *client.Client) (map[string]bool, error) {
	query := `
	query GetFavorites {
		runs {
			edges {
				node{
					id
					isFavorite
				}
			}
		}
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         query,
		OperationName: "GetFavorites",
	}, &response)

	if err != nil {
		return nil, err
	}
	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("error from query %v", response.Errors)
	}
	rawResult := struct {
		Runs struct {
			Edges []struct {
				Node struct {
					ID         string `json:"id"`
					IsFavorite bool   `json:"isFavorite"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"runs"`
	}{}
	err = json.Unmarshal(response.Data, &rawResult)
	if err != nil {
		return nil, err
	}
	result := make(map[string]bool)
	for _, edges := range rawResult.Runs.Edges {
		result[edges.Node.ID] = edges.Node.IsFavorite
	}
	return result, nil
}

func getRunPlaybooks(c *client.Client) (map[string]string, error) {
	query := `
	query GetRunsWithPlaybooks {
		runs {
			edges {
				node{
					id
					playbook {
						id
					}
				}
			}
		}
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         query,
		OperationName: "GetRunsWithPlaybooks",
	}, &response)

	if err != nil {
		return nil, err
	}
	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("error from query %v", response.Errors)
	}
	rawResult := struct {
		Runs struct {
			Edges []struct {
				Node struct {
					ID       string `json:"id"`
					Playbook struct {
						ID string `json:"id"`
					}
				} `json:"node"`
			} `json:"edges"`
		} `json:"runs"`
	}{}
	err = json.Unmarshal(response.Data, &rawResult)
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, edges := range rawResult.Runs.Edges {
		result[edges.Node.ID] = edges.Node.Playbook.ID
	}
	return result, nil
}

func getRunFavorite(c *client.Client, playbookRunID string) (bool, error) {
	query := `
	query GetRunFavorite($id: String!) {
		run(id: $id) {
			isFavorite
		}
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         query,
		OperationName: "GetRunFavorite",
		Variables: map[string]interface{}{
			"id": playbookRunID,
		},
	}, &response)

	if err != nil {
		return false, err
	}
	if len(response.Errors) > 0 {
		return false, fmt.Errorf("error from query %v", response.Errors)
	}

	favoriteResponse := struct {
		Run struct {
			IsFavorite bool `json:"isFavorite"`
		} `json:"run"`
	}{}
	err = json.Unmarshal(response.Data, &favoriteResponse)
	if err != nil {
		return false, err
	}
	return favoriteResponse.Run.IsFavorite, nil
}

// UpdateRun updates the run
func updateRun(c *client.Client, playbookRunID string, updates map[string]interface{}) (graphql.Response, error) {
	mutation := `
		mutation UpdateRun($id: String!, $updates: RunUpdates!) {
			updateRun(id: $id, updates: $updates)
		}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdateRun",
		Variables: map[string]interface{}{
			"id":      playbookRunID,
			"updates": updates,
		},
	}, &response)

	return response, err
}

func UpdateRunTaskActions(c *client.Client, playbookRunID string, checklistNum float64, itemNum float64, taskActions *[]app.TaskAction) (graphql.Response, error) {
	mutation := `
		mutation UpdateRunTaskActions($runID: String!, $checklistNum: Float!, $itemNum: Float!, $taskActions: [TaskActionUpdates!]!) {
			updateRunTaskActions(runID: $runID, checklistNum: $checklistNum, itemNum: $itemNum, taskActions: $taskActions)
		}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdateRunTaskActions",
		Variables: map[string]interface{}{
			"runID":        playbookRunID,
			"checklistNum": checklistNum,
			"itemNum":      itemNum,
			"taskActions":  taskActions,
		},
	}, &response)

	return response, err
}
