// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"errors"
	"io"
	"net/http"
)

var ErrExternalImageBlocked = Error{errors.New("imageproxy.BlockBackend: external image fetching is blocked")}

type blockBackend struct{}

func makeBlockBackend() *blockBackend {
	return &blockBackend{}
}

func (b *blockBackend) GetImage(w http.ResponseWriter, r *http.Request, imageURL string) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusForbidden)
}

func (b *blockBackend) GetImageDirect(imageURL string) (io.ReadCloser, string, error) {
	return nil, "", ErrExternalImageBlocked
}
