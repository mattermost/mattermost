// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMfaSecretJson(t *testing.T) {
	secret := MfaSecret{Secret: NewId(), QRCode: NewId()}
	json := secret.ToJson()
	result := MfaSecretFromJson(strings.NewReader(json))

	require.Equal(t, secret.Secret, result.Secret, "Secrets do not match")
}
