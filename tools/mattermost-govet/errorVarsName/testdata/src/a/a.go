// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// Valid: err variable with error type
func validErrWithError() {
	var err error
	err = functionReturningError()
	_ = err

	var err2 error
	_, err2 = functionReturningMultiError()
	_ = err2

	// Multiple err variables
	var errOne, errTwo error
	errOne, errTwo = functionReturningTwoErrors()
	_, _ = errOne, errTwo
}

// Valid: appErr variable with AppError type
func validAppErrWithAppError() {
	var appErr *model.AppError
	appErr = model.NewAppError("test", "error", nil, "", 500)
	_ = appErr

	var appErr2 *model.AppError
	_, appErr2 = functionReturningAppError()
	_ = appErr2

	// Multiple appErr variables
	var appErrOne, appErrTwo *model.AppError
	appErrOne, appErrTwo = functionReturningTwoAppErrors()
	_, _ = appErrOne, appErrTwo
}

// Invalid: err variable with AppError type (should use appErr)
func invalidErrWithAppError() {
	var err *model.AppError
	err = model.NewAppError("test", "error", nil, "", 500) // want "assigning a .* to a `err` prefixed variable"
	_ = err

	var errSomething *model.AppError
	_, errSomething = functionReturningAppError() // want "assigning a .* to a `err` prefixed variable"
	_ = errSomething
}

// Invalid: appErr variable with error type (should use err)
func invalidAppErrWithError() {
	var appErr error
	appErr = functionReturningError() // want "assigning a error variable to an `appErr` prefixed variable"
	_ = appErr

	var appErrSomething error
	_, appErrSomething = functionReturningMultiError() // want "assigning a error variable to an `appErr` prefixed variable"
	_ = appErrSomething
}

// Helper functions to simulate different return patterns
func functionReturningError() error {
	return nil
}

func functionReturningMultiError() (string, error) {
	return "", nil
}

func functionReturningTwoErrors() (error, error) {
	return nil, nil
}

func functionReturningAppError() (string, *model.AppError) {
	return "", nil
}

func functionReturningTwoAppErrors() (*model.AppError, *model.AppError) {
	return nil, nil
}
