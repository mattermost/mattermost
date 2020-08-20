package freetextfetcher

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-plugin-api/experimental/common"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// ContextActionKey defines the key used in the context to store the action ID
	ContextActionKey = "id"
	// ContextMessageKey defines the key used in the context to store the message
	ContextMessageKey = "message"
	// ContextPayloadKey defines the key used in the context to store the payload
	ContextPayloadKey = "payload"

	// ContextNewMessage defines the key used in the context to store the new message
	ContextNewMessage = "new_message"
	// ContextNewPayload defines the key used in the context to store the new payload
	ContextNewPayload = "new_payload"

	// CancelAction codifies the action to cancel the freetext fetching
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
		_ = ftf.store.StartFetching(mattermostUserID, ftf.id, payload)
		writeConfirmResponse(w, "Write your input.")
		return
	}

	if action == CancelAction {
		ftf.onCancel(payload)
		writeConfirmResponse(w, "Input canceled.")
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
	_, _ = w.Write(response.ToJson())
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

	_, _ = ftf.poster.DM(mattermostUserID, message)
	ftf.StartFetching(mattermostUserID, payload)

	response := model.PostActionIntegrationResponse{}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(response.ToJson())
}
