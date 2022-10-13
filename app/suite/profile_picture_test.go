// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"bytes"
	"image"
	"image/color"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateProfileImage(t *testing.T) {
	b, err := createProfileImage("Corey Hulen", "eo1zkdr96pdj98pjmq8zy35wba", "nunito-bold.ttf")
	require.NoError(t, err)

	rdr := bytes.NewReader(b)
	img, _, err2 := image.Decode(rdr)
	require.NoError(t, err2)

	colorful := color.RGBA{116, 49, 196, 255}

	require.Equal(t, colorful, img.At(1, 1), "Failed to create correct color")
}
