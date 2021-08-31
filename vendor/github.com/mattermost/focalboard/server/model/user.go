package model

import (
	"encoding/json"
	"io"
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
	Email string `json:"email"`

	// swagger:ignore
	Password string `json:"-"`

	// swagger:ignore
	MfaSecret string `json:"-"`

	// swagger:ignore
	AuthService string `json:"-"`

	// swagger:ignore
	AuthData string `json:"-"`

	// User settings
	// required: true
	Props map[string]interface{} `json:"props"`

	// Created time
	// required: true
	CreateAt int64 `json:"create_at,omitempty"`

	// Updated time
	// required: true
	UpdateAt int64 `json:"update_at,omitempty"`

	// Deleted time, set to indicate user is deleted
	// required: true
	DeleteAt int64 `json:"delete_at"`
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
