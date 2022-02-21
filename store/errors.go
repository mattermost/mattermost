// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"fmt"
	"strings"
)

// ErrInvalidInput indicates an error that has occurred due to an invalid input.
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

func (e *ErrInvalidInput) InvalidInputInfo() (entity string, field string, value interface{}) {
	entity = e.Entity
	field = e.Field
	value = e.Value
	return
}

// ErrLimitExceeded indicates an error that has occurred because some value exceeded a limit.
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

// ErrConflict indicates a conflict that occurred.
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
	msg := e.Resource + "exists " + e.meta
	if e.err != nil {
		msg += " " + e.err.Error()
	}
	return msg
}

func (e *ErrConflict) Unwrap() error {
	return e.err
}

// IsErrConflict allows easy type assertion without adding store as a dependency.
func (e *ErrConflict) IsErrConflict() bool {
	return true
}

// ErrNotFound indicates that a resource was not found
type ErrNotFound struct {
	resource string
	ID       string
}

func NewErrNotFound(resource, id string) *ErrNotFound {
	return &ErrNotFound{
		resource: resource,
		ID:       id,
	}
}

func (e *ErrNotFound) Error() string {
	return "resource: " + e.resource + " id: " + e.ID
}

// IsErrNotFound allows easy type assertion without adding store as a dependency.
func (e *ErrNotFound) IsErrNotFound() bool {
	return true
}

// ErrOutOfBounds indicates that the requested total numbers of rows
// was greater than the allowed limit.
type ErrOutOfBounds struct {
	value int
}

func (e *ErrOutOfBounds) Error() string {
	return fmt.Sprintf("invalid limit parameter: %d", e.value)
}

func NewErrOutOfBounds(value int) *ErrOutOfBounds {
	return &ErrOutOfBounds{value: value}
}

// ErrNotImplemented indicates that some feature or requirement is not implemented yet.
type ErrNotImplemented struct {
	detail string
}

func (e *ErrNotImplemented) Error() string {
	return e.detail
}

func NewErrNotImplemented(detail string) *ErrNotImplemented {
	return &ErrNotImplemented{detail: detail}
}

type ErrUniqueConstraint struct {
	Columns []string
}

// NewErrUniqueConstraint creates a uniqueness constraint error for the given column(s).
//
// Examples:
//
//  store.NewErrUniqueConstraint("DisplayName") // single column constraint
//  store.NewErrUniqueConstraint("Name", "Source") // multi-column constaint
func NewErrUniqueConstraint(columns ...string) *ErrUniqueConstraint {
	return &ErrUniqueConstraint{
		Columns: columns,
	}
}

func (e *ErrUniqueConstraint) Error() string {
	var tmpl string
	if len(e.Columns) > 1 {
		tmpl = "unique constraint: (%s)"
	} else {
		tmpl = "unique constraint: %s"
	}
	return fmt.Sprintf(tmpl, strings.Join(e.Columns, ","))
}
