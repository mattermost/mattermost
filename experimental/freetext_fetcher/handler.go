package freetext_fetcher

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-api/experimental/common"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	ContextActionKey  = "id"
	ContextMessageKey = "message"
	ContextPayloadKey = "payload"

	ContextNewMessage = "new_message"
	ContextNewPayload = "new_payload"

	CancelAction = "cancel"
)

func (ftf *freetextFetcher) initHandle(r *mux.Router) {
	freetextRouter := r.PathPrefix("/").Subrouter()
	freetextRouter.HandleFunc(ftf.URL(), ftf.handle).Methods(http.MethodPost)
	freetextRouter.HandleFunc(ftf.URL()+"/new", ftf.handleNew).Methods(http.MethodPost)
}

func (ftf *freetextFetcher) handle(w http.ResponseWriter, r *http.Request) {
	mattermostUserID := r.Header.Get("Mattermost-User-ID")
	if mattermostUserID == "" {
		common.SlackAttachmentError(w, "Error: Not authorized")
		return
	}

	request := model.PostActionIntegrationRequestFromJson(r.Body)
	if request == nil {
		common.SlackAttachmentError(w, "Error: invalid request")
		return
	}

	payload, ok := request.Context[ContextPayloadKey].(string)
	if !ok {
		common.SlackAttachmentError(w, "Error: cannot recover payload")
		return
	}

	message, ok := request.Context[ContextMessageKey].(string)
	if ok {
		ftf.onFetch(message, payload)
		writeConfirmResponse(w, fmt.Sprintf("Value set to `%s`.", message))
		return
	}

	action, ok := request.Context[ContextActionKey].(string)
	if !ok {
		ftf.store.StartFetching(mattermostUserID, ftf.id, payload)
		writeConfirmResponse(w, "Write your input.")
		return
	}

	if action == CancelAction {
		ftf.onCancel(payload)
		writeConfirmResponse(w, "Input cancelled.")
		return
	}

	common.SlackAttachmentError(w, "Error: cannot decode the context.")
}

func writeConfirmResponse(w http.ResponseWriter, message string) {
	response := model.PostActionIntegrationResponse{
		Update: &model.Post{
			Message: message,
			Props:   model.StringInterface{},
		},
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(response.ToJson())
}

func (ftf *freetextFetcher) handleNew(w http.ResponseWriter, r *http.Request) {
	mattermostUserID := r.Header.Get("Mattermost-User-ID")
	if mattermostUserID == "" {
		common.SlackAttachmentError(w, "Error: Not authorized")
		return
	}

	request := model.PostActionIntegrationRequestFromJson(r.Body)
	if request == nil {
		common.SlackAttachmentError(w, "Error: invalid request")
		return
	}

	message := request.Context[ContextNewMessage].(string)
	payload := request.Context[ContextNewPayload].(string)

	ftf.posterBot.DM(mattermostUserID, message)
	ftf.StartFetching(mattermostUserID, payload)

	response := model.PostActionIntegrationResponse{}
	w.Header().Set("Content-Type", "application/json")
	w.Write(response.ToJson())
}
