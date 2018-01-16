package oauthgoogle

import (
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"io"
	"encoding/json"
	//"strconv"
	"fmt"
)

type GoogleProvider struct {
}

// UserInfo google user info structure
type GoogleUser struct {
	Kind        string `json:"kind"`
	Language    string `json:"language"`
	Etag        string `json:"etag"`
	Gender      string `json:"gender"`
	ObjectType  string `json:"objectType"`
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Name struct {
		FamilyName string `json:"familyName"`
		GivenName  string `json:"givenName"`
	} `json:"name"`
	Emails []struct {
		Value string `json:"value"`
		Type  string `json:"type"`
	} `json:"emails"`
	URL string `json:"url"`
	Image struct {
		URL       string `json:"url"`
		IsDefault bool   `json:"isDefault"`
	} `json:"image"`
	IsPlusUser     bool `json:"isPlusUser"`
	CircledByCount int  `json:"circledByCount"`
	Verified       bool `json:"verified"`
}

func init() {
	provider := &GoogleProvider{}
	einterfaces.RegisterOauthProvider(model.USER_AUTH_SERVICE_GOOGLE, provider)
}

func userFromGoogleUser(gu *GoogleUser) *model.User {
	user := &model.User{}
	username := gu.DisplayName
	if username == "" {
		username = gu.Name.GivenName
	}
	user.Username = model.CleanUsername(username)
	user.FirstName = gu.Name.GivenName
	user.LastName = gu.Name.FamilyName

	if len(gu.Emails) > 0 {
		user.Email = (gu.Emails[0]).Value
	}
	userId := gu.ID
	user.AuthData = &userId
	user.AuthService = model.USER_AUTH_SERVICE_GOOGLE

	return user
}

func googleUserFromJson(data io.Reader) *GoogleUser {
	decoder := json.NewDecoder(data)

	var gu GoogleUser
	err := decoder.Decode(&gu)
	fmt.Println("gu=", gu)
	if err == nil {
		return &gu
	} else {
		fmt.Errorf(err.Error())
		return nil
	}
}

func (gu *GoogleUser) IsValid() bool {
	fmt.Println(gu)
	fmt.Println(gu.ID)
	if len(gu.ID) == 0 {
		return false
	}

	if len(gu.Emails) == 0 {
		return false
	}

	return true
}

func (gu *GoogleUser) getAuthData() string {
	return gu.ID
}

func (m *GoogleProvider) GetIdentifier() string {
	return model.USER_AUTH_SERVICE_GOOGLE
}

func (m *GoogleProvider) GetUserFromJson(data io.Reader) *model.User {
	gu := googleUserFromJson(data)
	if gu.IsValid() {
		return userFromGoogleUser(gu)
	}

	return &model.User{}
}

func (m *GoogleProvider) GetAuthDataFromJson(data io.Reader) string {
	gu := googleUserFromJson(data)

	if gu.IsValid() {
		return gu.getAuthData()
	}

	return ""
}
