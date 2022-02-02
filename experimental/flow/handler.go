// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package flow

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"

	"github.com/mattermost/mattermost-plugin-api/experimental/common"
	"github.com/mattermost/mattermost-plugin-api/experimental/flow/steps"
)

const (
	contextStepKey     = "step"
	contextButtonIDKey = "button_id"
)

type fh struct {
	fc *flowController
}

func initHandler(r *mux.Router, fc *flowController) {
	fh := &fh{
		fc: fc,
	}

	flowRouter := r.PathPrefix("/").Subrouter()
	flowRouter.HandleFunc(fc.GetFlow().Path()+"/button", fh.handleFlowButton).Methods(http.MethodPost)
	flowRouter.HandleFunc(fc.GetFlow().Path()+"/dialog", fh.handleFlowDialog).Methods(http.MethodPost)
}

func (fh *fh) handleFlowButton(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		common.SlackAttachmentError(w, errors.New("Not authorized"))
		return
	}

	var request model.PostActionIntegrationRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		common.SlackAttachmentError(w, errors.New("invalid request"))
		return
	}

	rawStep, ok := request.Context[contextStepKey].(string)
	if !ok {
		common.SlackAttachmentError(w, errors.New("missing step number"))
		return
	}

	var stepNumber int
	err := json.Unmarshal([]byte(rawStep), &stepNumber)
	if err != nil {
		common.SlackAttachmentError(w, errors.Wrap(err, "malformed step number"))
		return
	}

	step := fh.fc.GetFlow().Step(stepNumber)
	if step == nil {
		common.SlackAttachmentError(w, errors.New("there is no step"))
		return
	}

	rawButtonNumber, ok := request.Context[contextButtonIDKey].(string)
	if !ok {
		common.SlackAttachmentError(w, errors.New("missing button id"))
		return
	}

	var buttonNumber int
	err = json.Unmarshal([]byte(rawButtonNumber), &buttonNumber)
	if err != nil {
		common.SlackAttachmentError(w, errors.Wrap(err, "malformed button number"))
		return
	}

	actions := step.Attachment(fh.fc.pluginURL).Actions
	if buttonNumber > len(actions)-1 {
		common.SlackAttachmentError(w, errors.New("button number to high"))
		return
	}

	action := actions[buttonNumber]
	skip, attachment := action.OnClick(userID)

	response := model.PostActionIntegrationResponse{}
	post := &model.Post{}
	model.ParseSlackAttachment(post, []*model.SlackAttachment{fh.fc.toSlackAttachments(attachment, stepNumber)})
	response.Update = post

	if action.Dialog != nil {
		dialogRequest := model.OpenDialogRequest{
			TriggerId: request.TriggerId,
			URL:       fh.fc.getDialogHandlerURL(),
			Dialog:    action.Dialog.Dialog,
		}
		dialogRequest.Dialog.State = fmt.Sprintf("%v_%v", rawStep, buttonNumber)

		err = fh.fc.OpenInteractiveDialog(dialogRequest)
		if err != nil {
			fh.fc.Logger.WithError(err).Debugf("Failed to open interactive dialog")
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)

	err = fh.fc.NextStep(userID, stepNumber, skip)
	if err != nil {
		fh.fc.Logger.WithError(err).Debugf("To advance to next step")
	}
}

func (fh *fh) handleFlowDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		common.DialogError(w, errors.New("not authorized"))
		return
	}

	var request model.SubmitDialogRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		common.DialogError(w, errors.New("invalid request"))
		return
	}

	states := strings.Split(request.State, "_")
	if len(states) != 2 {
		common.DialogError(w, errors.New("invalid request"))
		return
	}

	stepNumber, err := strconv.Atoi(states[0])
	if err != nil {
		common.DialogError(w, errors.Wrap(err, "malformed step number"))
		return
	}

	step := fh.fc.GetFlow().Step(stepNumber)
	if step == nil {
		common.DialogError(w, errors.New("there is no step"))
		return
	}

	buttonNumber, err := strconv.Atoi(states[1])
	if err != nil {
		common.DialogError(w, errors.Wrap(err, "malformed button number"))
		return
	}

	actions := step.Attachment(fh.fc.pluginURL).Actions
	if buttonNumber > len(actions)-1 {
		common.DialogError(w, errors.New("button number to high"))
		return
	}

	action := actions[buttonNumber]

	var (
		skip          int
		attachment    *steps.Attachment
		resposeError  string
		resposeErrors map[string]string
	)

	if request.Cancelled {
		skip, attachment = action.Dialog.OnCancel(userID)
	} else {
		skip, attachment, resposeError, resposeErrors = action.Dialog.OnDialogSubmit(userID, request.Submission)
	}

	response := model.SubmitDialogResponse{
		Error:  resposeError,
		Errors: resposeErrors,
	}

	if attachment != nil {
		var postID string
		postID, err = fh.fc.getPostID(userID, step)
		if err != nil {
			common.DialogError(w, errors.Wrap(err, "Failed to get post"))
			return
		}

		post := &model.Post{
			Id: postID,
		}

		model.ParseSlackAttachment(post, []*model.SlackAttachment{fh.fc.toSlackAttachments(*attachment, stepNumber)})
		err = fh.fc.UpdatePost(post)
		if err != nil {
			common.DialogError(w, errors.Wrap(err, "Failed to update post"))
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)

	if resposeError == "" && resposeErrors == nil {
		err = fh.fc.NextStep(userID, stepNumber, skip)
		if err != nil {
			fh.fc.Logger.WithError(err).Debugf("To advance to next step")
		}
	}
}
