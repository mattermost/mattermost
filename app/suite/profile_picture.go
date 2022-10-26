// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"bytes"
	"errors"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"github.com/mattermost/mattermost-server/v6/app/users"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils/fileutils"
)

const (
	imageProfilePixelDimension = 128
)

func (s *SuiteService) getProfileImage(user *model.User) ([]byte, bool, error) {
	if *s.platform.Config().FileSettings.DriverName == "" {
		img, err := s.getDefaultProfileImage(user)
		if err != nil {
			return nil, false, err
		}
		return img, false, nil
	}

	path := path.Join("users", user.Id, "profile.png")
	data, err := s.ReadFile(path)
	if err != nil {
		img, appErr := s.getDefaultProfileImage(user)
		if appErr != nil {
			return nil, false, appErr
		}

		if user.LastPictureUpdate == 0 {
			if _, err := s.platform.FileBackend().WriteFile(bytes.NewReader(img), path); err != nil {
				return nil, false, err
			}
		}
		return img, true, nil
	}

	return data, false, nil
}

func (s *SuiteService) GetProfileImage(user *model.User) ([]byte, bool, *model.AppError) {
	data, isDefault, err := s.getProfileImage(user)
	if err != nil {
		return nil, false, model.NewAppError("GetProfileImage", "api.user.get_profile_image.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return data, isDefault, nil
}

func (s *SuiteService) getDefaultProfileImage(user *model.User) ([]byte, error) {
	if user.IsBot {
		return botDefaultImage, nil
	}

	return createProfileImage(user.Username, user.Id, *s.platform.Config().FileSettings.InitialFont)
}

func (s *SuiteService) GetDefaultProfileImage(user *model.User) ([]byte, *model.AppError) {
	if user.IsBot {
		return botDefaultImage, nil
	}

	data, err := s.getDefaultProfileImage(user)
	if err != nil {
		switch {
		case errors.Is(err, users.DefaultFontError):
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.default_font.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		case errors.Is(err, users.UserInitialsError):
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.initial.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.encode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return data, nil
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
	srcImg := image.White
	draw.Draw(dstImg, dstImg.Bounds(), &image.Uniform{color}, image.Point{}, draw.Src)
	size := float64(imageProfilePixelDimension / 2)

	c := freetype.NewContext()
	c.SetFont(font)
	c.SetFontSize(size)
	c.SetClip(dstImg.Bounds())
	c.SetDst(dstImg)
	c.SetSrc(srcImg)

	pt := freetype.Pt(imageProfilePixelDimension/5, imageProfilePixelDimension*2/3)
	_, err = c.DrawString(initial, pt)
	if err != nil {
		return nil, UserInitialsError
	}

	buf := new(bytes.Buffer)

	if imgErr := png.Encode(buf, dstImg); imgErr != nil {
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
