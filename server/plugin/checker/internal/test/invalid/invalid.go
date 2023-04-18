// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package invalid

type API interface {
	// ValidMethod is a fake method for testing the
	// plugin comment checker with a valid comment.
	//
	// Minimum server version: 1.2.3
	ValidMethod()

	// InvalidMethod is a fake method for testing the
	// plugin comment checker with an invalid comment.
	InvalidMethod()
}

type Helpers interface {
	// Minimum server version: 1.1
	LowerVersionMethod()

	// Minimum server version: 1.3
	HigherVersionMethod()
}

type HelpersImpl struct {
	api API
}

func (h *HelpersImpl) LowerVersionMethod() {
	h.api.ValidMethod()
}

func (h *HelpersImpl) HigherVersionMethod() {
	h.api.ValidMethod()
}
