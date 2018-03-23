// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestEmojiIsValid(t *testing.T) {
	emoji := Emoji{
		Id:        NewId(),
		CreateAt:  1234,
		UpdateAt:  1234,
		DeleteAt:  0,
		CreatorId: NewId(),
		Name:      "name",
	}

	if err := emoji.IsValid(); err != nil {
		t.Fatal(err)
	}

	emoji.Id = "1234"
	if err := emoji.IsValid(); err == nil {
		t.Fatal()
	}

	emoji.Id = NewId()
	emoji.CreateAt = 0
	if err := emoji.IsValid(); err == nil {
		t.Fatal()
	}

	emoji.CreateAt = 1234
	emoji.UpdateAt = 0
	if err := emoji.IsValid(); err == nil {
		t.Fatal()
	}

	emoji.UpdateAt = 1234
	emoji.CreatorId = strings.Repeat("1", 25)
	if err := emoji.IsValid(); err == nil {
		t.Fatal()
	}

	emoji.CreatorId = strings.Repeat("1", 27)
	if err := emoji.IsValid(); err == nil {
		t.Fatal()
	}

	emoji.CreatorId = NewId()
	emoji.Name = strings.Repeat("1", 65)
	if err := emoji.IsValid(); err == nil {
		t.Fatal()
	}

	emoji.Name = ""
	if err := emoji.IsValid(); err == nil {
		t.Fatal(err)
	}

	emoji.Name = strings.Repeat("1", 64)
	if err := emoji.IsValid(); err != nil {
		t.Fatal(err)
	}

	emoji.Name = "name-"
	if err := emoji.IsValid(); err != nil {
		t.Fatal(err)
	}

	emoji.Name = "name_"
	if err := emoji.IsValid(); err != nil {
		t.Fatal(err)
	}

	emoji.Name = "name:"
	if err := emoji.IsValid(); err == nil {
		t.Fatal(err)
	}

	emoji.Name = "croissant"
	if err := emoji.IsValid(); err == nil {
		t.Fatal(err)
	}
}
