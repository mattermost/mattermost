package client_test

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/model"
)

func ExamplePlaybookRunService_Get() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	client4.Login("test@example.com", "testtest")

	c, err := client.New(client4)
	if err != nil {
		log.Fatal(err)
	}

	playbookRunID := "h4n3h7s1qjf5pkis4dn6cuxgwa"
	playbookRun, err := c.PlaybookRuns.Get(ctx, playbookRunID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Playbook Run Name: %s\n", playbookRun.Name)
}

func ExamplePlaybookRunService_List() {
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

	var playbookRuns []client.PlaybookRun
	for page := 0; ; page++ {
		result, err := c.PlaybookRuns.List(ctx, page, 100, client.PlaybookRunListOptions{
			TeamID:    teams[0].Id,
			Sort:      client.SortByCreateAt,
			Direction: client.SortDesc,
		})
		if err != nil {
			log.Fatal(err)
		}

		playbookRuns = append(playbookRuns, result.Items...)
		if !result.HasMore {
			break
		}
	}

	for _, playbookRun := range playbookRuns {
		fmt.Printf("Playbook Run Name: %s\n", playbookRun.Name)
	}
}
