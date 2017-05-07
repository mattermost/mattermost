// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"
)

func TestUrlEncode(t *testing.T) {

	toEncode := "testing 1 2 3"
	encoded := UrlEncode(toEncode)

	if encoded != "testing%201%202%203" {
		t.Log(encoded)
		t.Fatal("should be equal")
	}

	toEncode = "testing123"
	encoded = UrlEncode(toEncode)

	if encoded != "testing123" {
		t.Log(encoded)
		t.Fatal("should be equal")
	}

	toEncode = "testing$#~123"
	encoded = UrlEncode(toEncode)

	if encoded != "testing%24%23~123" {
		t.Log(encoded)
		t.Fatal("should be equal")
	}
}
