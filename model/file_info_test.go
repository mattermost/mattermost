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

func TestGetInfoForFile(t *testing.T) {
	fakeFile := make([]byte, 1000)

	if info := GetInfoForBytes("file.txt", fakeFile); info.Name != "file.txt" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if !strings.HasPrefix(info.MimeType, "text/plain") {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 0 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 0 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	}

	pngFile, err := ioutil.ReadFile("../tests/test.png")
	if err != nil {
		t.Fatalf("Failed to load test.png: %v", err.Error())
	}
	if info := GetInfoForBytes("test.png", pngFile); info.Name != "test.png" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 279591 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/png" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 408 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 336 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	}

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	gifFile, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")
	if info := GetInfoForBytes("handtinywhite.gif", gifFile); info.Name != "handtinywhite.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 35 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 1 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 1 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	}

	animatedGifFile, err := ioutil.ReadFile("../tests/testgif.gif")
	if err != nil {
		t.Fatalf("Failed to load testgif.gif: %v", err.Error())
	}
	if info := GetInfoForBytes("testgif.gif", animatedGifFile); info.Name != "testgif.gif" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 38689 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "image/gif" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 118 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 118 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	}

	if info := GetInfoForBytes("filewithoutextension", fakeFile); info.Name != "filewithoutextension" {
		t.Fatalf("Got incorrect filename: %v", info.Name)
	} else if info.Size != 1000 {
		t.Fatalf("Got incorrect size: %v", info.Size)
	} else if info.MimeType != "" {
		t.Fatalf("Got incorrect mime type: %v", info.MimeType)
	} else if info.Width != 0 {
		t.Fatalf("Got incorrect width: %v", info.Width)
	} else if info.Height != 0 {
		t.Fatalf("Got incorrect height: %v", info.Height)
	}
}
