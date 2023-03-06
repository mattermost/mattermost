package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/api"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLPlaybooks(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("basic get", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbook struct {
					ID    string
					Title string
				}
			}
		}
		testPlaybookQuery := `
			query Playbook($id: String!) {
				playbook(id: $id) {
					id
					title
				}
			}
			`
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbook",
			Variables:     map[string]interface{}{"id": e.BasicPlaybook.ID},
		}, &pbResultTest)
		require.NoError(t, err)

		assert.Equal(t, e.BasicPlaybook.ID, pbResultTest.Data.Playbook.ID)
		assert.Equal(t, e.BasicPlaybook.Title, pbResultTest.Data.Playbook.Title)
	})

	t.Run("list", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbooks []struct {
					ID    string
					Title string
				}
			}
		}
		testPlaybookQuery := `
			query Playbooks {
				playbooks {
					id
					title
				}
			}
			`
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbooks",
		}, &pbResultTest)
		require.NoError(t, err)

		assert.Len(t, pbResultTest.Data.Playbooks, 3)
	})

	t.Run("playbook mutate", func(t *testing.T) {
		newUpdatedTitle := "graphqlmutatetitle"

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"title": newUpdatedTitle})
		require.NoError(t, err)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Equal(t, newUpdatedTitle, updatedPlaybook.Title)
	})

	t.Run("update playbook no permissions to broadcast", func(t *testing.T) {
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"broadcastChannelIDs": []string{e.BasicPrivateChannel.Id}})
		require.Error(t, err)
	})

	t.Run("update playbook without modifying broadcast channel ids without permission. should succeed because no modification.", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"description": "unrelatedupdate"})
		require.NoError(t, err)
	})

	t.Run("update playbook with too many webhoooks", func(t *testing.T) {
		urls := []string{}
		for i := 0; i < 65; i++ {
			urls = append(urls, "http://localhost/"+strconv.Itoa(i))
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"webhookOnCreationEnabled": true,
			"webhookOnCreationURLs":    urls,
		})
		require.Error(t, err)
	})

	t.Run("change default owner", func(t *testing.T) {
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"defaultOwnerID": e.RegularUser.Id,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"defaultOwnerID": e.RegularUserNotInTeam.Id,
		})
		require.Error(t, err)
	})
	t.Run("checklist with preset values that need to be cleared", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       "",
				"assigneeModified": 101,
				"state":            "Closed",
				"stateModified":    102,
				"command":          "",
				"commandLastRun":   103,
				"lastSkipped":      104,
				"dueDate":          100,
			},
		}

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
		})

		require.NoError(t, err)

		actual := []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:            "title1",
						Description:      "description1",
						AssigneeID:       "",
						AssigneeModified: 0,
						State:            "",
						StateModified:    0,
						Command:          "",
						CommandLastRun:   0,
						LastSkipped:      0,
						DueDate:          100,
					},
				},
			},
		}
		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Equal(t, updatedPlaybook.Checklists, actual)
	})

	t.Run("update playbook with pre-assigned task, valid invite user list, and invitations enabled", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)
	})

}
func TestGraphQLUpdatePlaybookFails(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update playbook fails because size constraints.", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": []api.UpdateChecklist{
				{
					Title: strings.Repeat("A", (256*1024)+1),
					Items: []api.UpdateChecklistItem{},
				},
			},
		})
		require.Error(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"title": strings.Repeat("A", 1025)})
		require.Error(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"description": strings.Repeat("A", 4097)})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to disabled invitations", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs": []string{e.RegularUser.Id},
		})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to missing assignee in existing invite user list", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"inviteUsersEnabled": true,
		})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to assignee missing in new invite user list", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser2.Id},
			"inviteUsersEnabled": true,
		})
		require.Error(t, err)
	})

	t.Run("update playbook with invite user list fails due to missing a pre-assignee", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"invitedUserIDs": []string{e.RegularUser2.Id},
		})
		require.Error(t, err)
	})

	t.Run("update playbook fails if invitations are getting disabled but there are pre-assigned users", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"inviteUsersEnabled": false,
		})
		require.Error(t, err)
	})
}

func TestUpdatePlaybookFavorite(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("favorite", func(t *testing.T) {
		isFavorite, err := getPlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.False(t, isFavorite)

		response, err := updatePlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID, true)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err = getPlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)
	})

	t.Run("unfavorite", func(t *testing.T) {
		response, err := updatePlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID, false)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err := getPlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.False(t, isFavorite)
	})

	t.Run("favorite playbook with read access", func(t *testing.T) {
		response, err := updatePlaybookFavorite(e.PlaybooksClient2, e.BasicPlaybook.ID, true)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err := getPlaybookFavorite(e.PlaybooksClient2, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)
	})

	t.Run("favorite private playbook no access", func(t *testing.T) {
		response, _ := updatePlaybookFavorite(e.PlaybooksClient, e.PrivatePlaybookNoMembers.ID, false)
		require.NotEmpty(t, response.Errors)
	})
}

func updatePlaybookFavorite(c *client.Client, playbookID string, favorite bool) (graphql.Response, error) {
	mutation := `mutation UpdatePlaybookFavorite($id: String!, $favorite: Boolean!) {
		updatePlaybookFavorite(id: $id, favorite: $favorite)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdatePlaybookFavorite",
		Variables: map[string]interface{}{
			"id":       playbookID,
			"favorite": favorite,
		},
	}, &response)

	return response, err
}

func getPlaybookFavorite(c *client.Client, playbookID string) (bool, error) {
	query := `
	query GetPlaybookFavorite($id: String!) {
		playbook(id: $id) {
			isFavorite
		}
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         query,
		OperationName: "GetPlaybookFavorite",
		Variables: map[string]interface{}{
			"id": playbookID,
		},
	}, &response)

	if err != nil {
		return false, err
	}
	if len(response.Errors) > 0 {
		return false, fmt.Errorf("error from query %v", response.Errors)
	}

	favoriteResponse := struct {
		Playbook struct {
			IsFavorite bool `json:"isFavorite"`
		} `json:"playbook"`
	}{}
	err = json.Unmarshal(response.Data, &favoriteResponse)
	if err != nil {
		return false, err
	}
	return favoriteResponse.Playbook.IsFavorite, nil
}

func gqlTestPlaybookUpdate(e *TestEnvironment, t *testing.T, playbookID string, updates map[string]interface{}) error {
	testPlaybookMutateQuery := `
	mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
	updatePlaybook(id: $id, updates: $updates)
	}
		`
	var response graphql.Response
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testPlaybookMutateQuery,
		OperationName: "UpdatePlaybook",
		Variables:     map[string]interface{}{"id": playbookID, "updates": updates},
	}, &response)

	if err != nil {
		return errors.Wrapf(err, "gqlTestPlaybookUpdate graphql failure")
	}

	if len(response.Errors) != 0 {
		return errors.Errorf("gqlTestPlaybookUpdate graphql failure %+v", response.Errors)
	}

	return err
}

func TestGraphQLPlaybooksMetrics(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("metrics get", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbook struct {
					ID      string
					Title   string
					Metrics []client.PlaybookMetricConfig
				}
			}
		}
		testPlaybookQuery :=
			`
	query Playbook($id: String!) {
		playbook(id: $id) {
			id
			metrics {
				id
				title
				description
				type
				target
			}
		}
	}
	`
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbook",
			Variables:     map[string]interface{}{"id": e.BasicPlaybook.ID},
		}, &pbResultTest)
		require.NoError(t, err)

		require.Len(t, pbResultTest.Data.Playbook.Metrics, len(e.BasicPlaybook.Metrics))
		require.Equal(t, e.BasicPlaybook.Metrics[0].Title, pbResultTest.Data.Playbook.Metrics[0].Title)
		require.Equal(t, e.BasicPlaybook.Metrics[0].Type, pbResultTest.Data.Playbook.Metrics[0].Type)
		require.Equal(t, e.BasicPlaybook.Metrics[0].Target, pbResultTest.Data.Playbook.Metrics[0].Target)
	})

	t.Run("add metric", func(t *testing.T) {
		testAddMetricQuery := `
		mutation AddMetric($playbookID: String!, $title: String!, $description: String!, $type: String!, $target: Int) {
			addMetric(playbookID: $playbookID, title: $title, description: $description, type: $type, target: $target)
		}
		`
		var response graphql.Response
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testAddMetricQuery,
			OperationName: "AddMetric",
			Variables: map[string]interface{}{
				"playbookID":  e.BasicPlaybook.ID,
				"title":       "New Metric",
				"description": "the description",
				"type":        app.MetricTypeDuration,
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Len(t, updatedPlaybook.Metrics, 2)
		assert.Equal(t, updatedPlaybook.Metrics[1].Title, "New Metric")
	})

	t.Run("update metric", func(t *testing.T) {
		testUpdateMetricQuery := `
		mutation UpdateMetric($id: String!, $title: String, $description: String, $target: Int) {
			updateMetric(id: $id, title: $title, description: $description, target: $target)
		}
		`

		var response graphql.Response
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdateMetricQuery,
			OperationName: "UpdateMetric",
			Variables: map[string]interface{}{
				"id":    e.BasicPlaybook.Metrics[0].ID,
				"title": "Updated Title",
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Len(t, updatedPlaybook.Metrics, 2)
		assert.Equal(t, "Updated Title", updatedPlaybook.Metrics[0].Title)
	})

	t.Run("delete metric", func(t *testing.T) {
		testDeleteMetricQuery := `
		mutation DeleteMetric($id: String!) {
			deleteMetric(id: $id)
		}
		`
		var response graphql.Response
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testDeleteMetricQuery,
			OperationName: "DeleteMetric",
			Variables: map[string]interface{}{
				"id": e.BasicPlaybook.Metrics[0].ID,
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Len(t, updatedPlaybook.Metrics, 1)
	})
}
