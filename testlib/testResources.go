// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testlib

import (
	"fmt"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
)

const (
	resourceTypeFile = iota
	resourceTypeFolder
)

const (
	actionCopy = iota
	actionSymlink
)

type testResourceDetails struct {
	src     string
	dest    string
	resType int8
	action  int8
}

var testResourcesToSetup = []testResourceDetails{
	{"config/default.json", "config/default.json", resourceTypeFile, actionCopy},
	{"config/default.json", "config/config.json", resourceTypeFile, actionCopy},
	{"config/timezones.json", "config/timezones.json", resourceTypeFile, actionCopy},
	{"i18n", "i18n", resourceTypeFolder, actionSymlink},
	{"plugins", "plugins", resourceTypeFolder, actionSymlink},
	{"client/plugins", "client/plugins", resourceTypeFolder, actionSymlink},
	{"templates", "templates", resourceTypeFolder, actionSymlink},
	{"tests", "tests", resourceTypeFolder, actionSymlink},
}

func init() {
	var srcPath string
	var found bool

	// Finding resources and setting full path to source to be used for further processing
	for i, testResource := range testResourcesToSetup {
		if testResource.resType == resourceTypeFile {
			srcPath = fileutils.FindFile(testResource.src)
			if srcPath == "" {
				panic(fmt.Sprintf("Failed to find file %s", testResource.src))
			}

			testResourcesToSetup[i].src = srcPath
		} else if testResource.resType == resourceTypeFolder {
			srcPath, found = fileutils.FindDir(testResource.src)
			if found == false {
				panic(fmt.Sprintf("Failed to find folder %s", testResource.src))
			}

			testResourcesToSetup[i].src = srcPath
		} else {
			panic(fmt.Sprintf("Invalid resource type: %d", testResource.resType))
		}
	}
}

func SetupTestResources() string {
	tempDir, err := ioutil.TempDir("", "testlibHelper")
	if err != nil {
		panic("failed to create temporary directory: " + err.Error())
	}

	var resourceDestInTemp string

	// Setting up test resources in temp.
	// Action in each resource tells whether it needs to be copied or just symlinked

	for _, testResource := range testResourcesToSetup {
		resourceDestInTemp = filepath.Join(tempDir, testResource.dest)

		if testResource.action == actionCopy {
			if testResource.resType == resourceTypeFile {
				err = utils.CopyFile(testResource.src, resourceDestInTemp)
				if err != nil {
					panic(fmt.Sprintf("failed to copy file %s to %s: %s", testResource.src, resourceDestInTemp, err.Error()))
				}
			} else if testResource.resType == resourceTypeFolder {
				err = utils.CopyDir(testResource.src, resourceDestInTemp)
				if err != nil {
					panic(fmt.Sprintf("failed to copy folder %s to %s: %s", testResource.src, resourceDestInTemp, err.Error()))
				}
			}
		} else if testResource.action == actionSymlink {
			destDir := path.Dir(resourceDestInTemp)
			if destDir != "." {
				err = os.MkdirAll(destDir, os.ModePerm)
				if err != nil {
					panic(fmt.Sprintf("failed to make dir %s: %s", destDir, err.Error()))
				}
			}

			err = os.Symlink(testResource.src, resourceDestInTemp)
			if err != nil {
				panic("failed to symlink client/plugins directory to temp: " + err.Error())
			}
		} else {
			panic(fmt.Sprintf("Invalid action: %d", testResource.action))
		}

	}

	return tempDir
}

func CleanupTestResources(tempPath string) {
	if tempPath != "" {
		os.RemoveAll(tempPath)
	}
}
