package orphaned_rows

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
)

const (
	jobName        = "OrphanedRows"
	schedFrequency = 24 * time.Hour
)

type Scheduler struct {
	app *app.App
}
