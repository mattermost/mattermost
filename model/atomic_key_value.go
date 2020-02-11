// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"time"
	"unicode/utf8"
)

const ATOMIC_KEY_VALUE_KEY_MAX_RUNES = 255

type AtomicKeyValue struct {
	Key          string `json:"key" db:"AKey"`
	Value        []byte `json:"value" db:"AValue"`
	ExpireAt     int64  `json:"expire_at"`
	UpdateAt     int64  `json:"update_at"`
	ExpireInSecs int64  `db:"-"`
}

func (kv *AtomicKeyValue) PreSave() {
	if kv.ExpireAt == 0 && kv.ExpireInSecs > 0 {
		kv.ExpireAt = time.Now().UnixNano()/1000 + kv.ExpireInSecs*1000
	}
}

func (kv *AtomicKeyValue) IsValid() *AppError {
	if len(kv.Key) == 0 || utf8.RuneCountInString(kv.Key) > KEY_VALUE_KEY_MAX_RUNES {
		return NewAppError("AtomicKeyValue.IsValid", "model.atomic_key_value.is_valid.key.app_error", map[string]interface{}{"Max": ATOMIC_KEY_VALUE_KEY_MAX_RUNES, "Min": 0}, "key="+kv.Key, http.StatusBadRequest)
	}
	return nil
}
