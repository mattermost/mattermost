package flow

import (
	"bytes"
	"errors"
	"text/template"
)

var errStateNotFound = errors.New("flow state not found")

// State is the "app"'s state
type State map[string]interface{}

func (s State) MergeWith(update State) State {
	n := State{}
	for k, v := range s {
		n[k] = v
	}
	for k, v := range update {
		n[k] = v
	}
	return n
}

// GetString return the value to a given key as a string.
// If the key is not found or isn't a string, an empty string is returned.
func (s State) GetString(key string) string {
	vRaw, ok := s[key]
	if ok {
		v, ok := vRaw.(string)
		if ok {
			return v
		}
	}

	return ""
}

// GetInt return the value to a given key as a int.
// If the key is not found or isn't an int, zero is returned.
func (s State) GetInt(key string) int {
	vRaw, ok := s[key]
	if ok {
		v, ok := vRaw.(int)
		if ok {
			return v
		}
	}

	return 0
}

// GetBool return the value to a given key as a bool.
// If the key is not found or isn't a bool, false is returned.
func (s State) GetBool(key string) bool {
	vRaw, ok := s[key]
	if ok {
		v, ok := vRaw.(bool)
		if ok {
			return v
		}
	}

	return false
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
