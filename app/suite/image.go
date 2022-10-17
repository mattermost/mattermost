// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"fmt"
	"io"

	"github.com/mattermost/mattermost-server/v6/app/imaging"
)

func CheckImageResolutionLimit(w, h int, maxRes int64) error {
	// This casting is done to prevent overflow on 32 bit systems (not needed
	// in 64 bits systems because images can't have more than 32 bits height or
	// width)
	imageRes := int64(w) * int64(h)
	if imageRes > maxRes {
		return fmt.Errorf("image resolution is too high: %d, max allowed is %d", imageRes, maxRes)
	}

	return nil
}

func CheckImageLimits(imageData io.Reader, maxRes int64) error {
	w, h, err := imaging.GetDimensions(imageData)
	if err != nil {
		return fmt.Errorf("failed to get image dimensions: %w", err)
	}

	return CheckImageResolutionLimit(w, h, maxRes)
}
