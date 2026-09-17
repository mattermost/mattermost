// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"crypto/sha256"
	"encoding/hex"
)

func Fingerprint(code, subject, scope string) string {
	sum := sha256.Sum256([]byte(code + "\x00" + subject + "\x00" + scope))
	return hex.EncodeToString(sum[:])[:32]
}
