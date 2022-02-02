package flow

import (
	"strings"

	"github.com/mattermost/mattermost-plugin-api/experimental/flow/steps"
)

type Flow interface {
	Name() string
	Path() string
	Steps() []steps.Step
	Step(i int) steps.Step
	Length() int
	FlowDone(userID string)
}

type flow struct {
	name       string
	path       string
	steps      []steps.Step
	onFlowDone func(userID string)
}

// NewFlow creates a new flow using a an non-empty list of steps.
//
// name must be a unique identifier for a flow within the plugin.
func NewFlow(name string, stepList []steps.Step, onFlowDone func(userID string)) Flow {
	if len(stepList) == 0 {
		panic("stepList must not be empty")
	}

	f := &flow{
		path:       "/" + strings.Trim(name, "/"), // No need to check for path traversal as plugin have network access anyway
		name:       name,
		steps:      stepList,
		onFlowDone: onFlowDone,
	}
	return f
}

func (f *flow) Path() string {
	return f.path
}

func (f *flow) Name() string {
	return f.name
}

func (f *flow) Steps() []steps.Step {
	return f.steps
}

func (f *flow) Step(i int) steps.Step {
	if i < 1 {
		return nil
	}
	if i > len(f.steps) {
		return nil
	}
	return f.steps[i-1]
}

func (f *flow) Length() int {
	return len(f.steps)
}

func (f *flow) FlowDone(userID string) {
	if f.onFlowDone != nil {
		f.onFlowDone(userID)
	}
}
