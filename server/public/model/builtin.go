// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// NewPointer returns a pointer to the object passed.
func NewPointer[T any](t T) *T { return &t }

// SafeDereference returns the zero value of T if t is nil.
// Otherwise, it returns t dereferenced.
func SafeDereference[T any](t *T) T {
	if t == nil {
		var t T
		return t
	}
	return *t
}
