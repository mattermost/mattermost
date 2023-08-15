// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package flow

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi/experimental/common"
)

func (f *Flow) handleButtonHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		common.SlackAttachmentError(w, errors.New("Not authorized"))
		return
	}
	f = f.ForUser(userID)

	var request model.PostActionIntegrationRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		common.SlackAttachmentError(w, errors.New("invalid request"))
		return
	}

	// selectedButton is 1-based
	fromName, selectedButton, err := buttonContext(&request)
	if err != nil {
		common.SlackAttachmentError(w, err)
		return
	}

	donePost, err := f.handleButton(fromName, selectedButton, request.TriggerId)
	if err != nil {
		common.SlackAttachmentError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(model.PostActionIntegrationResponse{
		Update: donePost,
	})
}

func (f *Flow) handleDialogHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		common.DialogError(w, errors.New("not authorized"))
		return
	}
	f = f.ForUser(userID)

	var request model.SubmitDialogRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		common.DialogError(w, errors.New("invalid request"))
		return
	}
	fromName, selectedButton, err := dialogContext(&request)
	if err != nil {
		common.DialogError(w, errors.Wrap(err, "invalid request"))
		return
	}

	// handleDialog updates the post
	donePost, fieldErrors, err := f.handleDialog(fromName, selectedButton, request.Submission)
	if err != nil || len(fieldErrors) != 0 {
		w.Header().Set("Content-Type", "application/json")

		resp := model.SubmitDialogResponse{
			Errors: fieldErrors,
		}

		if err != nil {
			resp.Error = err.Error()
		}

		_ = json.NewEncoder(w).Encode(resp)
		return
	}
	err = f.api.Post.UpdatePost(donePost)
	if err != nil {
		common.DialogError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(model.SubmitDialogResponse{})
}

func (f *Flow) handleButton(fromName Name, selectedButton int, triggerID string) (*model.Post, error) {
	post, _, err := f.handle(fromName, selectedButton, nil, triggerID, true)
	return post, err
}

func (f *Flow) handleDialog(
	fromName Name, selectedButton int, submission map[string]interface{},
) (
	*model.Post, map[string]string, error,
) {
	return f.handle(fromName, selectedButton, submission, "", false)
}

func (f *Flow) handle(
	fromName Name, selectedButton int, submission map[string]interface{}, triggerID string, asButton bool,
) (
	*model.Post, map[string]string, error,
) {
	state, err := f.getState()
	if err != nil {
		return nil, nil, err
	}
	if state.StepName != fromName {
		return nil, nil, errors.Errorf("click from an inactive step: %v", fromName)
	}
	from, ok := f.steps[fromName]
	if !ok {
		return nil, nil, errors.Errorf("step %q not found", fromName)
	}

	if selectedButton == 0 || selectedButton > len(from.buttons) {
		return nil, nil, errors.Errorf("button number %v to high or too low, only %v buttons", selectedButton, len(from.buttons))
	}
	b := from.buttons[selectedButton-1]

	var updated State
	toName := fromName
	var fieldErrors map[string]string
	if asButton {
		if b.OnClick != nil {
			toName, updated, err = b.OnClick(f)
		}
	} else {
		if b.OnDialogSubmit != nil {
			toName, updated, fieldErrors, err = b.OnDialogSubmit(f, submission)
		}
	}
	if err != nil || len(fieldErrors) > 0 {
		return nil, fieldErrors, err
	}
	state.AppState = state.AppState.MergeWith(updated)
	state.Done = true
	err = f.storeState(state)
	if err != nil {
		return nil, nil, err
	}

	// Empty next step name in the response indicates advancing to the next step
	// in the flow. To stay on the same step the handlers should return the step
	// name.
	if toName == "" {
		toName = f.next(fromName)
	}

	if asButton && b.Dialog != nil {
		if b.OnDialogSubmit == nil {
			return nil, nil, errors.Errorf("no submit function for dialog, step: %s", fromName)
		}

		dialogRequest := model.OpenDialogRequest{
			TriggerId: triggerID,
			URL:       f.pluginURL + namePath(f.name) + "/dialog",
			Dialog:    processDialog(b.Dialog, state.AppState),
		}
		dialogRequest.Dialog.State = fmt.Sprintf("%v,%v", fromName, selectedButton)

		err = f.api.Frontend.OpenInteractiveDialog(dialogRequest)
		if err != nil {
			return nil, nil, err
		}
	}

	if toName == fromName {
		// Nothing else to do
		return nil, nil, nil
	}

	donePost, err := from.done(f, selectedButton)
	if err != nil {
		return nil, nil, err
	}
	donePost.Id = state.PostID
	f.processButtonPostActions(donePost)

	err = f.Go(toName)
	if err != nil {
		f.api.Log.Warn("failed to advance flow to next step", "flow_name", f.name, "from", fromName, "to", toName, "error", err.Error())
	}

	// return the "done" post for the from step - leave updating up to the
	// API-specific caller.
	return donePost, nil, nil
}

func (f *Flow) processButtonPostActions(post *model.Post) {
	attachments, ok := post.GetProp("attachments").([]*model.SlackAttachment)
	if !ok || len(attachments) == 0 {
		return
	}
	sa := attachments[0]
	for _, a := range sa.Actions {
		if a.Integration == nil {
			a.Integration = &model.PostActionIntegration{}
		}
		a.Integration.URL = f.pluginURL + namePath(f.name) + "/button"
	}
}
