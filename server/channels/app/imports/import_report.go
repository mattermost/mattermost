// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"strings"
	"sync"
)

// UsernameRemap tracks source→dest username mappings built during user processing.
// When auth_data matching finds a user whose username changed on the dest, the
// mapping is recorded here so post/reply/reaction processing can attribute content
// to the correct account even when the post line references the old source username.
type UsernameRemap struct {
	mu sync.RWMutex
	m  map[string]string // lowercase src username → current dest username
}

func (r *UsernameRemap) Add(srcUsername, destUsername string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.m == nil {
		r.m = make(map[string]string)
	}
	r.m[strings.ToLower(srcUsername)] = destUsername
}

func (r *UsernameRemap) Lookup(srcUsername string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	v, ok := r.m[strings.ToLower(srcUsername)]
	return v, ok
}

// ImportReport is threaded through the import pipeline to carry the UsernameRemap.
// Reporting fields (outcome counts, deactivated user lists) will be added in a
// follow-up once the report file format is finalised.
type ImportReport struct {
	// Remap is populated during user processing and consumed during post processing.
	// It is safe for concurrent use independently.
	Remap UsernameRemap
}
