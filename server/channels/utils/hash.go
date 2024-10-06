// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto/sha256"
	"encoding/hex"
)

func HashSha256(text string) string {
	hash := sha256.New()
	hash.Write([]byte(text))

	return hex.EncodeToString(hash.Sum(nil))
}
