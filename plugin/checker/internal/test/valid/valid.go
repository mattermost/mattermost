// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package valid

type API interface {
	// ValidMethod is a fake method for testing the
	// plugin comment checker with a valid comment.
	//
	// Minimum server version: 1.2.3
	ValidMethod()

	// Minimum server version: 1.5
	NewerValidMethod()
}

type Helpers interface {
	// Minimum server version: 1.2.3
	ValidHelperMethod()

	// Minimum server version: 1.5
	NewerValidHelperMethod()

	// Minimum server version: 1.5
	IndirectReferenceMethod()
}

type HelpersImpl struct {
	api API
}

func (h *HelpersImpl) ValidHelperMethod() {
	h.api.ValidMethod()
}

func (h *HelpersImpl) NewerValidHelperMethod() {
	h.api.NewerValidMethod()
	h.api.ValidMethod()
}

func (h *HelpersImpl) IndirectReferenceMethod() {
	a := h.api
	a.NewerValidMethod()
}
