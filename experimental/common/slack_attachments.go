package common

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func SlackAttachmentError(w http.ResponseWriter, errorMessage string) {
	response := model.PostActionIntegrationResponse{
		EphemeralText: errorMessage,
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}
