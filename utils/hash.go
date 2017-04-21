// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/sha256"
	"fmt"
)

func HashSha256(text string) string {
	hash := sha256.New()
	hash.Write([]byte(text))

	return fmt.Sprintf("%x", hash.Sum(nil))
}
