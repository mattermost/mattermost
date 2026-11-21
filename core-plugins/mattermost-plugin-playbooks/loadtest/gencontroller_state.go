// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import "sync"

const (
	StateTargetPlaybooks = "playbooks"
	StateTargetRuns      = "runs"

	// TODO: Move this to a config file
	TargetPlaybooks = 10
	TargetRuns      = 20
)

type state struct {
	targets    map[string]int64
	targetsMut sync.RWMutex
}

var globalState *state

func init() {
	globalState = &state{
		targets: map[string]int64{
			StateTargetPlaybooks: 0,
			StateTargetRuns:      0,
		},
	}
}

func (s *state) inc(targetID string, targetVal int64) bool {
	s.targetsMut.Lock()
	defer s.targetsMut.Unlock()
	if s.targets[targetID] == targetVal {
		return false
	}
	s.targets[targetID]++
	return true
}

func (s *state) dec(targetID string) {
	s.targetsMut.Lock()
	defer s.targetsMut.Unlock()
	s.targets[targetID]--
}

func (s *state) get(targetID string) int64 {
	s.targetsMut.RLock()
	defer s.targetsMut.RUnlock()
	return s.targets[targetID]
}

func (s *state) done() bool {
	return s.get(StateTargetPlaybooks) >= TargetPlaybooks &&
		s.get(StateTargetRuns) >= TargetRuns
}
