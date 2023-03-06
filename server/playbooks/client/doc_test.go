package client_test

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/model"
)

func Example() {
	ctx := context.Background()

	client4 := model.NewAPIv4Client("http://localhost:8065")
	_, _, err := client4.Login("test@example.com", "testtest")
	if err != nil {
		log.Fatal(err)
	}

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
