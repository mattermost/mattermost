//go:build testlicensekey

package utils

import _ "embed"

//go:embed license-public-key-test.txt
var publicKey []byte
