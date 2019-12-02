// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"reflect"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func isEmpty(object interface{}) bool {

	// get nil case out of the way
	if object == nil {
		return true
	}

	objValue := reflect.ValueOf(object)

	switch objValue.Kind() {
	// collection types are empty when they have no element
	case reflect.Array, reflect.Chan, reflect.Map, reflect.Slice:
		return objValue.Len() == 0
	// pointers are empty if nil or if the value they point to is empty
	case reflect.Ptr:
		if objValue.IsNil() {
			return true
		}
		deref := objValue.Elem().Interface()
		return isEmpty(deref)
	// for all other types, compare against the zero value
	default:
		zero := reflect.Zero(objValue.Type())
		return reflect.DeepEqual(object, zero.Interface())
	}
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {

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
	if err := p.API.SetProfileImage("{{.BasicUser.Id}}", dataBytes); err != nil {
		return nil, err.Error()
	}

	// Get the user profile image to check
	imageProfile, err := p.API.GetProfileImage("{{.BasicUser.Id}}")
	if err != nil {
		return nil, err.Error()
	}
	if isEmpty(imageProfile) {
		return nil, "profile image is empty"
	}

	colorful := color.NRGBA{255, 0, 0, 255}
	byteReader := bytes.NewReader(imageProfile)
	img2, _, err2 := image.Decode(byteReader)
	if err2 != nil {
		return nil, err.Error()
	}
	if img2.At(2, 3) != colorful {
		return nil, fmt.Sprintf("color mismatch %v != %v", img2.At(2, 3), colorful)
	}
	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
