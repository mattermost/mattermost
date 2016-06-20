// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package plist

import (
	"reflect"
	"testing"
)

var thePlist = `<plist version="1.0">
    <dict>
        <key>BucketUUID</key>
        <string>C218A47D-DAFB-4476-9C67-597E556D7D8A</string>
        <key>BucketName</key>
        <string>rsc</string>
        <key>ComputerUUID</key>
        <string>E7859547-BB9C-41C0-871E-858A0526BAE7</string>
        <key>LocalPath</key>
        <string>/Users/rsc</string>
        <key>LocalMountPoint</key>
        <string>/Users</string>
        <key>IgnoredRelativePaths</key>
        <array>
            <string>/.Trash</string>
            <string>/go/pkg</string>
            <string>/go1/pkg</string>
            <string>/Library/Caches</string>
        </array>
        <key>Excludes</key>
        <dict>
            <key>excludes</key>
            <array>
                <dict>
                    <key>type</key>
                    <integer>2</integer>
                    <key>text</key>
                    <string>.unison.</string>
                </dict>
            </array>
        </dict>
    </dict>
</plist>
`

var plistTests = []struct {
	in  string
	out interface{}
}{
	{
		thePlist,
		&MyStruct{
			BucketUUID:      "C218A47D-DAFB-4476-9C67-597E556D7D8A",
			BucketName:      "rsc",
			ComputerUUID:    "E7859547-BB9C-41C0-871E-858A0526BAE7",
			LocalPath:       "/Users/rsc",
			LocalMountPoint: "/Users",
			IgnoredRelativePaths: []string{
				"/.Trash",
				"/go/pkg",
				"/go1/pkg",
				"/Library/Caches",
			},
			Excludes: Exclude1{
				Excludes: []Exclude2{
					{Type: 2,
						Text: ".unison.",
					},
				},
			},
		},
	},
	{
		thePlist,
		&struct{}{},
	},
}

type MyStruct struct {
	BucketUUID           string
	BucketName           string
	ComputerUUID         string
	LocalPath            string
	LocalMountPoint      string
	IgnoredRelativePaths []string
	Excludes             Exclude1
}

type Exclude1 struct {
	Excludes []Exclude2 `plist:"excludes"`
}

type Exclude2 struct {
	Type int    `plist:"type"`
	Text string `plist:"text"`
}

func TestUnmarshal(t *testing.T) {
	for _, tt := range plistTests {
		v := reflect.New(reflect.ValueOf(tt.out).Type().Elem()).Interface()
		if err := Unmarshal([]byte(tt.in), v); err != nil {
			t.Errorf("%s", err)
			continue
		}
		if !reflect.DeepEqual(tt.out, v) {
			t.Errorf("unmarshal not equal")
		}
	}
}
