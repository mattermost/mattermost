package model

import (
	"encoding/json"
	"io"
)

type AdminUser struct {
	Email    string `json:"email"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Team		 string `json:"team"`
}

func UserFromAdminUser(adm *AdminUser) *User {
	user := &User{}
	user.Username = CleanUsername(SetUsernameFromEmail(adm.Email))
	user.FirstName = adm.FirstName
	user.LastName = adm.LastName
	user.Email = adm.Email
	user.AuthData = adm.Email
	user.AuthService = USER_AUTH_SERVICE_ZBOX

	return user
}

func AdminUserFromJson(data io.Reader) *AdminUser {
	decoder := json.NewDecoder(data)
	var adm AdminUser
	err := decoder.Decode(&adm)
	if err == nil {
		return &adm
	} else {
		return nil
	}
}