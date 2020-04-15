// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"fmt"
)

// ErrInvalidInput indicates an error that has occured due to an invalid input.
type ErrInvalidInput struct {
	Entity string      // The entity which was sent as the input.
	Field  string      // The field of the entity which was invalid.
	Value  interface{} // The actual value of the field.
}

func NewErrInvalidInput(entity, field string, value interface{}) *ErrInvalidInput {
	return &ErrInvalidInput{
		Entity: entity,
		Field:  field,
		Value:  value,
	}
}

func (e *ErrInvalidInput) Error() string {
	return fmt.Sprintf("invalid input: entity: %s field: %s value: %s", e.Entity, e.Field, e.Value)
}

// ErrLimitExceeded indicates an error that has occured because some value exceeded a limit.
type ErrLimitExceeded struct {
	What  string // What was the object that exceeded.
	Count int    // The value of the object.
	meta  string // Any additional metadata.
}

func NewErrLimitExceeded(what string, count int, meta string) *ErrLimitExceeded {
	return &ErrLimitExceeded{
		What:  what,
		Count: count,
		meta:  meta,
	}
}

func (e *ErrLimitExceeded) Error() string {
	return fmt.Sprintf("limit exceeded: what: %s count: %d metadata: %s", e.What, e.Count, e.meta)
}

// ErrConflict indicates a conflict that occured.
type ErrConflict struct {
	Resource string // The resource which created the conflict.
	err      error  // Internal error.
	meta     string // Any additional metadata.
}

func NewErrConflict(resource string, err error, meta string) *ErrConflict {
	return &ErrConflict{
		Resource: resource,
		err:      err,
		meta:     meta,
	}
}

func (e *ErrConflict) Error() string {
	return e.Resource + "exists " + e.meta + " " + e.err.Error()
}

func (e *ErrConflict) Unwrap() error {
	return e.err
}

// ErrInternal indicates an internal error.
type ErrInternal struct {
	Location string // The location of the error origin.
	err      error  // Internal error.
	meta     string // Any additional metadata.
}

func NewErrInternal(location string, err error, meta string) *ErrInternal {
	return &ErrInternal{
		Location: location,
		err:      err,
		meta:     meta,
	}
}

func (e *ErrInternal) Error() string {
	return "location: " + e.Location + " " + e.meta + " " + e.err.Error()
}

func (e *ErrInternal) Unwrap() error {
	return e.err
}

// TODO:
// type ErrNotFound struct {
// }
