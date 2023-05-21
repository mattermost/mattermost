// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client_test

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/client"
)

func ExamplePlaybooksService_Get() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	client4.Login("test@example.com", "testtest")

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	playbookID := "h4n3h7s1qjf5pkis4dn6cuxgwa"
	playbook, err := c.Playbooks.Get(ctx, playbookID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Playbook Name: %s\n", playbook.Title)
}

func ExamplePlaybooksService_List() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	_, _, err := client4.Login("test@example.com", "testtest")
	if err != nil {
		log.Fatal(err.Error())
	}

	teams, _, err := client4.GetAllTeams("", 0, 1)
	if err != nil {
		log.Fatal(err.Error())
	}
	if len(teams) == 0 {
		log.Fatal("no teams for this user")
	}

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	var playbooks []client.Playbook
	for page := 0; ; page++ {
		result, err := c.Playbooks.List(ctx, teams[0].Id, page, 100, client.PlaybookListOptions{
			Sort:      client.SortByCreateAt,
			Direction: client.SortDesc,
		})
		if err != nil {
			log.Fatal(err)
		}

		playbooks = append(playbooks, result.Items...)
		if !result.HasMore {
			break
		}
	}

	for _, playbook := range playbooks {
		fmt.Printf("Playbook Name: %s\n", playbook.Title)
	}
}
