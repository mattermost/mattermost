// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/graphql"
)

// gqlRunsOnTeam runs the RunsOnTeam GraphQL query, returning a list of
// [graphql.RunEdge] objects, which contains the channel and team IDs for each
// run in the team.
func gqlRunsOnTeam(pbClient *client.Client, teamID string) ([]graphql.RunEdge, error) {
	query := `query RunsOnTeam(
		$participant: String!,
		$teamID: String!,
		$status: String!
	) {
		runs(
			teamID: $teamID
			statuses: [$status]
			participantOrFollowerID: $participant
		) {
			edges {
				node {
					channel_id: channelID
					team_id: teamID
				}
			}
		}
	}`

	var resp struct {
		Data struct {
			Runs []graphql.RunEdge
		}
	}
	graphqlInput := &client.GraphQLInput{
		Query:         query,
		OperationName: "RunsOnTeam",
		Variables: map[string]any{
			"participant": "me",
			"teamID":      teamID,
			"status":      client.StatusInProgress,
		},
	}

	if err := pbClient.DoGraphql(context.Background(), graphqlInput, &resp); err != nil {
		return nil, err
	}

	return resp.Data.Runs, nil
}

// gqlRHSRuns runs the RHSRuns GraphQL query, returning a
// [graphql.RunConnection] object, that contains the list of runs in the
// provided channel.
func gqlRHSRuns(pbClient *client.Client, channelID string, sort client.Sort, direction client.SortDirection, status client.Status, first int, after string) (graphql.RunConnection, error) {
	query := `query RHSRuns(
        $channelID: String!,
        $sort: String!,
        $direction: String!,
        $status: String!,
        $first: Int,
        $after: String,
    ) {
        runs(
            channelID: $channelID
            sort: $sort
            direction: $direction
            statuses: [$status]
            first: $first
            after: $after
        ) {
            totalCount
            edges {
                node {
                    id
                    name
                    participantIDs
                    ownerUserID
                    playbookID
                    playbook {
                        title
                    }
                    numTasksClosed
                    numTasks
                    lastUpdatedAt
                    type
                    currentStatus
                    channelID
                    teamID
                    propertyFields {
                        id
                        name
                        type
                        attrs {
                            sort_order: sortOrder
                            options {
                                id
                                name
                                color
                            }
                            parent_id: parentID
                        }
                    }
                }
            }
            pageInfo {
                endCursor
                hasNextPage
            }
        }
    }`

	var resp struct {
		Data struct {
			Runs graphql.RunConnection
		}
	}
	params := map[string]any{
		"channelID": channelID,
		"sort":      string(sort),
		"direction": string(direction),
		"status":    string(status),
		"first":     first,
	}
	// Only add the parameter if non-empty
	if after != "" {
		params["after"] = after
	}

	graphqlInput := &client.GraphQLInput{
		Query:         query,
		OperationName: "RHSRuns",
		Variables:     params,
	}
	if err := pbClient.DoGraphql(context.Background(), graphqlInput, &resp); err != nil {
		return graphql.RunConnection{}, err
	}

	return resp.Data.Runs, nil
}
