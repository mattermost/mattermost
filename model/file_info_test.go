// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/base64"
	_ "image/gif"
	_ "image/png"
	"io/ioutil"
	"strings"
	"testing"
)

func TestFileInfoIsValid(t *testing.T) {
	info := &FileInfo{
		Id:        NewId(),
		CreatorId: NewId(),
		CreateAt:  1234,
		UpdateAt:  1234,
		PostId:    "",
		Path:      "fake/path.png",
	}

	if err := info.IsValid(); err != nil {
		t.Fatal(err)
	}

	info.Id = ""
	if err := info.IsValid(); err == nil {
		t.Fatal("empty Id isn't valid")
	}

	info.Id = NewId()
	info.CreateAt = 0
	if err := info.IsValid(); err == nil {
		t.Fatal("empty CreateAt isn't valid")
	}

	info.CreateAt = 1234
	info.UpdateAt = 0
	if err := info.IsValid(); err == nil {
		t.Fatal("empty UpdateAt isn't valid")
	}

	info.UpdateAt = 1234
	info.PostId = NewId()
	if err := info.IsValid(); err != nil {
		t.Fatal(err)
	}

	info.Path = ""
	if err := info.IsValid(); err == nil {
		t.Fatal("empty Path isn't valid")
	}

	info.Path = "fake/path.png"
	if err := info.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestFileInfoIsImage(t *testing.T) {
	info := &FileInfo{
		MimeType: "image/png",
	}

	if !info.IsImage() {
		t.Fatal("file is an image")
	}

	info.MimeType = "text/plain"
	if info.IsImage() {
		t.Fatal("file is not an image")
	}
}

func TestGetInfoForFile(t *testing.T) {
	fakeFile := make([]byte, 1000)

	if info, err := GetInfoForBytes("file.txt", fakeFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "file.txt" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "txt" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if !strings.HasPrefix(info.MimeType, "text/plain") {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 0 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 0 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if info.HasPreviewImage {
		t.Fatalf("Got incorrect has preview image: %v", info.HasPreviewImage)
	}

	pngFile, err := ioutil.ReadFile("../tests/test.png")
	if err != nil {
		t.Fatalf("Failed to load test.png: %v", err.Error())
	}
	if info, err := GetInfoForBytes("test.png", pngFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "test.png" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "png" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	} else if info.Size != 279591 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/png" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 408 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 336 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if !info.HasPreviewImage {
		t.Fatalf("Got incorrect has preview image: %v", info.HasPreviewImage)
	}

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	gifFile, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")
	if info, err := GetInfoForBytes("handtinywhite.gif", gifFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "handtinywhite.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "gif" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	} else if info.Size != 35 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 1 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 1 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if !info.HasPreviewImage {
		t.Fatalf("Got incorrect has preview image: %v", info.HasPreviewImage)
	}

	animatedGifFile, err := ioutil.ReadFile("../tests/testgif.gif")
	if err != nil {
		t.Fatalf("Failed to load testgif.gif: %v", err.Error())
	}
	if info, err := GetInfoForBytes("testgif.gif", animatedGifFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "testgif.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "gif" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	} else if info.Size != 38689 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 118 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 118 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if info.HasPreviewImage {
		t.Fatalf("Got incorrect has preview image: %v", info.HasPreviewImage)
	}

	if info, err := GetInfoForBytes("filewithoutextension", fakeFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "filewithoutextension" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 0 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 0 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if info.HasPreviewImage {
		t.Fatalf("Got incorrect has preview image: %v", info.HasPreviewImage)
	}

	// Always make the extension lower case to make it easier to use in other places
	if info, err := GetInfoForBytes("file.TXT", fakeFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "file.TXT" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "txt" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	}

	// Don't error out for image formats we don't support
	if info, err := GetInfoForBytes("file.tif", fakeFile); err != nil {
		t.Fatal(err)
	} else if info.Name != "file.tif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Extension != "tif" {
		t.Fatalf("Got incorrect extension: %v", info.Extension)
	} else if info.MimeType != "image/tiff" && info.MimeType != "image/x-tiff" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	}
}
