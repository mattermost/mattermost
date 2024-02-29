// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"bytes"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	xfont "golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

const (
	imageProfilePixelDimension = 128
)

func (us *UserService) GetProfileImage(user *model.User) ([]byte, bool, error) {
	if *us.config().FileSettings.DriverName == "" {
		img, err := us.GetDefaultProfileImage(user)
		if err != nil {
			return nil, false, err
		}
		return img, false, nil
	}

	path := path.Join("users", user.Id, "profile.png")
	data, err := us.ReadFile(path)
	if err != nil {
		img, appErr := us.GetDefaultProfileImage(user)
		if appErr != nil {
			return nil, false, appErr
		}

		if user.LastPictureUpdate == 0 {
			if _, err := us.writeFile(bytes.NewReader(img), path); err != nil {
				return nil, false, err
			}
		}
		return img, true, nil
	}

	return data, false, nil
}

func (us *UserService) FileBackend() (filestore.FileBackend, error) {
	license := us.license()
	insecure := us.config().ServiceSettings.EnableInsecureOutgoingConnections
	backend, err := filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(&us.config().FileSettings, license != nil && *license.Features.Compliance, insecure != nil && *insecure))
	if err != nil {
		return nil, err
	}
	return backend, nil
}

func (us *UserService) ReadFile(path string) ([]byte, error) {
	backend, err := us.FileBackend()
	if err != nil {
		return nil, err
	}
	result, nErr := backend.ReadFile(path)
	if nErr != nil {
		return nil, nErr
	}
	return result, nil
}

func (us *UserService) writeFile(fr io.Reader, path string) (int64, error) {
	backend, err := us.FileBackend()
	if err != nil {
		return 0, err
	}

	result, nErr := backend.WriteFile(fr, path)
	if nErr != nil {
		return result, nErr
	}
	return result, nil
}

func (us *UserService) GetDefaultProfileImage(user *model.User) ([]byte, error) {
	if user.IsBot {
		return botDefaultImage, nil
	}

	return createProfileImage(user.Username, user.Id, *us.config().FileSettings.InitialFont)
}

func createProfileImage(username string, userID string, initialFont string) ([]byte, error) {
	colors := []color.NRGBA{
		{197, 8, 126, 255},
		{227, 207, 18, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
	}

	h := fnv.New32a()
	h.Write([]byte(userID))
	seed := h.Sum32()

	initial := string(strings.ToUpper(username)[0])

	font, err := getFont(initialFont)
	if err != nil {
		return nil, DefaultFontError
	}

	color := colors[int64(seed)%int64(len(colors))]

	dstImg := image.NewRGBA(image.Rect(0, 0, imageProfilePixelDimension, imageProfilePixelDimension))

	draw.Draw(dstImg, dstImg.Bounds(), &image.Uniform{color}, image.Point{}, draw.Src)

	size := float64(imageProfilePixelDimension / 2)

	opts := truetype.Options{}
	opts.Size = size
	face := truetype.NewFace(font, &opts)

	d := &xfont.Drawer{
		Dst:  dstImg,
		Src:  image.White,
		Face: face,
	}

	bounds, advance, ok := face.GlyphBounds([]rune(initial)[0])

	if !ok {
		return nil, GlyphError
	}

	x := (fixed.I(imageProfilePixelDimension) - advance) / 2
	y := (fixed.I(imageProfilePixelDimension) + (bounds.Max.Y - bounds.Min.Y)) / 2

	d.Dot = fixed.Point26_6{
		X: x,
		Y: y,
	}
	d.DrawString(initial)

	buf := new(bytes.Buffer)

	enc := png.Encoder{
		CompressionLevel: png.BestCompression,
	}
	if imgErr := enc.Encode(buf, dstImg); imgErr != nil {
		return nil, ImageEncodingError
	}

	return buf.Bytes(), nil
}

func getFont(initialFont string) (*truetype.Font, error) {
	// Some people have the old default font still set, so just treat that as if they're using the new default
	if initialFont == "luximbi.ttf" {
		initialFont = "nunito-bold.ttf"
	}

	fontDir, _ := fileutils.FindDir("fonts")
	fontBytes, err := os.ReadFile(filepath.Join(fontDir, initialFont))
	if err != nil {
		return nil, err
	}

	return freetype.ParseFont(fontBytes)
}
