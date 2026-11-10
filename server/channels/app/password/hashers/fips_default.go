// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !requirefips

package hashers

// fipsMinKeyLength is 0 in non-FIPS builds, meaning no minimum is enforced.
const fipsMinKeyLength = 0
