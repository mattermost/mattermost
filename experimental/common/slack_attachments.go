package common

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func SlackAttachmentError(w http.ResponseWriter, errorMessage string) {
	response := model.PostActionIntegrationResponse{
		EphemeralText: errorMessage,
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(response.ToJson())
}
