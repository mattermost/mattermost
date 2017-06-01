// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestWebrtcInfoResponseToFromJson(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	o := WebrtcInfoResponse{Token: NewId(), GatewayUrl: NewId()}
	json := o.ToJson()
	ro := WebrtcInfoResponseFromJson(strings.NewReader(json))

	CheckString(t, ro.Token, o.Token)
	CheckString(t, ro.GatewayUrl, o.GatewayUrl)

	invalidJson := `{"wat"`
	r := WebrtcInfoResponseFromJson(strings.NewReader(invalidJson))
	if r != nil {
		t.Fatalf("Should have failed")
	}
}

func TestGatewayResponseFromJson(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	// Valid Gateway Response
	s1 := `{"janus": "something"}`
	g1 := GatewayResponseFromJson(strings.NewReader(s1))

	CheckString(t, g1.Status, "something")

	// Malformed JSON
	s2 := `{"wat"`
	g2 := GatewayResponseFromJson(strings.NewReader(s2))

	if g2 != nil {
		t.Fatal("expected nil")
	}
}
