// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestCommandResponseJson(t *testing.T) {
	o := CommandResponse{Text: "test"}
	json := o.ToJson()
	ro := CommandResponseFromJson(strings.NewReader(json))

	if o.Text != ro.Text {
		t.Fatal("Ids do not match")
	}
}
