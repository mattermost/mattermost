// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
//go:build testlicensekey

package utils

import _ "embed"

// TODO: license-public-key-test.txt currently has the contents of the prod public key.
// Change to the test public key when ready for dev images to use test license key.

//go:embed license-public-key-test.txt
var publicKey []byte
