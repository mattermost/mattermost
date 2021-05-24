// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import "errors"

var (
	AcceptedDomainError  error = errors.New("the email provided does not belong to an accepted domain")
	VerifyUserError      error = errors.New("could not update verify email field")
	UserCountError       error = errors.New("could not get the total number of the users.")
	InvalidPasswordError error = errors.New("invalid password")
)

// ErrInvalidPassword indicates an error against the password settings
type ErrInvalidPassword struct {
	id string
}

func NewErrInvalidPassword(id string) *ErrInvalidPassword {
	return &ErrInvalidPassword{
		id: id,
	}
}

func (e *ErrInvalidPassword) Error() string {
	return InvalidPasswordError.Error()
}

func (e *ErrInvalidPassword) Id() string {
	return e.id
}
