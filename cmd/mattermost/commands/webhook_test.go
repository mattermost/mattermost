package commands

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
)

func TestListWebhooks(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	// TODO: populate some Webhooks

	output := CheckCommand(t, "webhook", "list", th.BasicTeam.Name)

	if !strings.Contains(string(output), "TODO: correct string value here") {
		t.Fatal("should have webhooks")
	}
}
