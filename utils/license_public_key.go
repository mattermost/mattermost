//go:build !testlicensekey

package utils

import _ "embed"

//go:embed license-public-key.txt
var publicKey []byte
