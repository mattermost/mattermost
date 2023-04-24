// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/plugin_api_tests"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {

	// Create an 128 x 128 image
	img := image.NewRGBA(image.Rect(0, 0, 128, 128))
	// Draw a red dot at (2, 3)
	img.Set(2, 3, color.RGBA{255, 0, 0, 255})
	buf := new(bytes.Buffer)
	if err := png.Encode(buf, img); err != nil {
		return nil, err.Error()
	}

	dataBytes := buf.Bytes()

	// Set the user profile image
	if err := p.API.SetProfileImage(p.configuration.BasicUserID, dataBytes); err != nil {
		return nil, err.Error()
	}

	// Get the user profile image to check
	imageProfile, err := p.API.GetProfileImage(p.configuration.BasicUserID)
	if err != nil {
		return nil, err.Error()
	}
	if plugin_api_tests.IsEmpty(imageProfile) {
		return nil, "profile image is empty"
	}

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(imageProfile)
	img2, _, err2 := image.Decode(byteReader)
	if err2 != nil {
		return nil, err2.Error()
	}
	if img2.At(2, 3) != colorful {
		return nil, fmt.Sprintf("color mismatch %v != %v", img2.At(2, 3), colorful)
	}
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
