// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// Valid: Assigning AppError to AppError variable
func validAppErrorToAppError() {
	var appErr *model.AppError
	appErr = model.NewAppError("test", "error", nil, "", 500)
	_ = appErr

	// Valid: Using := with AppError type
	appErr2 := model.NewAppError("test", "error", nil, "", 500)
	_ = appErr2

	// Valid: Multi-return where AppError goes to AppError variable
	_, appErr3 := functionReturningAppError()
	_ = appErr3
}

// Valid: Assigning regular error to error variable
func validErrorToError() {
	var err error
	err = functionReturningError()
	_ = err

	// Valid: Using := with error type
	err2 := functionReturningError()
	_ = err2

	// Valid: Multi-return where error goes to error variable
	_, err3 := functionReturningMultiError()
	_ = err3
}

// Valid: Assigning nil to error variable
func validNilAssignments() {
	var err error
	err = nil
	_ = err

	var appErr *model.AppError
	appErr = nil
	_ = appErr
}

// Invalid: Assigning AppError to error variable (multi-return with single RHS)
func invalidMultiReturnAppErrorToError() {
	// This is the most common pattern: function returns (something, *model.AppError)
	// but we assign it to (something, error)
	var err error
	_, err = functionReturningAppError() // want "assigning a .* to a"
	_ = err

	// Similar pattern with different return position
	var result string
	var err2 error
	result, err2 = functionReturningAppError() // want "assigning a .* to a"
	_, _ = result, err2
}

// Invalid: Mixed return types
func invalidMixedReturnTypes() {
	// Mixed: first is error, second is AppError assigned to error
	var normalErr error
	var appErr2 error
	normalErr, appErr2 = functionReturningErrorAndAppError() // want "assigning a .* to a"
	_, _ = normalErr, appErr2

	// Another function returning just string and AppError
	var data string
	var err error
	data, err = functionReturningAppError() // want "assigning a .* to a"
	_, _ = data, err
}

// Helper functions to simulate different return patterns
func functionReturningError() error {
	return nil
}

func functionReturningMultiError() (string, error) {
	return "", nil
}

func functionReturningAppError() (string, *model.AppError) {
	return "", nil
}

func functionReturningTwoAppErrors() (*model.AppError, *model.AppError) {
	return nil, nil
}

func functionReturningErrorAndAppError() (error, *model.AppError) {
	return nil, nil
}
