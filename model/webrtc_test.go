// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestWebrtcInfoResponseToFromJson(t *testing.T) {
	o := WebrtcInfoResponse{Token: NewId(), GatewayUrl: NewId()}
	json := o.ToJson()
	ro := WebrtcInfoResponseFromJson(strings.NewReader(json))

	if o.Token != ro.Token {
		t.Fatal("Tokens do not match")
	}

	invalidJson := `{"wat"`
	r := WebrtcInfoResponseFromJson(strings.NewReader(invalidJson))
	CheckString(t, r, "")
}

func TestModelGatewayResponseFromJson(t *testing.T) {
	// Valid Gateway Response
	s1 := `{"janus": "something"}`
	g1 := GatewayResponseFromJson(strings.NewReader(s1))

	if g1.Status != "something" {
		t.Fatalf("Got unexpected Status: %v", g1.Status)
	}

	// Malformed JSON
	s2 := `{"wat"`
	g2 := GatewayResponseFromJson(strings.NewReader(s2))

	if g2 != nil {
		t.Fatal("expected nil")
	}
}
