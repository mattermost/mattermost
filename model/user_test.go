// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestPasswordHash(t *testing.T) {
	hash := HashPassword("Test")

	if !ComparePassword(hash, "Test") {
		t.Fatal("Passwords don't match")
	}

	if ComparePassword(hash, "Test2") {
		t.Fatal("Passwords should not have matched")
	}
}

func TestUserJson(t *testing.T) {
	user := User{Id: NewId(), Username: NewId()}
	json := user.ToJson()
	ruser := UserFromJson(strings.NewReader(json))

	if user.Id != ruser.Id {
		t.Fatal("Ids do not match")
	}
}

func TestUserPreSave(t *testing.T) {
	user := User{Password: "test"}
	user.PreSave()
	user.Etag()
}

func TestUserPreUpdate(t *testing.T) {
	user := User{Password: "test"}
	user.PreUpdate()
}

func TestUserIsValid(t *testing.T) {
	user := User{}

	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.Id = NewId()
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.CreateAt = GetMillis()
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.UpdateAt = GetMillis()
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.TeamId = NewId()
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.Username = NewId() + "^hello#"
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.Username = NewId()
	user.Email = strings.Repeat("01234567890", 20)
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.Email = "test@nowhere.com"
	user.FullName = strings.Repeat("01234567890", 20)
	if err := user.IsValid(); err == nil {
		t.Fatal()
	}

	user.FullName = ""
	if err := user.IsValid(); err != nil {
		t.Fatal(err)
	}
}
