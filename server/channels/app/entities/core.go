// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	coreTimeTypeID    = "mm.time"
	coreTimeMatcherID = "mm.time.rfc3339"
	// Required timezone keeps issue ids and version strings from matching.
	coreTimePattern = `[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,9})?)?(?:[Zz]|[+-][0-9]{2}:[0-9]{2})`
)

func init() {
	ensureCore()
}

func ensureCore() {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	reg.types[coreTimeTypeID] = entityType{
		id:          coreTimeTypeID,
		displayName: "Time",
		owner:       coreOwner,
	}
	for _, stored := range reg.matchers {
		if stored.id == coreTimeMatcherID {
			reg.rememberGeneration()
			return
		}
	}
	compiled := regexp.MustCompile(coreTimePattern)
	reg.matchers = append(reg.matchers, storedMatcher{
		owner: coreOwner,
		matcher: matcher{
			id:          coreTimeMatcherID,
			typeID:      coreTimeTypeID,
			pattern:     compiled,
			boundary:    "token",
			pluginID:    coreOwner,
			displayName: "Time",
		},
	})
	reg.matcherIndex = map[string]int{}
	for i, stored := range reg.matchers {
		reg.matcherIndex[stored.id] = i
	}
	reg.rememberGeneration()
}

// CoreLookup describes a value using a built-in type.
func CoreLookup(_ context.Context, typeID, value string) (*model.EntityCard, error) {
	switch typeID {
	case coreTimeTypeID:
		return coreTimeCard(value)
	default:
		return nil, fmt.Errorf("unsupported entity")
	}
}

func coreTimeCard(value string) (*model.EntityCard, error) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, value)
	}
	if err != nil {
		return nil, fmt.Errorf("unsupported entity")
	}
	utc := parsed.UTC()
	blocks, err := json.Marshal([]map[string]any{
		{
			"type": "text",
			"text": fmt.Sprintf("**UTC:** %s", utc.Format(time.RFC3339)),
		},
		{
			"type":      "text",
			"text":      fmt.Sprintf("Local offset in the token: %s", parsed.Format("-07:00")),
			"is_subtle": true,
		},
		{
			"type": "divider",
		},
		{
			"type":      "text",
			"text":      "Shown in your timezone when the clocks panel is available. The stored message is unchanged.",
			"size":      "small",
			"is_subtle": true,
		},
	})
	if err != nil {
		return nil, err
	}
	return &model.EntityCard{
		TypeID:  coreTimeTypeID,
		Value:   value,
		Title:   "Timestamp",
		Instant: utc.UnixMilli(),
		Blocks:  blocks,
	}, nil
}
