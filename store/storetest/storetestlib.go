package storetest

import (
	"github.com/mattermost/mattermost-server/model"
)

func MakeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
}
