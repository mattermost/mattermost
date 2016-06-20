package manners

import (
	helpers "github.com/braintree/manners/test_helpers"
	"net/http"
	"strings"
	"testing"
)

func TestStateTransitions(t *testing.T) {
	tests := []transitionTest{
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive}, 1},
		transitionTest{[]http.ConnState{http.StateNew, http.StateClosed}, 0},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateClosed}, 0},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateHijacked}, 0},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateIdle}, 0},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateIdle, http.StateActive}, 1},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateIdle, http.StateActive, http.StateIdle}, 0},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateIdle, http.StateActive, http.StateClosed}, 0},
		transitionTest{[]http.ConnState{http.StateNew, http.StateActive, http.StateIdle, http.StateActive, http.StateIdle, http.StateClosed}, 0},
	}

	for _, test := range tests {
		testStateTransition(t, test)
	}
}

type transitionTest struct {
	states          []http.ConnState
	expectedWgCount int
}

func testStateTransition(t *testing.T, test transitionTest) {
	server := NewServer()
	wg := helpers.NewWaitGroup()
	server.wg = wg
	startServer(t, server, nil)

	conn := &helpers.Conn{}
	for _, newState := range test.states {
		server.ConnState(conn, newState)
	}

	server.Close()
	waiting := <-wg.WaitCalled
	if waiting != test.expectedWgCount {
		names := make([]string, len(test.states))
		for i, s := range test.states {
			names[i] = s.String()
		}
		transitions := strings.Join(names, " -> ")
		t.Errorf("%s - Waitcount should be %d, got %d", transitions, test.expectedWgCount, waiting)
	}
}
