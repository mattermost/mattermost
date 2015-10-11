// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"code.google.com/p/go.crypto/bcrypt"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const (
	ROLE_TEAM_ADMIN      = "admin"
	ROLE_SYSTEM_ADMIN    = "system_admin"
	USER_AWAY_TIMEOUT    = 5 * 60 * 1000 // 5 minutes
	USER_OFFLINE_TIMEOUT = 1 * 60 * 1000 // 1 minute
	USER_OFFLINE         = "offline"
	USER_AWAY            = "away"
	USER_ONLINE          = "online"
	USER_NOTIFY_ALL      = "all"
	USER_NOTIFY_MENTION  = "mention"
	USER_NOTIFY_NONE     = "none"
)

type User struct {
	Id                 string    `json:"id"`
	CreateAt           int64     `json:"create_at"`
	UpdateAt           int64     `json:"update_at"`
	DeleteAt           int64     `json:"delete_at"`
	TeamId             string    `json:"team_id"`
	Username           string    `json:"username"`
	Password           string    `json:"password"`
	AuthData           string    `json:"auth_data"`
	AuthService        string    `json:"auth_service"`
	Email              string    `json:"email"`
	EmailVerified      bool      `json:"email_verified"`
	Nickname           string    `json:"nickname"`
	FirstName          string    `json:"first_name"`
	LastName           string    `json:"last_name"`
	Roles              string    `json:"roles"`
	LastActivityAt     int64     `json:"last_activity_at"`
	LastPingAt         int64     `json:"last_ping_at"`
	AllowMarketing     bool      `json:"allow_marketing"`
	Props              StringMap `json:"props"`
	NotifyProps        StringMap `json:"notify_props"`
	ThemeProps         StringMap `json:"theme_props"`
	LastPasswordUpdate int64     `json:"last_password_update"`
	LastPictureUpdate  int64     `json:"last_picture_update"`
	FailedAttempts     int       `json:"failed_attempts"`
}

// IsValid validates the user and returns an error if it isn't configured
// correctly.
func (u *User) IsValid() *AppError {

	if len(u.Id) != 26 {
		return NewAppError("User.IsValid", "Invalid user id", "")
	}

	if u.CreateAt == 0 {
		return NewAppError("User.IsValid", "Create at must be a valid time", "user_id="+u.Id)
	}

	if u.UpdateAt == 0 {
		return NewAppError("User.IsValid", "Update at must be a valid time", "user_id="+u.Id)
	}

	if len(u.TeamId) != 26 {
		return NewAppError("User.IsValid", "Invalid team id", "")
	}

	if !IsValidUsername(u.Username) {
		return NewAppError("User.IsValid", "Invalid username", "user_id="+u.Id)
	}

	if len(u.Email) > 128 || len(u.Email) == 0 {
		return NewAppError("User.IsValid", "Invalid email", "user_id="+u.Id)
	}

	if len(u.Nickname) > 64 {
		return NewAppError("User.IsValid", "Invalid nickname", "user_id="+u.Id)
	}

	if len(u.FirstName) > 64 {
		return NewAppError("User.IsValid", "Invalid first name", "user_id="+u.Id)
	}

	if len(u.LastName) > 64 {
		return NewAppError("User.IsValid", "Invalid last name", "user_id="+u.Id)
	}

	if len(u.Password) > 128 {
		return NewAppError("User.IsValid", "Invalid password", "user_id="+u.Id)
	}

	if len(u.AuthData) > 128 {
		return NewAppError("User.IsValid", "Invalid auth data", "user_id="+u.Id)
	}

	if len(u.AuthData) > 0 && len(u.AuthService) == 0 {
		return NewAppError("User.IsValid", "Invalid user, auth data must be set with auth type", "user_id="+u.Id)
	}

	if len(u.Password) > 0 && len(u.AuthData) > 0 {
		return NewAppError("User.IsValid", "Invalid user, password and auth data cannot both be set", "user_id="+u.Id)
	}

	if len(u.ThemeProps) > 2000 {
		return NewAppError("User.IsValid", "Invalid theme", "user_id="+u.Id)
	}

	return nil
}

// PreSave will set the Id and Username if missing.  It will also fill
// in the CreateAt, UpdateAt times.  It will also hash the password.  It should
// be run before saving the user to the db.
func (u *User) PreSave() {
	if u.Id == "" {
		u.Id = NewId()
	}

	if u.Username == "" {
		u.Username = NewId()
	}

	u.Username = strings.ToLower(u.Username)
	u.Email = strings.ToLower(u.Email)

	u.CreateAt = GetMillis()
	u.UpdateAt = u.CreateAt

	u.LastPasswordUpdate = u.CreateAt

	if u.Props == nil {
		u.Props = make(map[string]string)
	}

	if u.NotifyProps == nil || len(u.NotifyProps) == 0 {
		u.SetDefaultNotifications()
	}

	if len(u.Password) > 0 {
		u.Password = HashPassword(u.Password)
	}
}

// PreUpdate should be run before updating the user in the db.
func (u *User) PreUpdate() {
	u.Username = strings.ToLower(u.Username)
	u.Email = strings.ToLower(u.Email)
	u.UpdateAt = GetMillis()

	if u.NotifyProps == nil || len(u.NotifyProps) == 0 {
		u.SetDefaultNotifications()
	} else if _, ok := u.NotifyProps["mention_keys"]; ok {
		// Remove any blank mention keys
		splitKeys := strings.Split(u.NotifyProps["mention_keys"], ",")
		goodKeys := []string{}
		for _, key := range splitKeys {
			if len(key) > 0 {
				goodKeys = append(goodKeys, strings.ToLower(key))
			}
		}
		u.NotifyProps["mention_keys"] = strings.Join(goodKeys, ",")
	}
}

func (u *User) SetDefaultNotifications() {
	u.NotifyProps = make(map[string]string)
	u.NotifyProps["email"] = "true"
	u.NotifyProps["desktop"] = USER_NOTIFY_ALL
	u.NotifyProps["desktop_sound"] = "true"
	u.NotifyProps["mention_keys"] = u.Username + ",@" + u.Username
	u.NotifyProps["first_name"] = "false"
	u.NotifyProps["all"] = "true"
	u.NotifyProps["channel"] = "true"
	splitName := strings.Split(u.Nickname, " ")
	if len(splitName) > 0 && splitName[0] != "" {
		u.NotifyProps["first_name"] = "true"
		u.NotifyProps["mention_keys"] += "," + splitName[0]
	}
}

// ToJson convert a User to a json string
func (u *User) ToJson() string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

// Generate a valid strong etag so the browser can cache the results
func (u *User) Etag() string {
	return Etag(u.Id, u.UpdateAt)
}

func (u *User) IsOffline() bool {
	return (GetMillis()-u.LastPingAt) > USER_OFFLINE_TIMEOUT && (GetMillis()-u.LastActivityAt) > USER_OFFLINE_TIMEOUT
}

func (u *User) IsAway() bool {
	return (GetMillis() - u.LastActivityAt) > USER_AWAY_TIMEOUT
}

// Remove any private data from the user object
func (u *User) Sanitize(options map[string]bool) {
	u.Password = ""
	u.AuthData = ""

	if len(options) != 0 && !options["email"] {
		u.Email = ""
	}
	if len(options) != 0 && !options["fullname"] {
		u.FirstName = ""
		u.LastName = ""
	}
	if len(options) != 0 && !options["skypeid"] {
		// TODO - fill in when SkypeId is added to user model
	}
	if len(options) != 0 && !options["phonenumber"] {
		// TODO - fill in when PhoneNumber is added to user model
	}
	if len(options) != 0 && !options["passwordupdate"] {
		u.LastPasswordUpdate = 0
	}
}

func (u *User) MakeNonNil() {
	if u.Props == nil {
		u.Props = make(map[string]string)
	}

	if u.NotifyProps == nil {
		u.NotifyProps = make(map[string]string)
	}
}

func (u *User) AddProp(key string, value string) {
	u.MakeNonNil()

	u.Props[key] = value
}

func (u *User) AddNotifyProp(key string, value string) {
	u.MakeNonNil()

	u.NotifyProps[key] = value
}

func (u *User) GetFullName() string {
	if u.FirstName != "" && u.LastName != "" {
		return u.FirstName + " " + u.LastName
	} else if u.FirstName != "" {
		return u.FirstName
	} else if u.LastName != "" {
		return u.LastName
	} else {
		return ""
	}
}

func (u *User) GetDisplayName() string {
	if u.Nickname != "" {
		return u.Nickname
	} else if fullName := u.GetFullName(); fullName != "" {
		return fullName
	} else {
		return u.Username
	}
}

func IsValidRoles(userRoles string) bool {

	roles := strings.Split(userRoles, " ")

	for _, r := range roles {
		if !isValidRole(r) {
			return false
		}
	}

	return true
}

func isValidRole(role string) bool {
	if role == "" {
		return true
	}

	if role == ROLE_TEAM_ADMIN {
		return true
	}

	if role == ROLE_SYSTEM_ADMIN {
		return true
	}

	return false
}

// Make sure you acually want to use this function. In context.go there are functions to check permssions
// This function should not be used to check permissions.
func (u *User) IsInRole(inRole string) bool {
	return IsInRole(u.Roles, inRole)
}

// Make sure you acually want to use this function. In context.go there are functions to check permssions
// This function should not be used to check permissions.
func IsInRole(userRoles string, inRole string) bool {
	roles := strings.Split(userRoles, " ")

	for _, r := range roles {
		if r == inRole {
			return true
		}

	}

	return false
}

func (u *User) PreExport() {
	u.Password = ""
	u.AuthData = ""
	u.LastActivityAt = 0
	u.LastPingAt = 0
	u.LastPasswordUpdate = 0
	u.LastPictureUpdate = 0
	u.FailedAttempts = 0
}

// UserFromJson will decode the input and return a User
func UserFromJson(data io.Reader) *User {
	decoder := json.NewDecoder(data)
	var user User
	err := decoder.Decode(&user)
	if err == nil {
		return &user
	} else {
		return nil
	}
}

func UserMapToJson(u map[string]*User) string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserMapFromJson(data io.Reader) map[string]*User {
	decoder := json.NewDecoder(data)
	var users map[string]*User
	err := decoder.Decode(&users)
	if err == nil {
		return users
	} else {
		return nil
	}
}

// HashPassword generates a hash using the bcrypt.GenerateFromPassword
func HashPassword(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		panic(err)
	}

	return string(hash)
}

// ComparePassword compares the hash
func ComparePassword(hash string, password string) bool {

	if len(password) == 0 {
		return false
	}

	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

var validUsernameChars = regexp.MustCompile(`^[a-z0-9\.\-_]+$`)

var restrictedUsernames = []string{
	"all",
	"channel",
}

func IsValidUsername(s string) bool {
	if len(s) == 0 || len(s) > 64 {
		return false
	}

	if !validUsernameChars.MatchString(s) {
		return false
	}

	for _, restrictedUsername := range restrictedUsernames {
		if s == restrictedUsername {
			return false
		}
	}

	return true
}

func CleanUsername(s string) string {
	s = strings.ToLower(strings.Replace(s, " ", "-", -1))

	for _, value := range reservedName {
		if s == value {
			s = strings.Replace(s, value, "", -1)
		}
	}

	s = strings.TrimSpace(s)

	for _, c := range s {
		char := fmt.Sprintf("%c", c)
		if !validUsernameChars.MatchString(char) {
			s = strings.Replace(s, char, "-", -1)
		}
	}

	s = strings.Trim(s, "-")

	if !IsValidUsername(s) {
		s = "a" + NewId()
	}

	return s
}
