// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
//go:build testlicensekey

package utils

import _ "embed"

//go:embed license-public-key-test.txt
var publicKey []byte
