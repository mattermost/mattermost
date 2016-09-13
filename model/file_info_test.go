// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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
		Id:       NewId(),
		UserId:   NewId(),
		CreateAt: 1234,
		UpdateAt: 1234,
		PostId:   "",
		Path:     "fake/path.png",
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

	if info, cfg := GetInfoForBytes("file.txt", fakeFile); info.Name != "file.txt" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if !strings.HasPrefix(info.MimeType, "text/plain") {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 0 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 0 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if cfg != nil {
		t.Fatalf("Got incorrect image config: %v", cfg)
	}

	pngFile, err := ioutil.ReadFile("../tests/test.png")
	if err != nil {
		t.Fatalf("Failed to load test.png: %v", err.Error())
	}
	if info, cfg := GetInfoForBytes("test.png", pngFile); info.Name != "test.png" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 279591 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/png" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 408 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 336 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if cfg == nil {
		t.Fatalf("Got incorrect image config: %v", cfg)
	}

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	gifFile, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")
	if info, cfg := GetInfoForBytes("handtinywhite.gif", gifFile); info.Name != "handtinywhite.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 35 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 1 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 1 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if cfg == nil {
		t.Fatalf("Got incorrect image config: %v", cfg)
	}

	animatedGifFile, err := ioutil.ReadFile("../tests/testgif.gif")
	if err != nil {
		t.Fatalf("Failed to load testgif.gif: %v", err.Error())
	}
	if info, cfg := GetInfoForBytes("testgif.gif", animatedGifFile); info.Name != "testgif.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 38689 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 118 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 118 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if cfg == nil {
		t.Fatalf("Got incorrect image config: %v", cfg)
	}

	if info, cfg := GetInfoForBytes("filewithoutextension", fakeFile); info.Name != "filewithoutextension" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 0 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 0 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	} else if cfg != nil {
		t.Fatalf("Got incorrect image config: %v", cfg)
	}
}
