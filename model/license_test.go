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
	CheckTrue(t, m["mhpns"].(bool))
	CheckTrue(t, m["saml"].(bool))
	CheckTrue(t, m["elastic_search"].(bool))
	CheckTrue(t, m["email_notification_contents"].(bool))
	CheckTrue(t, m["data_retention"].(bool))
	CheckTrue(t, m["message_export"].(bool))
	CheckTrue(t, m["custom_permissions_schemes"].(bool))
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
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.Elasticsearch)
	CheckTrue(t, *f.EmailNotificationContents)
	CheckTrue(t, *f.DataRetention)
	CheckTrue(t, *f.MessageExport)
	CheckTrue(t, *f.CustomPermissionsSchemes)
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
	*f.MHPNS = true
	*f.SAML = true
	*f.Elasticsearch = true
	*f.DataRetention = true
	*f.MessageExport = true
	*f.CustomPermissionsSchemes = true
	*f.EmailNotificationContents = true

	f.SetDefaults()

	CheckInt(t, *f.Users, 300)
	CheckTrue(t, *f.LDAP)
	CheckTrue(t, *f.MFA)
	CheckTrue(t, *f.GoogleOAuth)
	CheckTrue(t, *f.Office365OAuth)
	CheckTrue(t, *f.Compliance)
	CheckTrue(t, *f.Cluster)
	CheckTrue(t, *f.Metrics)
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.Elasticsearch)
	CheckTrue(t, *f.EmailNotificationContents)
	CheckTrue(t, *f.DataRetention)
	CheckTrue(t, *f.MessageExport)
	CheckTrue(t, *f.CustomPermissionsSchemes)
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

func TestLicenseToFromJson(t *testing.T) {
	f := Features{}
	f.SetDefaults()

	l := License{
		Id:        NewId(),
		IssuedAt:  GetMillis(),
		StartsAt:  GetMillis(),
		ExpiresAt: GetMillis(),
		Customer: &Customer{
			Id:          NewId(),
			Name:        NewId(),
			Email:       NewId(),
			Company:     NewId(),
			PhoneNumber: NewId(),
		},
		Features: &f,
	}

	j := l.ToJson()

	l1 := LicenseFromJson(strings.NewReader(j))
	if l1 == nil {
		t.Fatalf("Decoding failed but should have passed.")
	}

	CheckString(t, l1.Id, l.Id)
	CheckInt64(t, l1.IssuedAt, l.IssuedAt)
	CheckInt64(t, l1.StartsAt, l.StartsAt)
	CheckInt64(t, l1.ExpiresAt, l.ExpiresAt)

	CheckString(t, l1.Customer.Id, l.Customer.Id)
	CheckString(t, l1.Customer.Name, l.Customer.Name)
	CheckString(t, l1.Customer.Email, l.Customer.Email)
	CheckString(t, l1.Customer.Company, l.Customer.Company)
	CheckString(t, l1.Customer.PhoneNumber, l.Customer.PhoneNumber)

	f1 := l1.Features

	CheckInt(t, *f1.Users, *f.Users)
	CheckBool(t, *f1.LDAP, *f.LDAP)
	CheckBool(t, *f1.MFA, *f.MFA)
	CheckBool(t, *f1.GoogleOAuth, *f.GoogleOAuth)
	CheckBool(t, *f1.Office365OAuth, *f.Office365OAuth)
	CheckBool(t, *f1.Compliance, *f.Compliance)
	CheckBool(t, *f1.Cluster, *f.Cluster)
	CheckBool(t, *f1.Metrics, *f.Metrics)
	CheckBool(t, *f1.MHPNS, *f.MHPNS)
	CheckBool(t, *f1.SAML, *f.SAML)
	CheckBool(t, *f1.Elasticsearch, *f.Elasticsearch)
	CheckBool(t, *f1.DataRetention, *f.DataRetention)
	CheckBool(t, *f1.MessageExport, *f.MessageExport)
	CheckBool(t, *f1.CustomPermissionsSchemes, *f.CustomPermissionsSchemes)
	CheckBool(t, *f1.FutureFeatures, *f.FutureFeatures)

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
