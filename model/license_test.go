// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestLicenseFeaturesToMap(t *testing.T) {
	f := Features{}
	f.SetDefaults()

	m := f.ToMap()

	CheckTrue(t, m["ldap"].(bool))
	CheckTrue(t, m["mfa"].(bool))
	CheckTrue(t, m["google"].(bool))
	CheckTrue(t, m["office365"].(bool))
	CheckTrue(t, m["compliance"].(bool))
	CheckTrue(t, m["cluster"].(bool))
	CheckTrue(t, m["metrics"].(bool))
	CheckTrue(t, m["custom_brand"].(bool))
	CheckTrue(t, m["mhpns"].(bool))
	CheckTrue(t, m["saml"].(bool))
	CheckTrue(t, m["password"].(bool))
	CheckTrue(t, m["future"].(bool))
}

func TestLicenseFeaturesSetDefaults(t *testing.T) {
	f := Features{}
	f.SetDefaults()

	CheckInt(t, *f.Users, 0)
	CheckTrue(t, *f.LDAP)
	CheckTrue(t, *f.MFA)
	CheckTrue(t, *f.GoogleOAuth)
	CheckTrue(t, *f.Office365OAuth)
	CheckTrue(t, *f.Compliance)
	CheckTrue(t, *f.Cluster)
	CheckTrue(t, *f.Metrics)
	CheckTrue(t, *f.CustomBrand)
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.PasswordRequirements)
	CheckTrue(t, *f.FutureFeatures)

	f = Features{}
	f.SetDefaults()

	*f.Users = 300
	*f.FutureFeatures = false
	*f.LDAP = true
	*f.MFA = true
	*f.GoogleOAuth = true
	*f.Office365OAuth = true
	*f.Compliance = true
	*f.Cluster = true
	*f.Metrics = true
	*f.CustomBrand = true
	*f.MHPNS = true
	*f.SAML = true
	*f.PasswordRequirements = true

	f.SetDefaults()

	CheckInt(t, *f.Users, 300)
	CheckTrue(t, *f.LDAP)
	CheckTrue(t, *f.MFA)
	CheckTrue(t, *f.GoogleOAuth)
	CheckTrue(t, *f.Office365OAuth)
	CheckTrue(t, *f.Compliance)
	CheckTrue(t, *f.Cluster)
	CheckTrue(t, *f.Metrics)
	CheckTrue(t, *f.CustomBrand)
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.PasswordRequirements)
	CheckFalse(t, *f.FutureFeatures)
}

func TestLicenseIsExpired(t *testing.T) {
	l1 := License{}
	l1.ExpiresAt = GetMillis() - 1000
	if !l1.IsExpired() {
		t.Fatal("license should be expired")
	}

	l1.ExpiresAt = GetMillis() + 10000
	if l1.IsExpired() {
		t.Fatal("license should not be expired")
	}
}

func TestLicenseIsStarted(t *testing.T) {
	l1 := License{}
	l1.StartsAt = GetMillis() - 1000
	if !l1.IsStarted() {
		t.Fatal("license should be started")
	}

	l1.StartsAt = GetMillis() + 10000
	if l1.IsStarted() {
		t.Fatal("license should not be started")
	}
}

func TestLicenseToJson(t *testing.T) {
	f := Features{}
	f.SetDefaults()

	l := License{
		Id:        "rcgiyftm7jyrxnma1osd8zswby",
		IssuedAt:  123456789000,
		StartsAt:  123456789000,
		ExpiresAt: 123456789000,
		Customer: &Customer{
			Id:          "rcgiyftm7jyrxnma1osd8zswb7",
			Name:        "Customer Name",
			Email:       "customer@customer.com",
			Company:     "Customer Company",
			PhoneNumber: "01234567890",
		},
		Features: &f,
	}

	j := l.ToJson()

	if j != `{"id":"rcgiyftm7jyrxnma1osd8zswby","issued_at":123456789000,"starts_at":123456789000,"expires_at":123456789000,"customer":{"id":"rcgiyftm7jyrxnma1osd8zswb7","name":"Customer Name","email":"customer@customer.com","company":"Customer Company","phone_number":"01234567890"},"features":{"users":0,"ldap":true,"mfa":true,"google_oauth":true,"office365_oauth":true,"compliance":true,"cluster":true,"metrics":true,"custom_brand":true,"mhpns":true,"saml":true,"password_requirements":true,"future_features":true}}` {
		t.Fatal("JSON not as expected")
	}
}

func TestLicenseFromJson(t *testing.T) {
	valid := `{"id":"rcgiyftm7jyrxnma1osd8zswby","issued_at":123456789000,"starts_at":123456789000,"expires_at":123456789000,"customer":{"id":"rcgiyftm7jyrxnma1osd8zswb7","name":"Customer Name","email":"customer@customer.com","company":"Customer Company","phone_number":"01234567890"},"features":{"users":200,"ldap":true,"mfa":true,"google_oauth":true,"office365_oauth":true,"compliance":true,"cluster":true,"metrics":true,"custom_brand":true,"mhpns":true,"saml":true,"password_requirements":true,"future_features":true}}`

	l1 := LicenseFromJson(strings.NewReader(valid))
	if l1 == nil {
		t.Fatalf("Decoding failed but should have passed.")
	}

	CheckString(t, l1.Id, "rcgiyftm7jyrxnma1osd8zswby")
	CheckInt64(t, l1.IssuedAt, 123456789000)
	CheckInt64(t, l1.StartsAt, 123456789000)
	CheckInt64(t, l1.ExpiresAt, 123456789000)

	CheckString(t, l1.Customer.Id, "rcgiyftm7jyrxnma1osd8zswb7")
	CheckString(t, l1.Customer.Name, "Customer Name")
	CheckString(t, l1.Customer.Email, "customer@customer.com")
	CheckString(t, l1.Customer.Company, "Customer Company")
	CheckString(t, l1.Customer.PhoneNumber, "01234567890")

	f := l1.Features

	CheckInt(t, *f.Users, 200)
	CheckTrue(t, *f.LDAP)
	CheckTrue(t, *f.MFA)
	CheckTrue(t, *f.GoogleOAuth)
	CheckTrue(t, *f.Office365OAuth)
	CheckTrue(t, *f.Compliance)
	CheckTrue(t, *f.Cluster)
	CheckTrue(t, *f.Metrics)
	CheckTrue(t, *f.CustomBrand)
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.PasswordRequirements)
	CheckTrue(t, *f.FutureFeatures)

	invalid := `{"asdf`
	l2 := LicenseFromJson(strings.NewReader(invalid))
	if l2 != nil {
		t.Fatalf("Should have failed but didn't")
	}
}

func TestLicenseRecordIsValid(t *testing.T) {
	lr := LicenseRecord{
		CreateAt: GetMillis(),
		Bytes:    "asdfghjkl;",
	}

	if err := lr.IsValid(); err == nil {
		t.Fatalf("Should have been invalid")
	}

	lr.Id = NewId()
	lr.CreateAt = 0
	if err := lr.IsValid(); err == nil {
		t.Fatalf("Should have been invalid")
	}

	lr.CreateAt = GetMillis()
	lr.Bytes = ""
	if err := lr.IsValid(); err == nil {
		t.Fatalf("Should have been invalid")
	}

	lr.Bytes = strings.Repeat("0123456789", 1001)
	if err := lr.IsValid(); err == nil {
		t.Fatalf("Should have been invalid")
	}

	lr.Bytes = "ASDFGHJKL;"
	if err := lr.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestLicenseRecordPreSave(t *testing.T) {
	lr := LicenseRecord{}
	lr.PreSave()

	if lr.CreateAt == 0 {
		t.Fatal("CreateAt should not be zero")
	}
}
