// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/text/language"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/public/shared/timezones"
)

const (
	Me                             = "me"
	UserNotifyAll                  = "all"
	UserNotifyHere                 = "here"
	UserNotifyMention              = "mention"
	UserNotifyNone                 = "none"
	DesktopNotifyProp              = "desktop"
	DesktopSoundNotifyProp         = "desktop_sound"
	MarkUnreadNotifyProp           = "mark_unread"
	PushNotifyProp                 = "push"
	PushStatusNotifyProp           = "push_status"
	EmailNotifyProp                = "email"
	ChannelMentionsNotifyProp      = "channel"
	CommentsNotifyProp             = "comments"
	MentionKeysNotifyProp          = "mention_keys"
	CommentsNotifyNever            = "never"
	CommentsNotifyRoot             = "root"
	CommentsNotifyAny              = "any"
	CommentsNotifyCRT              = "crt"
	FirstNameNotifyProp            = "first_name"
	AutoResponderActiveNotifyProp  = "auto_responder_active"
	AutoResponderMessageNotifyProp = "auto_responder_message"
	DesktopThreadsNotifyProp       = "desktop_threads"
	PushThreadsNotifyProp          = "push_threads"
	EmailThreadsNotifyProp         = "email_threads"

	DefaultLocale        = "en"
	UserAuthServiceEmail = "email"

	UserEmailMaxLength    = 128
	UserNicknameMaxRunes  = 64
	UserPositionMaxRunes  = 128
	UserFirstNameMaxRunes = 64
	UserLastNameMaxRunes  = 64
	UserAuthDataMaxLength = 128
	UserNameMaxLength     = 64
	UserNameMinLength     = 1
	UserPasswordMaxLength = 72
	UserLocaleMaxLength   = 5
	UserTimezoneMaxRunes  = 256
	UserRolesMaxLength    = 256
)

//msgp:tuple User

// User contains the details about the user.
// This struct's serializer methods are auto-generated. If a new field is added/removed,
// please run make gen-serialized.
type User struct {
	Id                     string    `json:"id"`
	CreateAt               int64     `json:"create_at,omitempty"`
	UpdateAt               int64     `json:"update_at,omitempty"`
	DeleteAt               int64     `json:"delete_at"`
	Username               string    `json:"username"`
	Password               string    `json:"password,omitempty"`
	AuthData               *string   `json:"auth_data,omitempty"`
	AuthService            string    `json:"auth_service"`
	Email                  string    `json:"email"`
	EmailVerified          bool      `json:"email_verified,omitempty"`
	Nickname               string    `json:"nickname"`
	FirstName              string    `json:"first_name"`
	LastName               string    `json:"last_name"`
	Position               string    `json:"position"`
	Roles                  string    `json:"roles"`
	AllowMarketing         bool      `json:"allow_marketing,omitempty"`
	Props                  StringMap `json:"props,omitempty"`
	NotifyProps            StringMap `json:"notify_props,omitempty"`
	LastPasswordUpdate     int64     `json:"last_password_update,omitempty"`
	LastPictureUpdate      int64     `json:"last_picture_update,omitempty"`
	FailedAttempts         int       `json:"failed_attempts,omitempty"`
	Locale                 string    `json:"locale"`
	Timezone               StringMap `json:"timezone"`
	MfaActive              bool      `json:"mfa_active,omitempty"`
	MfaSecret              string    `json:"mfa_secret,omitempty"`
	RemoteId               *string   `json:"remote_id,omitempty"`
	LastActivityAt         int64     `json:"last_activity_at,omitempty"`
	IsBot                  bool      `json:"is_bot,omitempty"`
	BotDescription         string    `json:"bot_description,omitempty"`
	BotLastIconUpdate      int64     `json:"bot_last_icon_update,omitempty"`
	TermsOfServiceId       string    `json:"terms_of_service_id,omitempty"`
	TermsOfServiceCreateAt int64     `json:"terms_of_service_create_at,omitempty"`
	DisableWelcomeEmail    bool      `json:"disable_welcome_email"`
}

func (u *User) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":                         u.Id,
		"create_at":                  u.CreateAt,
		"update_at":                  u.UpdateAt,
		"delete_at":                  u.DeleteAt,
		"username":                   u.Username,
		"auth_service":               u.AuthService,
		"email":                      u.Email,
		"email_verified":             u.EmailVerified,
		"position":                   u.Position,
		"roles":                      u.Roles,
		"allow_marketing":            u.AllowMarketing,
		"props":                      u.Props,
		"notify_props":               u.NotifyProps,
		"last_password_update":       u.LastPasswordUpdate,
		"last_picture_update":        u.LastPictureUpdate,
		"failed_attempts":            u.FailedAttempts,
		"locale":                     u.Locale,
		"timezone":                   u.Timezone,
		"mfa_active":                 u.MfaActive,
		"remote_id":                  u.RemoteId,
		"last_activity_at":           u.LastActivityAt,
		"is_bot":                     u.IsBot,
		"bot_description":            u.BotDescription,
		"bot_last_icon_update":       u.BotLastIconUpdate,
		"terms_of_service_id":        u.TermsOfServiceId,
		"terms_of_service_create_at": u.TermsOfServiceCreateAt,
		"disable_welcome_email":      u.DisableWelcomeEmail,
	}
}

//msgp UserMap

// UserMap is a map from a userId to a user object.
// It is used to generate methods which can be used for fast serialization/de-serialization.
type UserMap map[string]*User

//msgp:ignore UserUpdate
type UserUpdate struct {
	Old *User
	New *User
}

//msgp:ignore UserPatch
type UserPatch struct {
	Username    *string   `json:"username"`
	Password    *string   `json:"password,omitempty"`
	Nickname    *string   `json:"nickname"`
	FirstName   *string   `json:"first_name"`
	LastName    *string   `json:"last_name"`
	Position    *string   `json:"position"`
	Email       *string   `json:"email"`
	Props       StringMap `json:"props,omitempty"`
	NotifyProps StringMap `json:"notify_props,omitempty"`
	Locale      *string   `json:"locale"`
	Timezone    StringMap `json:"timezone"`
	RemoteId    *string   `json:"remote_id"`
}

func (u *UserPatch) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"username":     u.Username,
		"nickname":     u.Nickname,
		"first_name":   u.FirstName,
		"last_name":    u.LastName,
		"position":     u.Position,
		"email":        u.Email,
		"props":        u.Props,
		"notify_props": u.NotifyProps,
		"locale":       u.Locale,
		"timezone":     u.Timezone,
		"remote_id":    u.RemoteId,
	}
}

//msgp:ignore UserAuth
type UserAuth struct {
	Password    string  `json:"password,omitempty"` // DEPRECATED: It is not used.
	AuthData    *string `json:"auth_data,omitempty"`
	AuthService string  `json:"auth_service,omitempty"`
}

func (u *UserAuth) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"auth_service": u.AuthService,
	}
}

//msgp:ignore UserForIndexing
type UserForIndexing struct {
	Id          string   `json:"id"`
	Username    string   `json:"username"`
	Nickname    string   `json:"nickname"`
	FirstName   string   `json:"first_name"`
	LastName    string   `json:"last_name"`
	Roles       string   `json:"roles"`
	CreateAt    int64    `json:"create_at"`
	DeleteAt    int64    `json:"delete_at"`
	TeamsIds    []string `json:"team_id"`
	ChannelsIds []string `json:"channel_id"`
}

//msgp:ignore ViewUsersRestrictions
type ViewUsersRestrictions struct {
	Teams    []string
	Channels []string
}

func (r *ViewUsersRestrictions) Hash() string {
	if r == nil {
		return ""
	}
	ids := append(r.Teams, r.Channels...)
	sort.Strings(ids)
	hash := sha256.New()
	hash.Write([]byte(strings.Join(ids, "")))
	return fmt.Sprintf("%x", hash.Sum(nil))
}

//msgp:ignore UserSlice
type UserSlice []*User

func (u UserSlice) Usernames() []string {
	usernames := []string{}
	for _, user := range u {
		usernames = append(usernames, user.Username)
	}
	sort.Strings(usernames)
	return usernames
}

func (u UserSlice) IDs() []string {
	ids := []string{}
	for _, user := range u {
		ids = append(ids, user.Id)
	}
	return ids
}

func (u UserSlice) FilterWithoutBots() UserSlice {
	var matches []*User

	for _, user := range u {
		if !user.IsBot {
			matches = append(matches, user)
		}
	}
	return UserSlice(matches)
}

func (u UserSlice) FilterByActive(active bool) UserSlice {
	var matches []*User

	for _, user := range u {
		if user.DeleteAt == 0 && active {
			matches = append(matches, user)
		} else if user.DeleteAt != 0 && !active {
			matches = append(matches, user)
		}
	}
	return UserSlice(matches)
}

func (u UserSlice) FilterByID(ids []string) UserSlice {
	var matches []*User
	for _, user := range u {
		for _, id := range ids {
			if id == user.Id {
				matches = append(matches, user)
			}
		}
	}
	return UserSlice(matches)
}

func (u UserSlice) FilterWithoutID(ids []string) UserSlice {
	var keep []*User
	for _, user := range u {
		present := false
		for _, id := range ids {
			if id == user.Id {
				present = true
			}
		}
		if !present {
			keep = append(keep, user)
		}
	}
	return UserSlice(keep)
}

func (u *User) DeepCopy() *User {
	copyUser := *u
	if u.AuthData != nil {
		copyUser.AuthData = NewString(*u.AuthData)
	}
	if u.Props != nil {
		copyUser.Props = CopyStringMap(u.Props)
	}
	if u.NotifyProps != nil {
		copyUser.NotifyProps = CopyStringMap(u.NotifyProps)
	}
	if u.Timezone != nil {
		copyUser.Timezone = CopyStringMap(u.Timezone)
	}
	return &copyUser
}

// IsValid validates the user and returns an error if it isn't configured
// correctly.
func (u *User) IsValid() *AppError {
	if !IsValidId(u.Id) {
		return InvalidUserError("id", "", u.Id)
	}

	if u.CreateAt == 0 {
		return InvalidUserError("create_at", u.Id, u.CreateAt)
	}

	if u.UpdateAt == 0 {
		return InvalidUserError("update_at", u.Id, u.UpdateAt)
	}

	if u.IsRemote() {
		if !IsValidUsernameAllowRemote(u.Username) {
			return InvalidUserError("username", u.Id, u.Username)
		}
	} else {
		if !IsValidUsername(u.Username) {
			return InvalidUserError("username", u.Id, u.Username)
		}
	}

	if len(u.Email) > UserEmailMaxLength || u.Email == "" || !IsValidEmail(u.Email) {
		return InvalidUserError("email", u.Id, u.Email)
	}

	if utf8.RuneCountInString(u.Nickname) > UserNicknameMaxRunes {
		return InvalidUserError("nickname", u.Id, u.Nickname)
	}

	if utf8.RuneCountInString(u.Position) > UserPositionMaxRunes {
		return InvalidUserError("position", u.Id, u.Position)
	}

	if utf8.RuneCountInString(u.FirstName) > UserFirstNameMaxRunes {
		return InvalidUserError("first_name", u.Id, u.FirstName)
	}

	if utf8.RuneCountInString(u.LastName) > UserLastNameMaxRunes {
		return InvalidUserError("last_name", u.Id, u.LastName)
	}

	if u.AuthData != nil && len(*u.AuthData) > UserAuthDataMaxLength {
		return InvalidUserError("auth_data", u.Id, u.AuthData)
	}

	if u.AuthData != nil && *u.AuthData != "" && u.AuthService == "" {
		return InvalidUserError("auth_data_type", u.Id, *u.AuthData+" "+u.AuthService)
	}

	if u.Password != "" && u.AuthData != nil && *u.AuthData != "" {
		return InvalidUserError("auth_data_pwd", u.Id, *u.AuthData)
	}

	if len(u.Password) > UserPasswordMaxLength {
		return InvalidUserError("password_limit", u.Id, "")
	}

	if !IsValidLocale(u.Locale) {
		return InvalidUserError("locale", u.Id, u.Locale)
	}

	if len(u.Timezone) > 0 {
		if tzJSON, err := json.Marshal(u.Timezone); err != nil {
			return NewAppError("User.IsValid", "model.user.is_valid.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		} else if utf8.RuneCount(tzJSON) > UserTimezoneMaxRunes {
			return InvalidUserError("timezone_limit", u.Id, u.Timezone)
		}
	}

	if len(u.Roles) > UserRolesMaxLength {
		return NewAppError("User.IsValid", "model.user.is_valid.roles_limit.app_error",
			map[string]any{"Limit": UserRolesMaxLength}, "user_id="+u.Id+" roles_limit="+u.Roles, http.StatusBadRequest)
	}

	return nil
}

func InvalidUserError(fieldName, userId string, fieldValue any) *AppError {
	id := fmt.Sprintf("model.user.is_valid.%s.app_error", fieldName)
	details := ""
	if userId != "" {
		details = "user_id=" + userId
	}
	details += fmt.Sprintf(" %s=%v", fieldName, fieldValue)
	return NewAppError("User.IsValid", id, nil, details, http.StatusBadRequest)
}

func NormalizeUsername(username string) string {
	return strings.ToLower(username)
}

func NormalizeEmail(email string) string {
	return strings.ToLower(email)
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

	if u.AuthData != nil && *u.AuthData == "" {
		u.AuthData = nil
	}

	u.Username = SanitizeUnicode(u.Username)
	u.FirstName = SanitizeUnicode(u.FirstName)
	u.LastName = SanitizeUnicode(u.LastName)
	u.Nickname = SanitizeUnicode(u.Nickname)

	u.Username = NormalizeUsername(u.Username)
	u.Email = NormalizeEmail(u.Email)

	if u.CreateAt == 0 {
		u.CreateAt = GetMillis()
	}
	u.UpdateAt = u.CreateAt

	u.LastPasswordUpdate = u.CreateAt

	u.MfaActive = false

	if u.Locale == "" {
		u.Locale = DefaultLocale
	}

	if u.Props == nil {
		u.Props = make(map[string]string)
	}

	if u.NotifyProps == nil || len(u.NotifyProps) == 0 {
		u.SetDefaultNotifications()
	}

	if u.Timezone == nil {
		u.Timezone = timezones.DefaultUserTimezone()
	}

	if u.Password != "" {
		u.Password = HashPassword(u.Password)
	}
}

// The following are some GraphQL methods necessary to return the
// data in float64 type. The spec doesn't support 64 bit integers,
// so we have to pass the data in float64. The _ at the end is
// a hack to keep the attribute name same in GraphQL schema.

func (u *User) CreateAt_() float64 {
	return float64(u.CreateAt)
}

func (u *User) DeleteAt_() float64 {
	return float64(u.DeleteAt)
}

func (u *User) UpdateAt_() float64 {
	return float64(u.UpdateAt)
}

func (u *User) LastPictureUpdate_() float64 {
	return float64(u.LastPictureUpdate)
}

func (u *User) LastPasswordUpdate_() float64 {
	return float64(u.LastPasswordUpdate)
}

func (u *User) FailedAttempts_() float64 {
	return float64(u.FailedAttempts)
}

func (u *User) LastActivityAt_() float64 {
	return float64(u.LastActivityAt)
}

func (u *User) BotLastIconUpdate_() float64 {
	return float64(u.BotLastIconUpdate)
}

func (u *User) TermsOfServiceCreateAt_() float64 {
	return float64(u.TermsOfServiceCreateAt)
}

// PreUpdate should be run before updating the user in the db.
func (u *User) PreUpdate() {
	u.Username = SanitizeUnicode(u.Username)
	u.FirstName = SanitizeUnicode(u.FirstName)
	u.LastName = SanitizeUnicode(u.LastName)
	u.Nickname = SanitizeUnicode(u.Nickname)
	u.BotDescription = SanitizeUnicode(u.BotDescription)

	u.Username = NormalizeUsername(u.Username)
	u.Email = NormalizeEmail(u.Email)
	u.UpdateAt = GetMillis()

	u.FirstName = SanitizeUnicode(u.FirstName)
	u.LastName = SanitizeUnicode(u.LastName)
	u.Nickname = SanitizeUnicode(u.Nickname)
	u.BotDescription = SanitizeUnicode(u.BotDescription)

	if u.AuthData != nil && *u.AuthData == "" {
		u.AuthData = nil
	}

	if u.NotifyProps == nil || len(u.NotifyProps) == 0 {
		u.SetDefaultNotifications()
	} else if _, ok := u.NotifyProps[MentionKeysNotifyProp]; ok {
		// Remove any blank mention keys
		splitKeys := strings.Split(u.NotifyProps[MentionKeysNotifyProp], ",")
		goodKeys := []string{}
		for _, key := range splitKeys {
			if key != "" {
				goodKeys = append(goodKeys, strings.ToLower(key))
			}
		}
		u.NotifyProps[MentionKeysNotifyProp] = strings.Join(goodKeys, ",")
	}
}

func (u *User) SetDefaultNotifications() {
	u.NotifyProps = make(map[string]string)
	u.NotifyProps[EmailNotifyProp] = "true"
	u.NotifyProps[PushNotifyProp] = UserNotifyMention
	u.NotifyProps[DesktopNotifyProp] = UserNotifyMention
	u.NotifyProps[DesktopSoundNotifyProp] = "true"
	u.NotifyProps[MentionKeysNotifyProp] = ""
	u.NotifyProps[ChannelMentionsNotifyProp] = "true"
	u.NotifyProps[PushStatusNotifyProp] = StatusAway
	u.NotifyProps[CommentsNotifyProp] = CommentsNotifyNever
	u.NotifyProps[FirstNameNotifyProp] = "false"
	u.NotifyProps[DesktopThreadsNotifyProp] = UserNotifyAll
	u.NotifyProps[EmailThreadsNotifyProp] = UserNotifyAll
	u.NotifyProps[PushThreadsNotifyProp] = UserNotifyAll
}

func (u *User) UpdateMentionKeysFromUsername(oldUsername string) {
	nonUsernameKeys := []string{}
	for _, key := range u.GetMentionKeys() {
		if key != oldUsername && key != "@"+oldUsername {
			nonUsernameKeys = append(nonUsernameKeys, key)
		}
	}

	u.NotifyProps[MentionKeysNotifyProp] = ""
	if len(nonUsernameKeys) > 0 {
		u.NotifyProps[MentionKeysNotifyProp] += "," + strings.Join(nonUsernameKeys, ",")
	}
}

func (u *User) GetMentionKeys() []string {
	var keys []string

	for _, key := range strings.Split(u.NotifyProps[MentionKeysNotifyProp], ",") {
		trimmedKey := strings.TrimSpace(key)

		if trimmedKey == "" {
			continue
		}

		keys = append(keys, trimmedKey)
	}

	return keys
}

func (u *User) Patch(patch *UserPatch) {
	if patch.Username != nil {
		u.Username = *patch.Username
	}

	if patch.Nickname != nil {
		u.Nickname = *patch.Nickname
	}

	if patch.FirstName != nil {
		u.FirstName = *patch.FirstName
	}

	if patch.LastName != nil {
		u.LastName = *patch.LastName
	}

	if patch.Position != nil {
		u.Position = *patch.Position
	}

	if patch.Email != nil {
		u.Email = *patch.Email
	}

	if patch.Props != nil {
		u.Props = patch.Props
	}

	if patch.NotifyProps != nil {
		u.NotifyProps = patch.NotifyProps
	}

	if patch.Locale != nil {
		u.Locale = *patch.Locale
	}

	if patch.Timezone != nil {
		u.Timezone = patch.Timezone
	}

	if patch.RemoteId != nil {
		u.RemoteId = patch.RemoteId
	}
}

// Generate a valid strong etag so the browser can cache the results
func (u *User) Etag(showFullName, showEmail bool) string {
	return Etag(u.Id, u.UpdateAt, u.TermsOfServiceId, u.TermsOfServiceCreateAt, showFullName, showEmail, u.BotLastIconUpdate)
}

// Remove any private data from the user object
func (u *User) Sanitize(options map[string]bool) {
	u.Password = ""
	u.AuthData = NewString("")
	u.MfaSecret = ""

	if len(options) != 0 && !options["email"] {
		u.Email = ""
	}
	if len(options) != 0 && !options["fullname"] {
		u.FirstName = ""
		u.LastName = ""
	}
	if len(options) != 0 && !options["passwordupdate"] {
		u.LastPasswordUpdate = 0
	}
	if len(options) != 0 && !options["authservice"] {
		u.AuthService = ""
	}
}

// Remove any input data from the user object that is not user controlled
func (u *User) SanitizeInput(isAdmin bool) {
	if !isAdmin {
		u.AuthData = NewString("")
		u.AuthService = ""
		u.EmailVerified = false
	}
	u.LastPasswordUpdate = 0
	u.LastPictureUpdate = 0
	u.FailedAttempts = 0
	u.MfaActive = false
	u.MfaSecret = ""
	u.Email = strings.TrimSpace(u.Email)
}

func (u *User) ClearNonProfileFields() {
	u.Password = ""
	u.AuthData = NewString("")
	u.MfaSecret = ""
	u.EmailVerified = false
	u.AllowMarketing = false
	u.NotifyProps = StringMap{}
	u.LastPasswordUpdate = 0
	u.FailedAttempts = 0
}

func (u *User) SanitizeProfile(options map[string]bool) {
	u.ClearNonProfileFields()

	u.Sanitize(options)
}

func (u *User) MakeNonNil() {
	if u.Props == nil {
		u.Props = make(map[string]string)
	}

	if u.NotifyProps == nil {
		u.NotifyProps = make(map[string]string)
	}
}

func (u *User) AddNotifyProp(key string, value string) {
	u.MakeNonNil()

	u.NotifyProps[key] = value
}

func (u *User) SetCustomStatus(cs *CustomStatus) error {
	u.MakeNonNil()
	statusJSON, jsonErr := json.Marshal(cs)
	if jsonErr != nil {
		return jsonErr
	}
	u.Props[UserPropsKeyCustomStatus] = string(statusJSON)
	return nil
}

func (u *User) GetCustomStatus() *CustomStatus {
	var o *CustomStatus

	data := u.Props[UserPropsKeyCustomStatus]
	_ = json.Unmarshal([]byte(data), &o)

	return o
}

func (u *User) CustomStatus() *CustomStatus {
	var o *CustomStatus

	data := u.Props[UserPropsKeyCustomStatus]
	_ = json.Unmarshal([]byte(data), &o)

	return o
}

func (u *User) ClearCustomStatus() {
	u.MakeNonNil()
	u.Props[UserPropsKeyCustomStatus] = ""
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

func (u *User) getDisplayName(baseName, nameFormat string) string {
	displayName := baseName

	if nameFormat == ShowNicknameFullName {
		if u.Nickname != "" {
			displayName = u.Nickname
		} else if fullName := u.GetFullName(); fullName != "" {
			displayName = fullName
		}
	} else if nameFormat == ShowFullName {
		if fullName := u.GetFullName(); fullName != "" {
			displayName = fullName
		}
	}

	return displayName
}

func (u *User) GetDisplayName(nameFormat string) string {
	displayName := u.Username

	return u.getDisplayName(displayName, nameFormat)
}

func (u *User) GetDisplayNameWithPrefix(nameFormat, prefix string) string {
	displayName := prefix + u.Username

	return u.getDisplayName(displayName, nameFormat)
}

func (u *User) GetRoles() []string {
	return strings.Fields(u.Roles)
}

func (u *User) GetRawRoles() string {
	return u.Roles
}

func IsValidUserRoles(userRoles string) bool {

	roles := strings.Fields(userRoles)

	for _, r := range roles {
		if !IsValidRoleName(r) {
			return false
		}
	}

	// Exclude just the system_admin role explicitly to prevent mistakes
	if len(roles) == 1 && roles[0] == "system_admin" {
		return false
	}

	return true
}

// Make sure you actually want to use this function. In context.go there are functions to check permissions
// This function should not be used to check permissions.
func (u *User) IsGuest() bool {
	return IsInRole(u.Roles, SystemGuestRoleId)
}

func (u *User) IsSystemAdmin() bool {
	return IsInRole(u.Roles, SystemAdminRoleId)
}

// Make sure you actually want to use this function. In context.go there are functions to check permissions
// This function should not be used to check permissions.
func (u *User) IsInRole(inRole string) bool {
	return IsInRole(u.Roles, inRole)
}

// Make sure you actually want to use this function. In context.go there are functions to check permissions
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

func (u *User) IsSSOUser() bool {
	return u.AuthService != "" && u.AuthService != UserAuthServiceEmail
}

func (u *User) IsOAuthUser() bool {
	return u.AuthService == ServiceGitlab ||
		u.AuthService == ServiceGoogle ||
		u.AuthService == ServiceOffice365 ||
		u.AuthService == ServiceOpenid
}

func (u *User) IsLDAPUser() bool {
	return u.AuthService == UserAuthServiceLdap
}

func (u *User) IsSAMLUser() bool {
	return u.AuthService == UserAuthServiceSaml
}

func (u *User) GetPreferredTimezone() string {
	return GetPreferredTimezone(u.Timezone)
}

func (u *User) GetTimezoneLocation() *time.Location {
	loc, _ := time.LoadLocation(u.GetPreferredTimezone())
	if loc == nil {
		loc = time.Now().UTC().Location()
	}
	return loc
}

// IsRemote returns true if the user belongs to a remote cluster (has RemoteId).
func (u *User) IsRemote() bool {
	return u.RemoteId != nil && *u.RemoteId != ""
}

// GetRemoteID returns the remote id for this user or "" if not a remote user.
func (u *User) GetRemoteID() string {
	if u.RemoteId != nil {
		return *u.RemoteId
	}
	return ""
}

// GetProp fetches a prop value by name.
func (u *User) GetProp(name string) (string, bool) {
	val, ok := u.Props[name]
	return val, ok
}

// SetProp sets a prop value by name, creating the map if nil.
// Not thread safe.
func (u *User) SetProp(name string, value string) {
	if u.Props == nil {
		u.Props = make(map[string]string)
	}
	u.Props[name] = value
}

func (u *User) ToPatch() *UserPatch {
	return &UserPatch{
		Username: &u.Username, Password: &u.Password,
		Nickname: &u.Nickname, FirstName: &u.FirstName, LastName: &u.LastName,
		Position: &u.Position, Email: &u.Email,
		Props: u.Props, NotifyProps: u.NotifyProps,
		Locale: &u.Locale, Timezone: u.Timezone,
	}
}

func (u *UserPatch) SetField(fieldName string, fieldValue string) {
	switch fieldName {
	case "FirstName":
		u.FirstName = &fieldValue
	case "LastName":
		u.LastName = &fieldValue
	case "Nickname":
		u.Nickname = &fieldValue
	case "Email":
		u.Email = &fieldValue
	case "Position":
		u.Position = &fieldValue
	case "Username":
		u.Username = &fieldValue
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

var validUsernameChars = regexp.MustCompile(`^[a-z0-9\.\-_]+$`)
var validUsernameCharsForRemote = regexp.MustCompile(`^[a-z0-9\.\-_:]+$`)

var restrictedUsernames = map[string]struct{}{
	"all":       {},
	"channel":   {},
	"matterbot": {},
	"system":    {},
}

func IsValidUsername(s string) bool {
	if len(s) < UserNameMinLength || len(s) > UserNameMaxLength {
		return false
	}

	if !validUsernameChars.MatchString(s) {
		return false
	}

	_, found := restrictedUsernames[s]
	return !found
}

func IsValidUsernameAllowRemote(s string) bool {
	if len(s) < UserNameMinLength || len(s) > UserNameMaxLength {
		return false
	}

	if !validUsernameCharsForRemote.MatchString(s) {
		return false
	}

	_, found := restrictedUsernames[s]
	return !found
}

func CleanUsername(username string) string {
	s := NormalizeUsername(strings.Replace(username, " ", "-", -1))

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
		mlog.Warn("Generating new username since provided username was invalid",
			mlog.String("provided_username", username), mlog.String("new_username", s))
	}

	return s
}

func IsValidLocale(locale string) bool {
	if locale != "" {
		if len(locale) > UserLocaleMaxLength {
			return false
		} else if _, err := language.Parse(locale); err != nil {
			return false
		}
	}

	return true
}

//msgp:ignore UserWithGroups
type UserWithGroups struct {
	User
	GroupIDs    *string  `json:"-"`
	Groups      []*Group `json:"groups"`
	SchemeGuest bool     `json:"scheme_guest"`
	SchemeUser  bool     `json:"scheme_user"`
	SchemeAdmin bool     `json:"scheme_admin"`
}

func (u *UserWithGroups) GetGroupIDs() []string {
	if u.GroupIDs == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*u.GroupIDs)
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, ",")
}

//msgp:ignore UsersWithGroupsAndCount
type UsersWithGroupsAndCount struct {
	Users []*UserWithGroups `json:"users"`
	Count int64             `json:"total_count"`
}
