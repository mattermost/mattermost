package common

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func SlackAttachmentError(w http.ResponseWriter, err error) {
	response := model.PostActionIntegrationResponse{
		EphemeralText: "Error:" + err.Error(),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func DialogError(w http.ResponseWriter, err error) {
	response := model.SubmitDialogResponse{
		Error: err.Error(),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}
