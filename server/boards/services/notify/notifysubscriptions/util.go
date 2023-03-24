// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"strings"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
)

func getBoardDescription(board *model.Block) string {
	if board == nil {
		return ""
	}

	descr, ok := board.Fields["description"]
	if !ok {
		return ""
	}

	description, ok := descr.(string)
	if !ok {
		return ""
	}

	return description
}

func stripNewlines(s string) string {
	return strings.TrimSpace(strings.ReplaceAll(s, "\n", "¶ "))
}

type StringMap map[string]string

func (sm StringMap) Add(k string, v string) {
	sm[k] = v
}

func (sm StringMap) Append(m StringMap) {
	for k, v := range m {
		sm[k] = v
	}
}

func (sm StringMap) Keys() []string {
	keys := make([]string, 0, len(sm))
	for k := range sm {
		keys = append(keys, k)
	}
	return keys
}

func (sm StringMap) Values() []string {
	values := make([]string, 0, len(sm))
	for _, v := range sm {
		values = append(values, v)
	}
	return values
}
