// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package flow

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-plugin-api/experimental/common"
	"github.com/mattermost/mattermost-plugin-api/experimental/flow/steps"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
)

type fh struct {
	fc Controller
}

func Init(r *mux.Router, fc Controller) {
	fh := &fh{
		fc: fc,
	}

	flowRouter := r.PathPrefix("/").Subrouter()
	flowRouter.HandleFunc(fc.GetFlow().URL(), fh.handleFlow).Methods(http.MethodPost)
}

func (fh *fh) handleFlow(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		common.SlackAttachmentError(w, "Error: Not authorized")
		return
	}

	request := model.PostActionIntegrationRequestFromJson(r.Body)
	if request == nil {
		common.SlackAttachmentError(w, "Error: invalid request")
		return
	}

	rawStep, ok := request.Context[steps.ContextStepKey].(string)
	if !ok {
		common.SlackAttachmentError(w, "Error: missing step number")
		return
	}

	var stepNumber int
	err := json.Unmarshal([]byte(rawStep), &stepNumber)
	if err != nil {
		common.SlackAttachmentError(w, "Error: cannot parse step number")
	}

	step := fh.fc.GetFlow().Step(stepNumber)
	if step == nil {
		common.SlackAttachmentError(w, fmt.Sprintf("Error: There is no step %d.", step))
		return
	}

	property, ok := request.Context[steps.ContextPropertyKey].(string)
	if !ok {
		common.SlackAttachmentError(w, "Error: missing property name")
		return
	}

	value, ok := request.Context[steps.ContextButtonValueKey]
	if !ok {
		common.SlackAttachmentError(w, "Error: missing value")
		return
	}

	err = fh.fc.SetProperty(userID, property, value)
	if err != nil {
		common.SlackAttachmentError(w, "There has been a problem setting the property, err="+err.Error())
		return
	}

	response := model.PostActionIntegrationResponse{}
	post := model.Post{}
	model.ParseSlackAttachment(&post, []*model.SlackAttachment{step.ResponseSlackAttachment(value)})
	response.Update = &post

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(response.ToJson())

	_ = fh.fc.NextStep(userID, stepNumber, value)
}
