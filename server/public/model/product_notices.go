// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"

	"github.com/pkg/errors"
)

type ProductNotices []ProductNotice

func (r *ProductNotices) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

func UnmarshalProductNotices(data []byte) (ProductNotices, error) {
	var r ProductNotices
	err := json.Unmarshal(data, &r)
	return r, err
}

// List of product notices. Order is important and is used to resolve priorities.
// Each notice will only be show if conditions are met.
type ProductNotice struct {
	Conditions        Conditions                       `json:"conditions"`
	ID                string                           `json:"id"`                   // Unique identifier for this notice. Can be a running number. Used for storing 'viewed'; state on the server.
	LocalizedMessages map[string]NoticeMessageInternal `json:"localizedMessages"`    // Notice message data, organized by locale.; Example:; "localizedMessages": {; "en": { "title": "English", description: "English description"},; "frFR": { "title": "Frances", description: "French description"}; }
	Repeatable        *bool                            `json:"repeatable,omitempty"` // Configurable flag if the notice should reappear after it’s seen and dismissed
}

func (n *ProductNotice) SysAdminOnly() bool {
	return n.Conditions.Audience != nil && *n.Conditions.Audience == NoticeAudienceSysadmin
}

func (n *ProductNotice) TeamAdminOnly() bool {
	return n.Conditions.Audience != nil && *n.Conditions.Audience == NoticeAudienceTeamAdmin
}

type Conditions struct {
	Audience              *NoticeAudience     `json:"audience,omitempty"`
	ClientType            *NoticeClientType   `json:"clientType,omitempty"`     // Only show the notice on specific clients. Defaults to 'all'
	DesktopVersion        []string            `json:"desktopVersion,omitempty"` // What desktop client versions does this notice apply to.; Format: semver ranges (https://devhints.io/semver); Example: [">=1.2.3 < ~2.4.x"]; Example: ["<v5.19", "v5.20-v5.22"]
	DisplayDate           *string             `json:"displayDate,omitempty"`    // When to display the notice.; Examples:; "2020-03-01T00:00:00Z" - show on specified date; ">= 2020-03-01T00:00:00Z" - show after specified date; "< 2020-03-01T00:00:00Z" - show before the specified date; "> 2020-03-01T00:00:00Z <= 2020-04-01T00:00:00Z" - show only between the specified dates
	InstanceType          *NoticeInstanceType `json:"instanceType,omitempty"`
	MobileVersion         []string            `json:"mobileVersion,omitempty"` // What mobile client versions does this notice apply to.; Format: semver ranges (https://devhints.io/semver); Example: [">=1.2.3 < ~2.4.x"]; Example: ["<v5.19", "v5.20-v5.22"]
	NumberOfPosts         *int64              `json:"numberOfPosts,omitempty"` // Only show the notice when server has more than specified number of posts
	NumberOfUsers         *int64              `json:"numberOfUsers,omitempty"` // Only show the notice when server has more than specified number of users
	ServerConfig          map[string]any      `json:"serverConfig,omitempty"`  // Map of mattermost server config paths and their values. Notice will be displayed only if; the values match the target server config; Example: serverConfig: { "PluginSettings.Enable": true, "GuestAccountsSettings.Enable":; false }
	ServerVersion         []string            `json:"serverVersion,omitempty"` // What server versions does this notice apply to.; Format: semver ranges (https://devhints.io/semver); Example: [">=1.2.3 < ~2.4.x"]; Example: ["<v5.19", "v5.20-v5.22"]
	Sku                   *NoticeSKU          `json:"sku,omitempty"`
	UserConfig            map[string]any      `json:"userConfig,omitempty"`             // Map of user's settings and their values. Notice will be displayed only if the values; match the viewing users' config; Example: userConfig: { "new_sidebar.disabled": true }
	DeprecatingDependency *ExternalDependency `json:"deprecating_dependency,omitempty"` // External dependency which is going to be deprecated
}

type NoticeMessageInternal struct {
	Action      *NoticeAction `json:"action,omitempty"`      // Optional action to perform on action button click. (defaults to closing the notice)
	ActionParam *string       `json:"actionParam,omitempty"` // Optional action parameter.; Example: {"action": "url", actionParam: "/console/some-page"}
	ActionText  *string       `json:"actionText,omitempty"`  // Optional override for the action button text (defaults to OK)
	Description string        `json:"description"`           // Notice content. Use {{Mattermost}} instead of plain text to support white-labeling. Text; supports Markdown.
	Image       *string       `json:"image,omitempty"`
	Title       string        `json:"title"` // Notice title. Use {{Mattermost}} instead of plain text to support white-labeling. Text; supports Markdown.
}
type NoticeMessages []NoticeMessage

type NoticeMessage struct {
	NoticeMessageInternal
	ID            string `json:"id"`
	SysAdminOnly  bool   `json:"sysAdminOnly"`
	TeamAdminOnly bool   `json:"teamAdminOnly"`
}

func (r *NoticeMessages) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

func UnmarshalProductNoticeMessages(data io.Reader) (NoticeMessages, error) {
	var r NoticeMessages
	err := json.NewDecoder(data).Decode(&r)
	return r, err
}

// User role, i.e. who will see the notice. Defaults to "all"
type NoticeAudience string

func NewNoticeAudience(s NoticeAudience) *NoticeAudience {
	return &s
}

func (a *NoticeAudience) Matches(sysAdmin bool, teamAdmin bool) bool {
	switch *a {
	case NoticeAudienceAll:
		return true
	case NoticeAudienceMember:
		return !sysAdmin && !teamAdmin
	case NoticeAudienceSysadmin:
		return sysAdmin
	case NoticeAudienceTeamAdmin:
		return teamAdmin
	}
	return false
}

const (
	NoticeAudienceAll       NoticeAudience = "all"
	NoticeAudienceMember    NoticeAudience = "member"
	NoticeAudienceSysadmin  NoticeAudience = "sysadmin"
	NoticeAudienceTeamAdmin NoticeAudience = "teamadmin"
)

// Only show the notice on specific clients. Defaults to 'all'
//
// Client type. Defaults to "all"
type NoticeClientType string

func NewNoticeClientType(s NoticeClientType) *NoticeClientType { return &s }

func (c *NoticeClientType) Matches(other NoticeClientType) bool {
	switch *c {
	case NoticeClientTypeAll:
		return true
	case NoticeClientTypeMobile:
		return other == NoticeClientTypeMobileIos || other == NoticeClientTypeMobileAndroid
	default:
		return *c == other
	}
}

const (
	NoticeClientTypeAll           NoticeClientType = "all"
	NoticeClientTypeDesktop       NoticeClientType = "desktop"
	NoticeClientTypeMobile        NoticeClientType = "mobile"
	NoticeClientTypeMobileAndroid NoticeClientType = "mobile-android"
	NoticeClientTypeMobileIos     NoticeClientType = "mobile-ios"
	NoticeClientTypeWeb           NoticeClientType = "web"
)

func NoticeClientTypeFromString(s string) (NoticeClientType, error) {
	switch s {
	case "web":
		return NoticeClientTypeWeb, nil
	case "mobile-ios":
		return NoticeClientTypeMobileIos, nil
	case "mobile-android":
		return NoticeClientTypeMobileAndroid, nil
	case "desktop":
		return NoticeClientTypeDesktop, nil
	}
	return NoticeClientTypeAll, errors.New("Invalid client type supplied")
}

// Instance type. Defaults to "both"
type NoticeInstanceType string

func NewNoticeInstanceType(n NoticeInstanceType) *NoticeInstanceType { return &n }
func (t *NoticeInstanceType) Matches(isCloud bool) bool {
	if *t == NoticeInstanceTypeBoth {
		return true
	}
	if *t == NoticeInstanceTypeCloud && !isCloud {
		return false
	}
	if *t == NoticeInstanceTypeOnPrem && isCloud {
		return false
	}
	return true
}

const (
	NoticeInstanceTypeBoth   NoticeInstanceType = "both"
	NoticeInstanceTypeCloud  NoticeInstanceType = "cloud"
	NoticeInstanceTypeOnPrem NoticeInstanceType = "onprem"
)

// SKU. Defaults to "all"
type NoticeSKU string

func NewNoticeSKU(s NoticeSKU) *NoticeSKU { return &s }
func (c *NoticeSKU) Matches(s string) bool {
	switch *c {
	case NoticeSKUAll:
		return true
	case NoticeSKUE0, NoticeSKUTeam:
		return s == ""
	default:
		return s == string(*c)
	}
}

const (
	NoticeSKUE0   NoticeSKU = "e0"
	NoticeSKUE10  NoticeSKU = "e10"
	NoticeSKUE20  NoticeSKU = "e20"
	NoticeSKUAll  NoticeSKU = "all"
	NoticeSKUTeam NoticeSKU = "team"
)

// Optional action to perform on action button click. (defaults to closing the notice)
//
// Possible actions to execute on button press
type NoticeAction string

const (
	URL NoticeAction = "url"
)

// Definition of the table keeping the 'viewed' state of each in-product notice per user
type ProductNoticeViewState struct {
	UserId    string
	NoticeId  string
	Viewed    int32
	Timestamp int64
}

type ExternalDependency struct {
	Name           string `json:"name"`
	MinimumVersion string `json:"minimum_version"`
}
