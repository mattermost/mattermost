// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import _ "embed"

//go:embed license-public-key.txt
var productionPublicKey []byte

//go:embed license-public-key-test.txt
var testPublicKey []byte
