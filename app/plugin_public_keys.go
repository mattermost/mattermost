// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

var publicKey []byte = []byte(`-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEXZXngxYJKwYBBAHaRw8BAQdAW4JhUqF56i0NjgBaZv8z/m0a6+bLjpRPNrpH
0mc0T860RU1hdHRlcm1vc3QgSW5jLiAoUGx1Z2luIHNpZ25pbmcgZGV2ZWxvcG1l
bnQga2V5KSA8YWxpQG1hdHRlcm1vc3QuY29tPoiWBBMWCAA+FiEEE+YADa5Yh8+O
unGqbgvhVfX5M7MFAl2V54MCGwMFCQBPGgAFCwkIBwIGFQoJCAsCBBYCAwECHgEC
F4AACgkQbgvhVfX5M7OmLAEAg5j4pU3i7v3MxuTYyel4nkcZFiU5HFUEliX4SUEY
k1cBALicbND52uJrQyV4kNm6OZwwzV41m++025Hg7QuamFAFuDgEXZXngxIKKwYB
BAGXVQEFAQEHQK1F+KbmkA6nUjt7TYSsaOxMSKiE54+ph+prGuWfHlhVAwEIB4h+
BBgWCAAmFiEEE+YADa5Yh8+OunGqbgvhVfX5M7MFAl2V54MCGwwFCQBPGgAACgkQ
bgvhVfX5M7MdCgEA71I51xFWjxW6aTBzVfbVkhKtQZNg3Z2ysAMbVzrUw3sA+gPN
wQlDw4q8Y28gsItPAtoQSGYqwW46o9kojgB4y70M
=RIZO
-----END PGP PUBLIC KEY BLOCK-----`)
var publicKeyName = "development-public-key.asc"

func (a *App) initPluginPublicKeys() *model.AppError {
	reader := bytes.NewReader(publicKey)
	if err := a.AddPublicKey(publicKeyName, reader); err != nil {
		return model.NewAppError("initPluginPublicKeys", "app.plugin.init_public_keys.add_key.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
