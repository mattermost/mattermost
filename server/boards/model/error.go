// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
)

var (
	ErrViewsLimitReached        = errors.New("views limit reached for board")
	ErrPatchUpdatesLimitedCards = errors.New("patch updates cards that are limited")

	ErrInsufficientLicense = errors.New("appropriate license required")

	ErrCategoryPermissionDenied = errors.New("category doesn't belong to user")
	ErrCategoryDeleted          = errors.New("category is deleted")

	ErrBoardMemberIsLastAdmin = errors.New("cannot leave a board with no admins")

	ErrRequestEntityTooLarge = errors.New("request entity too large")

	ErrInvalidBoardSearchField = errors.New("invalid board search field")
)

// ErrNotFound is an error type that can be returned by store APIs
// when a query unexpectedly fetches no records.
type ErrNotFound struct {
	entity string
}

// NewErrNotFound creates a new ErrNotFound instance.
func NewErrNotFound(entity string) *ErrNotFound {
	return &ErrNotFound{
		entity: entity,
	}
}

func (nf *ErrNotFound) Error() string {
	return fmt.Sprintf("{%s} not found", nf.entity)
}

// ErrNotAllFound is an error type that can be returned by store APIs
// when a query that should fetch a certain amount of records
// unexpectedly fetches less.
type ErrNotAllFound struct {
	entity    string
	resources []string
}

func NewErrNotAllFound(entity string, resources []string) *ErrNotAllFound {
	return &ErrNotAllFound{
		entity:    entity,
		resources: resources,
	}
}

func (naf *ErrNotAllFound) Error() string {
	return fmt.Sprintf("not all instances of {%s} in {%s} found", naf.entity, strings.Join(naf.resources, ", "))
}

// ErrBadRequest can be returned when the API handler receives a
// malformed request.
type ErrBadRequest struct {
	reason string
}

// NewErrNotFound creates a new ErrNotFound instance.
func NewErrBadRequest(reason string) *ErrBadRequest {
	return &ErrBadRequest{
		reason: reason,
	}
}

func (br *ErrBadRequest) Error() string {
	return br.reason
}

// ErrUnauthorized can be returned when requester has provided an
// invalid authorization for a given resource or has not provided any.
type ErrUnauthorized struct {
	reason string
}

// NewErrUnauthorized creates a new ErrUnauthorized instance.
func NewErrUnauthorized(reason string) *ErrUnauthorized {
	return &ErrUnauthorized{
		reason: reason,
	}
}

func (br *ErrUnauthorized) Error() string {
	return br.reason
}

// ErrPermission can be returned when requester lacks a permission for
// a given resource.
type ErrPermission struct {
	reason string
}

// NewErrPermission creates a new ErrPermission instance.
func NewErrPermission(reason string) *ErrPermission {
	return &ErrPermission{
		reason: reason,
	}
}

func (br *ErrPermission) Error() string {
	return br.reason
}

// ErrForbidden can be returned when requester doesn't have access to
// a given resource.
type ErrForbidden struct {
	reason string
}

// NewErrForbidden creates a new ErrForbidden instance.
func NewErrForbidden(reason string) *ErrForbidden {
	return &ErrForbidden{
		reason: reason,
	}
}

func (br *ErrForbidden) Error() string {
	return br.reason
}

type ErrInvalidCategory struct {
	msg string
}

func NewErrInvalidCategory(msg string) *ErrInvalidCategory {
	return &ErrInvalidCategory{
		msg: msg,
	}
}

func (e *ErrInvalidCategory) Error() string {
	return e.msg
}

type ErrNotImplemented struct {
	msg string
}

func NewErrNotImplemented(msg string) *ErrNotImplemented {
	return &ErrNotImplemented{
		msg: msg,
	}
}

func (ni *ErrNotImplemented) Error() string {
	return ni.msg
}

// IsErrBadRequest returns true if `err` is or wraps one of:
// - model.ErrBadRequest
// - model.ErrViewsLimitReached
// - model.ErrAuthParam
// - model.ErrInvalidCategory
// - model.ErrBoardMemberIsLastAdmin
// - model.ErrBoardIDMismatch.
func IsErrBadRequest(err error) bool {
	if err == nil {
		return false
	}

	// check if this is a model.ErrBadRequest
	var br *ErrBadRequest
	if errors.As(err, &br) {
		return true
	}

	// check if this is a model.ErrAuthParam
	var ap *ErrAuthParam
	if errors.As(err, &ap) {
		return true
	}

	// check if this is a model.ErrViewsLimitReached
	if errors.Is(err, ErrViewsLimitReached) {
		return true
	}

	// check if this is a model.ErrInvalidCategory
	var ic *ErrInvalidCategory
	if errors.As(err, &ic) {
		return true
	}

	// check if this is a model.ErrBoardIDMismatch
	if errors.Is(err, ErrBoardMemberIsLastAdmin) {
		return true
	}

	// check if this is a model.ErrBoardMemberIsLastAdmin
	return errors.Is(err, ErrBoardIDMismatch)
}

// IsErrUnauthorized returns true if `err` is or wraps one of:
// - model.ErrUnauthorized.
func IsErrUnauthorized(err error) bool {
	if err == nil {
		return false
	}

	// check if this is a model.ErrUnauthorized
	var u *ErrUnauthorized
	return errors.As(err, &u)
}

// IsErrForbidden returns true if `err` is or wraps one of:
// - model.ErrForbidden
// - model.ErrPermission
// - model.ErrPatchUpdatesLimitedCards
// - model.ErrorCategoryPermissionDenied.
func IsErrForbidden(err error) bool {
	if err == nil {
		return false
	}

	// check if this is a model.ErrForbidden
	var f *ErrForbidden
	if errors.As(err, &f) {
		return true
	}

	// check if this is a model.ErrPermission
	var p *ErrPermission
	if errors.As(err, &p) {
		return true
	}

	// check if this is a model.ErrPatchUpdatesLimitedCards
	if errors.Is(err, ErrPatchUpdatesLimitedCards) {
		return true
	}

	// check if this is a model.ErrCategoryPermissionDenied
	return errors.Is(err, ErrCategoryPermissionDenied)
}

// IsErrNotFound returns true if `err` is or wraps one of:
// - model.ErrNotFound
// - model.ErrNotAllFound
// - sql.ErrNoRows
// - mattermost-plugin-api/ErrNotFound.
// - model.ErrCategoryDeleted.
func IsErrNotFound(err error) bool {
	if err == nil {
		return false
	}

	// check if this is a model.ErrNotFound
	var nf *ErrNotFound
	if errors.As(err, &nf) {
		return true
	}

	// check if this is a model.ErrNotAllFound
	var naf *ErrNotAllFound
	if errors.As(err, &naf) {
		return true
	}

	// check if this is a sql.ErrNotFound
	if errors.Is(err, sql.ErrNoRows) {
		return true
	}

	// check if this is a Mattermost AppError with a Not Found status
	var appErr *mm_model.AppError
	if errors.As(err, &appErr) {
		if appErr.StatusCode == http.StatusNotFound {
			return true
		}
	}

	// check if this is a model.ErrCategoryDeleted
	return errors.Is(err, ErrCategoryDeleted)
}

// IsErrRequestEntityTooLarge returns true if `err` is or wraps one of:
// - model.ErrRequestEntityTooLarge.
func IsErrRequestEntityTooLarge(err error) bool {
	// check if this is a model.ErrRequestEntityTooLarge
	return errors.Is(err, ErrRequestEntityTooLarge)
}

// IsErrNotImplemented returns true if `err` is or wraps one of:
// - model.ErrNotImplemented
// - model.ErrInsufficientLicense.
func IsErrNotImplemented(err error) bool {
	if err == nil {
		return false
	}

	// check if this is a model.ErrNotImplemented
	var eni *ErrNotImplemented
	if errors.As(err, &eni) {
		return true
	}

	// check if this is a model.ErrInsufficientLicense
	return errors.Is(err, ErrInsufficientLicense)
}
