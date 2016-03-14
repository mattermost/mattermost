// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SESSION_COOKIE_TOKEN  = "MMAUTHTOKEN"
	SESSION_CACHE_SIZE    = 10000
	SESSION_PROP_PLATFORM = "platform"
	SESSION_PROP_OS       = "os"
	SESSION_PROP_BROWSER  = "browser"
)

type Session struct {
	Id             string    `json:"id"`
	Token          string    `json:"token"`
	CreateAt       int64     `json:"create_at"`
	ExpiresAt      int64     `json:"expires_at"`
	LastActivityAt int64     `json:"last_activity_at"`
	UserId         string    `json:"user_id"`
	TeamId         string    `json:"team_id"`
	DeviceId       string    `json:"device_id"`
	Roles          string    `json:"roles"`
	IsOAuth        bool      `json:"is_oauth"`
	Props          StringMap `json:"props"`
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

	me.Token = NewId()

	me.CreateAt = GetMillis()
	me.LastActivityAt = me.CreateAt

	if me.Props == nil {
		me.Props = make(map[string]string)
	}
}

func (me *Session) Sanitize() {
	me.Token = ""
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

func (me *Session) SetExpireInDays(days int) {
	me.ExpiresAt = GetMillis() + (1000 * 60 * 60 * 24 * int64(days))
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
