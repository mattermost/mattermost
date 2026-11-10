// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build requirefips

package hashers

import "github.com/mattermost/mattermost/server/public/model"

// fipsMinKeyLength is the minimum PBKDF2 key length enforced by the OpenSSL 3.x
// FIPS provider (NIST SP 800-132: PBKDF password must be at least 14 bytes).
const fipsMinKeyLength = model.PasswordFIPSMinimumLength
