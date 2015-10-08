// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestTeamJson(t *testing.T) {
	o := Team{Id: NewId(), DisplayName: NewId()}
	json := o.ToJson()
	ro := TeamFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestTeamIsValid(t *testing.T) {
	o := Team{}

	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Id = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UpdateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Email = strings.Repeat("01234567890", 20)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Email = "corey@hulen.com"
	o.DisplayName = strings.Repeat("01234567890", 20)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.DisplayName = "1234"
	o.Name = "ZZZZZZZ"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Name = "zzzzz"
	o.Type = TEAM_OPEN
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestTeamPreSave(t *testing.T) {
	o := Team{DisplayName: "test"}
	o.PreSave()
	o.Etag()
}

func TestTeamPreUpdate(t *testing.T) {
	o := Team{DisplayName: "test"}
	o.PreUpdate()
}

var domains = []struct {
	value    string
	expected bool
}{
	{"spin-punch", true},
	{"-spin-punch", false},
	{"spin-punch-", false},
	{"spin_punch", false},
	{"a", false},
	{"aa", false},
	{"aaa", false},
	{"aaa-999b", true},
	{"b00b", true},
	{"b))b", false},
	{"test", true},
}

func TestValidTeamName(t *testing.T) {
	for _, v := range domains {
		if IsValidTeamName(v.value) != v.expected {
			t.Errorf("expect %v as %v", v.value, v.expected)
		}
	}
}

var tReservedDomains = []struct {
	value    string
	expected bool
}{
	{"test-hello", true},
	{"test", true},
	{"admin", true},
	{"Admin-punch", true},
	{"spin-punch-admin", false},
}

func TestReservedTeamName(t *testing.T) {
	for _, v := range tReservedDomains {
		if IsReservedTeamName(v.value) != v.expected {
			t.Errorf("expect %v as %v", v.value, v.expected)
		}
	}
}

func TestCleanTeamName(t *testing.T) {
	if CleanTeamName("Jimbo's Team") != "jimbos-team" {
		t.Fatal("didn't clean name properly")
	}
	if len(CleanTeamName("Test")) != 26 {
		t.Fatal("didn't clean name properly")
	}
	if CleanTeamName("Team Really cool") != "really-cool" {
		t.Fatal("didn't clean name properly")
	}
	if CleanTeamName("super-duper-guys") != "super-duper-guys" {
		t.Fatal("didn't clean name properly")
	}
}
