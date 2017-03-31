package model

import (
	"strings"
	"testing"
)

func TestModelSecurityBulletinToJson(t *testing.T) {
	b := SecurityBulletin{
		Id: "asdfghjkl",
		AppliesToVersion: "3.7.3",
	}

	j := b.ToJson()

	if j != `{"id":"asdfghjkl","applies_to_version":"3.7.3"}` {
		t.Fatalf("Got unexpected json: %v", j)
	}
}

func TestModelSecurityBulletinFromJson(t *testing.T) {
	// Valid Security Bulletin JSON.
	s1 := `{"id":"asdfghjkl","applies_to_version":"3.7.3"}`
	b1 := SecurityBulletinFromJson(strings.NewReader(s1))

	if b1.AppliesToVersion != "3.7.3" {
		t.Fatalf("Got unexpected applies to version: %v", b1.AppliesToVersion)
	}

	if b1.Id != "asdfghjkl" {
		t.Fatalf("Got unexpected id: %v", b1.Id)
	}

	// Malformed JSON
	s2 := `{"wat"`
	b2 := SecurityBulletinFromJson(strings.NewReader(s2))

	if b2 != nil {
		t.Fatal("expected nil")
	}
}

func TestModelSecurityBulletinsToJson(t *testing.T) {
	b := SecurityBulletins{
		{
			Id: "asdfghjkl",
			AppliesToVersion: "3.7.3",
		},
		{
			Id: "qwertyuiop",
			AppliesToVersion: "3.5.1",
		},
	}

	j := b.ToJson()

	if j != `[{"id":"asdfghjkl","applies_to_version":"3.7.3"},{"id":"qwertyuiop","applies_to_version":"3.5.1"}]` {
		t.Fatalf("Got unexpected json: %v", j)
	}
}

func TestModelSecurityBulletinsFromJson(t *testing.T) {
	// Valid bulletins
	s1 := `[{"id":"asdfghjkl","applies_to_version":"3.7.3"},{"id":"qwertyuiop","applies_to_version":"3.7.3"}]`

	b1 := SecurityBulletinsFromJson(strings.NewReader(s1))

	CheckInt(t, len(b1), 2)

	// Malformed JSON
	s2 := `{"wat"`
	b2 := SecurityBulletinsFromJson(strings.NewReader(s2))

	CheckInt(t, len(b2), 0)
}
