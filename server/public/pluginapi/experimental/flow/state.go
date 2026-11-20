package flow

import (
	"bytes"
	"errors"
	"text/template"
)

var errStateNotFound = errors.New("flow state not found")

// State is the "app"'s state
type State map[string]any

// Get returns the value for a given key as a T.
// If the key is not found or isn't a T, the zero value of T is returned.
func (s State) Get[T any](key string) T {
	vRaw, ok := s[key]
	if ok {
		v, ok := vRaw.(T)
		if ok {
			return v
		}
	}

	var zero T
	return zero
}

// JSON-serializable flow state.
type flowState struct {
	// The name of the step.
	StepName Name

	Done bool

	// ID of the post produced by the step.
	PostID string

	// Application-level state.
	AppState State
}

func (f *Flow) storeState(state flowState) error {
	if f.UserID == "" {
		return errors.New("no user specified")
	}

	// Set AppState to differentiate an existing flow
	if state.AppState == nil {
		state.AppState = State{}
	}

	ok, err := f.api.KV.Set(kvKey(f.UserID, f.name), state)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}

	f.state = &state
	return nil
}

func (f *Flow) getState() (flowState, error) {
	if f.UserID == "" {
		return flowState{}, errors.New("no user specified")
	}
	if f.state != nil {
		return *f.state, nil
	}
	state := flowState{}
	err := f.api.KV.Get(kvKey(f.UserID, f.name), &state)
	if err != nil {
		return flowState{}, err
	}
	if state.AppState == nil {
		return flowState{}, errStateNotFound
	}

	f.state = &state
	return state, err
}

func (f *Flow) removeState() error {
	if f.UserID == "" {
		return errors.New("no user specified")
	}
	f.state = nil
	return f.api.KV.Delete(kvKey(f.UserID, f.name))
}

func kvKey(userID string, flowName Name) string {
	return "_flow-" + userID + "-" + string(flowName)
}

func formatState(source string, state State) string {
	t, err := template.New("message").Parse(source)
	if err != nil {
		return source + " ###ERROR: " + err.Error()
	}
	buf := bytes.NewBuffer(nil)
	err = t.Execute(buf, state)
	if err != nil {
		return source + " ###ERROR: " + err.Error()
	}
	return buf.String()
}
