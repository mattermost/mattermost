// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestSwitchRequestJson(t *testing.T) {
	o := SwitchRequest{Email: NewId(), Password: NewId()}
	json := o.ToJson()
	ro := SwitchRequestFromJson(strings.NewReader(json))

	if o.Email != ro.Email {
		t.Fatal("Emails do not match")
	}
}
