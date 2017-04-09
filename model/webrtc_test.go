// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestWebrtcJson(t *testing.T) {
	o := WebrtcInfoResponse{Token: NewId(), GatewayUrl: NewId()}
	json := o.ToJson()
	ro := WebrtcInfoResponseFromJson(strings.NewReader(json))

	if o.Token != ro.Token {
		t.Fatal("Tokens do not match")
	}
}
