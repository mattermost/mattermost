// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Property field permission actions. Each names one cell of the
// field/option/value × read/write grid the permission model is asked per
// action (§2.1). Aspect comes first so everything governing one part of a
// field sorts together.
//
// Five of the six grid cells are enforced and appear here. The sixth,
// field.read, is deliberately left unenforced in v1 — a field definition's
// discoverability is not gated — so it has no constant, and neither a grant's
// allow list nor a restrictions leaf may name it.
const (
	PropertyActionFieldWrite  = "field.write"
	PropertyActionOptionRead  = "option.read"
	PropertyActionOptionWrite = "option.write"
	PropertyActionValueRead   = "value.read"
	PropertyActionValueWrite  = "value.write"
)
