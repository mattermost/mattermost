package pluginapi

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func newAppError() *model.AppError {
	return model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)
}

type testMutex struct {
}

func (m testMutex) Lock()   {}
func (m testMutex) Unlock() {}
