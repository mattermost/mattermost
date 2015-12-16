// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/base64"
	"io/ioutil"
	"testing"
)

func TestGetInfoForBytes(t *testing.T) {
	fakeFile := make([]byte, 1000)

	if info, err := GetInfoForBytes("file.txt", fakeFile); err != nil {
		t.Fatal(err)
	} else if info.Filename != "file.txt" {
		t.Fatalf("Got incorrect filename: %v", info.Filename)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.Extension != "txt" {
		t.Fatalf("Git incorrect file extension: %v", info.Extension)
	} else if info.MimeType != "text/plain; charset=utf-8" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.HasPreviewImage {
		t.Fatalf("Got HasPreviewImage = true for non-image file")
	}

	if info, err := GetInfoForBytes("file.png", fakeFile); err != nil {
		t.Fatal(err)
	} else if info.Filename != "file.png" {
		t.Fatalf("Got incorrect filename: %v", info.Filename)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.Extension != "png" {
		t.Fatalf("Git incorrect file extension: %v", info.Extension)
	} else if info.MimeType != "image/png" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if !info.HasPreviewImage {
		t.Fatalf("Got HasPreviewImage = false for image")
	}

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	gifFile, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")
	if info, err := GetInfoForBytes("handtinywhite.gif", gifFile); err != nil {
		t.Fatal(err)
	} else if info.Filename != "handtinywhite.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Filename)
	} else if info.Size != 35 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.Extension != "gif" {
		t.Fatalf("Git incorrect file extension: %v", info.Extension)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if !info.HasPreviewImage {
		t.Fatalf("Got HasPreviewImage = false for static gif")
	}

	animatedGifFile, err := ioutil.ReadFile("../web/static/images/testgif.gif")
	if err != nil {
		t.Fatalf("Failed to load testgif.gif: %v", err.Error())
	}
	if info, err := GetInfoForBytes("testgif.gif", animatedGifFile); err != nil {
		t.Fatal(err)
	} else if info.Filename != "testgif.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Filename)
	} else if info.Size != 38689 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.Extension != "gif" {
		t.Fatalf("Git incorrect file extension: %v", info.Extension)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.HasPreviewImage {
		t.Fatalf("Got HasPreviewImage = true for animated gif")
	}
}
