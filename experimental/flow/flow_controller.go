package flow

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
	"github.com/mattermost/mattermost-plugin-api/experimental/flow/steps"
)

type FlowController interface {
	Start(userID string) error
	NextStep(userID string, from int, value interface{}) error
	GetCurrentStep(userID string) (steps.Step, int, error)
	GetHandlerURL() string
	GetFlow() Flow
	Cancel(userID string) error
	SetProperty(userID, propertyName string, value interface{}) error
}

type flowController struct {
	poster.Poster
	logger.Logger
	flow          Flow
	store         FlowStore
	propertyStore PropertyStore
	pluginURL     string
}

func NewFlowController(p poster.Poster, l logger.Logger, pluginURL string, flow Flow, flowStore FlowStore, propertyStore PropertyStore) FlowController {
	fc := &flowController{
		Poster:        p,
		Logger:        l,
		flow:          flow,
		store:         flowStore,
		propertyStore: propertyStore,
		pluginURL:     pluginURL,
	}

	for _, step := range flow.Steps() {
		ftf := step.GetFreetextFetcher()
		if ftf != nil {
			ftf.UpdateHooks(nil,
				fc.ftOnFetch,
				fc.ftOnCancel,
			)
		}
	}

	return fc
}

func (fc *flowController) GetFlow() Flow {
	return fc.flow
}

func (fc *flowController) SetProperty(userID, propertyName string, value interface{}) error {
	return fc.propertyStore.SetProperty(userID, propertyName, value)
}

func (fc *flowController) Start(userID string) error {
	err := fc.setFlowStep(userID, 1)
	if err != nil {
		return err
	}
	return fc.processStep(userID, 1)
}

func (fc *flowController) NextStep(userID string, from int, value interface{}) error {
	stepIndex, err := fc.getFlowStep(userID)
	if err != nil {
		return err
	}

	if stepIndex != from {
		// We are beyond the step we were supposed to come from, so we understand this step has already been processed.
		// Used to avoid rapid firing on the Slack Attachments.
		return nil
	}

	step := fc.flow.Step(stepIndex)

	err = fc.store.RemovePostID(userID, step.GetPropertyName())
	if err != nil {
		fc.Logger.Debugf("error removing post id, %s", err.Error())
	}

	skip := step.ShouldSkip(value)
	stepIndex += 1 + skip
	if stepIndex > fc.flow.Length() {
		fc.removeFlowStep(userID)
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

func (fc *flowController) GetHandlerURL() string {
	return fc.pluginURL + fc.flow.URL()
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

	postID, err := fc.store.GetPostID(userID, step.GetPropertyName())
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
	return fc.store.SetCurrentStep(userID, step)
}

func (fc *flowController) getFlowStep(userID string) (int, error) {
	return fc.store.GetCurrentStep(userID)
}

func (fc *flowController) removeFlowStep(userID string) error {
	return fc.store.DeleteCurrentStep(userID)
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

	postID, err := fc.DMWithAttachments(userID, step.PostSlackAttachment(fc.GetHandlerURL(), i))
	if err != nil {
		return err
	}

	if step.IsEmpty() {
		return fc.NextStep(userID, i, false)
	}

	err = fc.store.SetPostID(userID, step.GetPropertyName(), postID)
	if err != nil {
		return err
	}

	ftf := step.GetFreetextFetcher()
	if ftf == nil {
		return nil
	}

	payload, err := json.Marshal(freetextInfo{
		Step:     i,
		UserID:   userID,
		Property: step.GetPropertyName(),
	})
	if err != nil {
		return err
	}
	ftf.StartFetching(userID, string(payload))
	return nil
}
