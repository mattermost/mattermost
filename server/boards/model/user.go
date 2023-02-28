package model

import (
	"encoding/json"
	"io"
)

const (
	SingleUser                    = "single-user"
	GlobalTeamID                  = "0"
	SystemUserID                  = "system"
	PreferencesCategoryFocalboard = "focalboard"
)

// User is a user
// swagger:model
type User struct {
	// The user ID
	// required: true
	ID string `json:"id"`

	// The user name
	// required: true
	Username string `json:"username"`

	// The user's email
	// required: true
	Email string `json:"-"`

	// The user's nickname
	Nickname string `json:"nickname"`
	// The user's first name
	FirstName string `json:"firstname"`
	// The user's last name
	LastName string `json:"lastname"`

	// swagger:ignore
	Password string `json:"-"`

	// swagger:ignore
	MfaSecret string `json:"-"`

	// swagger:ignore
	AuthService string `json:"-"`

	// swagger:ignore
	AuthData string `json:"-"`

	// Created time in miliseconds since the current epoch
	// required: true
	CreateAt int64 `json:"create_at,omitempty"`

	// Updated time in miliseconds since the current epoch
	// required: true
	UpdateAt int64 `json:"update_at,omitempty"`

	// Deleted time in miliseconds since the current epoch, set to indicate user is deleted
	// required: true
	DeleteAt int64 `json:"delete_at"`

	// If the user is a bot or not
	// required: true
	IsBot bool `json:"is_bot"`

	// If the user is a guest or not
	// required: true
	IsGuest bool `json:"is_guest"`

	// Special Permissions the user may have
	Permissions []string `json:"permissions,omitempty"`

	Roles string `json:"roles"`
}

// UserPreferencesPatch is a user property patch
// swagger:model
type UserPreferencesPatch struct {
	// The user preference updated fields
	// required: false
	UpdatedFields map[string]string `json:"updatedFields"`

	// The user preference removed fields
	// required: false
	DeletedFields []string `json:"deletedFields"`
}

type Session struct {
	ID          string                 `json:"id"`
	Token       string                 `json:"token"`
	UserID      string                 `json:"user_id"`
	AuthService string                 `json:"authService"`
	Props       map[string]interface{} `json:"props"`
	CreateAt    int64                  `json:"create_at,omitempty"`
	UpdateAt    int64                  `json:"update_at,omitempty"`
}

func UserFromJSON(data io.Reader) (*User, error) {
	var user User
	if err := json.NewDecoder(data).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}
