package flow

import (
	"encoding/json"
	"fmt"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/model"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
	"github.com/mattermost/mattermost-plugin-api/experimental/flow/steps"
)

type DialogCreater interface {
	OpenInteractiveDialog(dialog model.OpenDialogRequest) error
}

type Controller interface {
	Start(userID string) error
	NextStep(userID string, from int, skip int) error
	GetCurrentStep(userID string) (steps.Step, int, error)
	GetFlow() Flow
	Cancel(userID string) error
}

type flowController struct {
	logger.Logger
	poster.Poster
	DialogCreater
	flow      Flow
	store     Store
	pluginURL string
}

func NewFlowController(
	l logger.Logger,
	r *mux.Router,
	p poster.Poster,
	d DialogCreater,
	pluginURL string,
	flow Flow,
	flowStore Store,
) Controller {
	fc := &flowController{
		Poster:        p,
		Logger:        l,
		DialogCreater: d,
		flow:          flow,
		store:         flowStore,
		pluginURL:     pluginURL,
	}

	initHandler(r, fc)

	return fc
}

func (fc *flowController) GetFlow() Flow {
	return fc.flow
}

func (fc *flowController) Start(userID string) error {
	err := fc.setFlowStep(userID, 1)
	if err != nil {
		return err
	}
	return fc.processStep(userID, 1)
}

func (fc *flowController) NextStep(userID string, from, skip int) error {
	stepIndex, err := fc.getFlowStep(userID)
	if err != nil {
		return err
	}

	if stepIndex != from {
		// We are beyond the step we were supposed to come from, so we understand this step has already been processed.
		// Used to avoid rapid firing on the Slack Attachments.
		return nil
	}

	if skip == -1 {
		// Stay at the current step
		return nil
	}

	step := fc.flow.Step(stepIndex)

	err = fc.removePostID(userID, step)
	if err != nil {
		fc.Logger.WithError(err).Debugf("error removing post id")
	}

	stepIndex += 1 + skip
	if stepIndex > fc.flow.Length() {
		_ = fc.removeFlowStep(userID)
		fc.flow.FlowDone(userID)
		return nil
	}

	err = fc.setFlowStep(userID, stepIndex)
	if err != nil {
		return err
	}

	return fc.processStep(userID, stepIndex)
}

func (fc *flowController) GetCurrentStep(userID string) (steps.Step, int, error) {
	index, err := fc.getFlowStep(userID)
	if err != nil {
		return nil, 0, err
	}

	if index == 0 {
		return nil, 0, nil
	}

	step := fc.flow.Step(index)
	if step == nil {
		return nil, 0, fmt.Errorf("step %d not found", index)
	}

	return step, index, nil
}

func (fc *flowController) getButtonHandlerURL() string {
	return fc.pluginURL + fc.flow.Path() + "/button"
}

func (fc *flowController) getDialogHandlerURL() string {
	return fc.pluginURL + fc.flow.Path() + "/dialog"
}

func (fc *flowController) toSlackAttachments(attachment steps.Attachment, stepNumber int) *model.SlackAttachment {
	stepValue, _ := json.Marshal(stepNumber)

	updatedActions := make([]steps.Action, len(attachment.Actions))
	for i := 0; i < len(attachment.Actions); i++ {
		buttonNumber, _ := json.Marshal(i)

		updatedAction := attachment.Actions[i]

		updatedAction.Integration = &model.PostActionIntegration{
			URL: fc.getButtonHandlerURL(),
			Context: map[string]interface{}{
				contextStepKey:     string(stepValue),
				contextButtonIDKey: string(buttonNumber),
			},
		}

		updatedActions[i] = updatedAction
	}

	attachment.Actions = updatedActions

	return attachment.ToSlackAttachment()
}

func (fc *flowController) Cancel(userID string) error {
	stepIndex, err := fc.getFlowStep(userID)
	if err != nil {
		return err
	}

	step := fc.flow.Step(stepIndex)
	if step == nil {
		return nil
	}

	postID, err := fc.getPostID(userID, step)
	if err != nil {
		return err
	}

	err = fc.DeletePost(postID)
	if err != nil {
		return err
	}

	return nil
}

func (fc *flowController) setFlowStep(userID string, step int) error {
	return fc.store.SetCurrentStep(userID, fc.flow.Name(), step)
}

func (fc *flowController) getFlowStep(userID string) (int, error) {
	return fc.store.GetCurrentStep(userID, fc.flow.Name())
}

func (fc *flowController) removeFlowStep(userID string) error {
	return fc.store.DeleteCurrentStep(userID, fc.flow.Name())
}

func (fc *flowController) getPostID(userID string, step steps.Step) (string, error) {
	return fc.store.GetPostID(userID, fc.flow.Name(), step.Name())
}

func (fc *flowController) setPostID(userID string, step steps.Step, postID string) error {
	return fc.store.SetPostID(userID, fc.flow.Name(), step.Name(), postID)
}

func (fc *flowController) removePostID(userID string, step steps.Step) error {
	return fc.store.RemovePostID(userID, fc.flow.Name(), step.Name())
}

func (fc *flowController) processStep(userID string, i int) error {
	step := fc.flow.Step(i)
	if step == nil {
		fc.Errorf("Step nil")
	}

	if fc.flow == nil {
		fc.Errorf("Flow nil")
	}

	if fc.store == nil {
		fc.Errorf("Store nil")
	}

	attachements := fc.toSlackAttachments(step.Attachment(fc.pluginURL), i)
	postID, err := fc.DMWithAttachments(userID, attachements)
	if err != nil {
		return err
	}

	if step.IsEmpty() {
		return fc.NextStep(userID, i, 0)
	}

	err = fc.setPostID(userID, step, postID)
	if err != nil {
		return err
	}

	return nil
}
