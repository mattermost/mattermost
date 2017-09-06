// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestReadWriteFile(t *testing.T) {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)

	b := []byte("test")
	path := "tests/" + model.NewId()

	if err := WriteFile(b, path); err != nil {
		t.Fatal(err)
	}
	defer RemoveFile(path)

	if read, err := ReadFile(path); err != nil {
		t.Fatal(err)
	} else if readString := string(read); readString != "test" {
		t.Fatal("should've read back contents of file")
	}
}

func TestMoveFile(t *testing.T) {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)

	b := []byte("test")
	path1 := "tests/" + model.NewId()
	path2 := "tests/" + model.NewId()

	if err := WriteFile(b, path1); err != nil {
		t.Fatal(err)
	}
	defer RemoveFile(path1)

	if err := MoveFile(path1, path2); err != nil {
		t.Fatal(err)
	}
	defer RemoveFile(path2)

	if _, err := ReadFile(path1); err == nil {
		t.Fatal("file should no longer exist at old path")
	}

	if _, err := ReadFile(path2); err != nil {
		t.Fatal("file should exist at new path", err)
	}
}

func TestRemoveFile(t *testing.T) {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)

	b := []byte("test")
	path := "tests/" + model.NewId()

	if err := WriteFile(b, path); err != nil {
		t.Fatal(err)
	}

	if err := RemoveFile(path); err != nil {
		t.Fatal(err)
	}

	if _, err := ReadFile(path); err == nil {
		t.Fatal("should've removed file")
	}

	if err := WriteFile(b, "tests2/foo"); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(b, "tests2/bar"); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(b, "tests2/asdf"); err != nil {
		t.Fatal(err)
	}
	if err := RemoveDirectory("tests2"); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveDirectory(t *testing.T) {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)

	b := []byte("test")

	if err := WriteFile(b, "tests2/foo"); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(b, "tests2/bar"); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(b, "tests2/aaa"); err != nil {
		t.Fatal(err)
	}

	if err := RemoveDirectory("tests2"); err != nil {
		t.Fatal(err)
	}

	if _, err := ReadFile("tests2/foo"); err == nil {
		t.Fatal("should've removed file")
	} else if _, err := ReadFile("tests2/bar"); err == nil {
		t.Fatal("should've removed file")
	} else if _, err := ReadFile("tests2/asdf"); err == nil {
		t.Fatal("should've removed file")
	}
}
