package flow

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

type Name string

const (
	contextStepKey   = "step"
	contextButtonKey = "button"
)

type Flow struct {
	UserID string
	state  *flowState

	name      Name
	api       *pluginapi.Client
	pluginURL string
	botUserID string

	steps map[Name]Step
	index []Name
	done  func(userID string, state State) error

	debugLogState bool
}

// NewFlow creates a new flow using direct messages with the user.
//
// name must be a unique identifier for the flow within the plugin.
func NewFlow(name Name, api *pluginapi.Client, pluginURL, botUserID string) *Flow {
	return &Flow{
		name:      name,
		api:       api,
		pluginURL: pluginURL,
		botUserID: botUserID,
		steps:     map[Name]Step{},
	}
}

func (f *Flow) WithSteps(orderedSteps ...Step) *Flow {
	if f.steps == nil {
		f.steps = map[Name]Step{}
	}
	for _, step := range orderedSteps {
		stepName := step.name
		if _, ok := f.steps[stepName]; ok {
			f.api.Log.Warn("ignored duplicate step name", "name", stepName, "flow", f.name)
			continue
		}
		f.steps[stepName] = step
		f.index = append(f.index, stepName)
	}
	return f
}

func (f *Flow) OnDone(done func(string, State) error) *Flow {
	f.done = done
	return f
}

func (f *Flow) InitHTTP(r *mux.Router) *Flow {
	flowRouter := r.PathPrefix("/").Subrouter()
	flowRouter.HandleFunc(namePath(f.name)+"/button", f.handleButtonHTTP).Methods(http.MethodPost)
	flowRouter.HandleFunc(namePath(f.name)+"/dialog", f.handleDialogHTTP).Methods(http.MethodPost)
	return f
}

func (f *Flow) WithDebugLog() *Flow {
	f.debugLogState = true
	return f
}

// ForUser creates a new flow using direct messages with the user.
func (f *Flow) ForUser(userID string) *Flow {
	clone := *f
	clone.UserID = userID
	clone.state = nil
	return &clone
}

func (f *Flow) GetCurrentStep() (Name, error) {
	state, err := f.getState()
	if err != nil {
		// Don't return an error if no flow is running
		if errors.Is(err, errStateNotFound) {
			return "", nil
		}

		return "", err
	}

	return state.StepName, err
}

func (f *Flow) GetState() State {
	state, _ := f.getState()
	return state.AppState
}

func (f *Flow) Start(appState State) error {
	if len(f.index) == 0 {
		return errors.New("no steps")
	}

	err := f.storeState(flowState{
		AppState: appState,
	})
	if err != nil {
		return err
	}

	return f.Go(f.index[0])
}

func (f *Flow) Finish() error {
	state, err := f.getState()
	if err != nil {
		return err
	}

	_ = f.removeState()

	if f.done != nil {
		err = f.done(f.UserID, state.AppState)
	}
	return err
}

func (f *Flow) Go(toName Name) error {
	state, err := f.getState()
	if err != nil {
		return err
	}
	if toName == state.StepName {
		// Stay at the current step, nothing to do
		return nil
	}
	// Moving onto a different step, mark the current step as "Done"
	if state.StepName != "" && !state.Done {
		from, ok := f.steps[state.StepName]
		if !ok {
			return errors.Errorf("%s: step not found", toName)
		}

		var donePost *model.Post
		donePost, err = from.done(f, 0)
		if err != nil {
			return err
		}
		if donePost != nil {
			donePost.Id = state.PostID
			err = f.api.Post.UpdatePost(donePost)
			if err != nil {
				return err
			}
		}
	}

	if toName == "" {
		return f.Finish()
	}
	to, ok := f.steps[toName]
	if !ok {
		return errors.Errorf("%s: step not found", toName)
	}

	post, terminal, err := to.do(f)
	if err != nil {
		return err
	}
	f.processButtonPostActions(post)

	if f.debugLogState {
		data, _ := json.MarshalIndent(state, "", "  ")
		post.Message = fmt.Sprintf("State:\n```\n%s\n```\n", string(data))
	}

	err = f.api.Post.DM(f.botUserID, f.UserID, post)
	if err != nil {
		return err
	}
	if terminal {
		return f.Finish()
	}

	state.StepName = toName
	state.Done = false
	state.PostID = post.Id
	err = f.storeState(state)
	if err != nil {
		return err
	}

	if to.autoForward {
		var nextName Name

		if to.forwardTo != "" {
			nextName = to.forwardTo
		} else {
			nextName = f.next(toName)
		}

		if nextName != "" {
			return f.Go(nextName)
		}
	}

	return nil
}

func (f Flow) next(fromName Name) Name {
	for i, n := range f.index {
		if fromName == n {
			if i+1 < len(f.index) {
				return f.index[i+1]
			}
			return ""
		}
	}
	return ""
}

func namePath(name Name) string {
	return "/" + url.PathEscape(strings.Trim(string(name), "/"))
}

func Goto(toName Name) func(*Flow) (Name, State, error) {
	return func(_ *Flow) (Name, State, error) {
		return toName, nil, nil
	}
}

func DialogGoto(toName Name) func(*Flow, map[string]interface{}) (Name, State, map[string]string, error) {
	return func(_ *Flow, submitted map[string]interface{}) (Name, State, map[string]string, error) {
		stateUpdate := State{}
		for k, v := range submitted {
			stateUpdate[k] = fmt.Sprintf("%v", v)
		}
		return toName, stateUpdate, nil, nil
	}
}
