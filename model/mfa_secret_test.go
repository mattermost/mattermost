// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestMfaSecretJson(t *testing.T) {
	secret := MfaSecret{Secret: NewId(), QRCode: NewId()}
	json := secret.ToJson()
	result := MfaSecretFromJson(strings.NewReader(json))

	if secret.Secret != result.Secret {
		t.Fatal("Secrets do not match")
	}
}
