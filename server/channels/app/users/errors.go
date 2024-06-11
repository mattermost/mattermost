// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import "errors"

var (
	AcceptedDomainError       = errors.New("the email provided does not belong to an accepted domain")
	VerifyUserError           = errors.New("could not update verify email field")
	UserCountError            = errors.New("could not get the total number of the users.")
	UserCreationDisabledError = errors.New("user creation is not allowed")
	UserStoreIsEmptyError     = errors.New("could not check if the user store is empty")

	DeleteAllAccessDataError = errors.New("could not delete all access data")

	DefaultFontError   = errors.New("could not get default font")
	UserInitialsError  = errors.New("could not get user initials")
	ImageEncodingError = errors.New("could not encode image")
	GlyphError         = errors.New("could not get glyph")
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
	return "invalid password"
}

func (e *ErrInvalidPassword) Id() string {
	return e.id
}
