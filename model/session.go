// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SESSION_TOKEN               = "MMSID"
	SESSION_TIME_WEB_IN_DAYS    = 30
	SESSION_TIME_WEB_IN_SECS    = 60 * 60 * 24 * SESSION_TIME_WEB_IN_DAYS
	SESSION_TIME_MOBILE_IN_DAYS = 30
	SESSION_TIME_MOBILE_IN_SECS = 60 * 60 * 24 * SESSION_TIME_MOBILE_IN_DAYS
	SESSION_TIME_OAUTH_IN_DAYS  = 365
	SESSION_TIME_OAUTH_IN_SECS  = 60 * 60 * 24 * SESSION_TIME_OAUTH_IN_DAYS
	SESSION_CACHE_IN_SECS       = 60 * 10
	SESSION_CACHE_SIZE          = 10000
	SESSION_PROP_PLATFORM       = "platform"
	SESSION_PROP_OS             = "os"
	SESSION_PROP_BROWSER        = "browser"
)

type Session struct {
	Id             string    `json:"id"`
	AltId          string    `json:"alt_id"`
	CreateAt       int64     `json:"create_at"`
	ExpiresAt      int64     `json:"expires_at"`
	LastActivityAt int64     `json:"last_activity_at"`
	UserId         string    `json:"user_id"`
	TeamId         string    `json:"team_id"`
	DeviceId       string    `json:"device_id"`
	Roles          string    `json:"roles"`
	Props          StringMap `json:"props"`
	AccessToken    string    `json:"access_token"`
}

func (me *Session) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func SessionFromJson(data io.Reader) *Session {
	decoder := json.NewDecoder(data)
	var me Session
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}

func (me *Session) PreSave() {
	if me.Id == "" {
		me.Id = NewId()
	}

	me.AltId = NewId()

	me.CreateAt = GetMillis()
	me.LastActivityAt = me.CreateAt

	if me.Props == nil {
		me.Props = make(map[string]string)
	}
}

func (me *Session) Sanitize() {
	me.Id = ""
	me.AccessToken = ""
}

func (me *Session) IsExpired() bool {

	if me.ExpiresAt <= 0 {
		return false
	}

	if GetMillis() > me.ExpiresAt {
		return true
	}

	return false
}

func (me *Session) SetExpireInDays(days int64) {
	me.ExpiresAt = GetMillis() + (1000 * 60 * 60 * 24 * days)
}

func (me *Session) AddProp(key string, value string) {

	if me.Props == nil {
		me.Props = make(map[string]string)
	}

	me.Props[key] = value
}

func SessionsToJson(o []*Session) string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func SessionsFromJson(data io.Reader) []*Session {
	decoder := json.NewDecoder(data)
	var o []*Session
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}
