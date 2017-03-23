package pq

// This file contains SSL tests

import (
	_ "crypto/sha256"
	"crypto/x509"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func maybeSkipSSLTests(t *testing.T) {
	// Require some special variables for testing certificates
	if os.Getenv("PQSSLCERTTEST_PATH") == "" {
		t.Skip("PQSSLCERTTEST_PATH not set, skipping SSL tests")
	}

	value := os.Getenv("PQGOSSLTESTS")
	if value == "" || value == "0" {
		t.Skip("PQGOSSLTESTS not enabled, skipping SSL tests")
	} else if value != "1" {
		t.Fatalf("unexpected value %q for PQGOSSLTESTS", value)
	}
}

func openSSLConn(t *testing.T, conninfo string) (*sql.DB, error) {
	db, err := openTestConnConninfo(conninfo)
	if err != nil {
		// should never fail
		t.Fatal(err)
	}
	// Do something with the connection to see whether it's working or not.
	tx, err := db.Begin()
	if err == nil {
		return db, tx.Rollback()
	}
	_ = db.Close()
	return nil, err
}

func checkSSLSetup(t *testing.T, conninfo string) {
	_, err := openSSLConn(t, conninfo)
	if pge, ok := err.(*Error); ok {
		if pge.Code.Name() != "invalid_authorization_specification" {
			t.Fatalf("unexpected error code '%s'", pge.Code.Name())
		}
	} else {
		t.Fatalf("expected %T, got %v", (*Error)(nil), err)
	}
}

// Connect over SSL and run a simple query to test the basics
func TestSSLConnection(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	db, err := openSSLConn(t, "sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
	rows, err := db.Query("SELECT 1")
	if err != nil {
		t.Fatal(err)
	}
	rows.Close()
}

// Test sslmode=verify-full
func TestSSLVerifyFull(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	// Not OK according to the system CA
	_, err := openSSLConn(t, "host=postgres sslmode=verify-full user=pqgossltest")
	if err == nil {
		t.Fatal("expected error")
	}
	_, ok := err.(x509.UnknownAuthorityError)
	if !ok {
		t.Fatalf("expected x509.UnknownAuthorityError, got %#+v", err)
	}

	rootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "root.crt")
	rootCert := "sslrootcert=" + rootCertPath + " "
	// No match on Common Name
	_, err = openSSLConn(t, rootCert+"host=127.0.0.1 sslmode=verify-full user=pqgossltest")
	if err == nil {
		t.Fatal("expected error")
	}
	_, ok = err.(x509.HostnameError)
	if !ok {
		t.Fatalf("expected x509.HostnameError, got %#+v", err)
	}
	// OK
	_, err = openSSLConn(t, rootCert+"host=postgres sslmode=verify-full user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
}

// Test sslmode=require sslrootcert=rootCertPath
func TestSSLRequireWithRootCert(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	bogusRootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "bogus_root.crt")
	bogusRootCert := "sslrootcert=" + bogusRootCertPath + " "

	// Not OK according to the bogus CA
	_, err := openSSLConn(t, bogusRootCert+"host=postgres sslmode=require user=pqgossltest")
	if err == nil {
		t.Fatal("expected error")
	}
	_, ok := err.(x509.UnknownAuthorityError)
	if !ok {
		t.Fatalf("expected x509.UnknownAuthorityError, got %s, %#+v", err, err)
	}

	nonExistentCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "non_existent.crt")
	nonExistentCert := "sslrootcert=" + nonExistentCertPath + " "

	// No match on Common Name, but that's OK because we're not validating anything.
	_, err = openSSLConn(t, nonExistentCert+"host=127.0.0.1 sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}

	rootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "root.crt")
	rootCert := "sslrootcert=" + rootCertPath + " "

	// No match on Common Name, but that's OK because we're not validating the CN.
	_, err = openSSLConn(t, rootCert+"host=127.0.0.1 sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
	// Everything OK
	_, err = openSSLConn(t, rootCert+"host=postgres sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
}

// Test sslmode=verify-ca
func TestSSLVerifyCA(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	// Not OK according to the system CA
	{
		_, err := openSSLConn(t, "host=postgres sslmode=verify-ca user=pqgossltest")
		if _, ok := err.(x509.UnknownAuthorityError); !ok {
			t.Fatalf("expected %T, got %#+v", x509.UnknownAuthorityError{}, err)
		}
	}

	// Still not OK according to the system CA; empty sslrootcert is treated as unspecified.
	{
		_, err := openSSLConn(t, "host=postgres sslmode=verify-ca user=pqgossltest sslrootcert=''")
		if _, ok := err.(x509.UnknownAuthorityError); !ok {
			t.Fatalf("expected %T, got %#+v", x509.UnknownAuthorityError{}, err)
		}
	}

	rootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "root.crt")
	rootCert := "sslrootcert=" + rootCertPath + " "
	// No match on Common Name, but that's OK
	if _, err := openSSLConn(t, rootCert+"host=127.0.0.1 sslmode=verify-ca user=pqgossltest"); err != nil {
		t.Fatal(err)
	}
	// Everything OK
	if _, err := openSSLConn(t, rootCert+"host=postgres sslmode=verify-ca user=pqgossltest"); err != nil {
		t.Fatal(err)
	}
}

// Authenticate over SSL using client certificates
func TestSSLClientCertificates(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	const baseinfo = "sslmode=require user=pqgosslcert"

	// Certificate not specified, should fail
	{
		_, err := openSSLConn(t, baseinfo)
		if pge, ok := err.(*Error); ok {
			if pge.Code.Name() != "invalid_authorization_specification" {
				t.Fatalf("unexpected error code '%s'", pge.Code.Name())
			}
		} else {
			t.Fatalf("expected %T, got %v", (*Error)(nil), err)
		}
	}

	// Empty certificate specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert=''")
		if pge, ok := err.(*Error); ok {
			if pge.Code.Name() != "invalid_authorization_specification" {
				t.Fatalf("unexpected error code '%s'", pge.Code.Name())
			}
		} else {
			t.Fatalf("expected %T, got %v", (*Error)(nil), err)
		}
	}

	// Non-existent certificate specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert=/tmp/filedoesnotexist")
		if pge, ok := err.(*Error); ok {
			if pge.Code.Name() != "invalid_authorization_specification" {
				t.Fatalf("unexpected error code '%s'", pge.Code.Name())
			}
		} else {
			t.Fatalf("expected %T, got %v", (*Error)(nil), err)
		}
	}

	certpath, ok := os.LookupEnv("PQSSLCERTTEST_PATH")
	if !ok {
		t.Fatalf("PQSSLCERTTEST_PATH not present in environment")
	}

	sslcert := filepath.Join(certpath, "postgresql.crt")

	// Cert present, key not specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert="+sslcert)
		if _, ok := err.(*os.PathError); !ok {
			t.Fatalf("expected %T, got %#+v", (*os.PathError)(nil), err)
		}
	}

	// Cert present, empty key specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey=''")
		if _, ok := err.(*os.PathError); !ok {
			t.Fatalf("expected %T, got %#+v", (*os.PathError)(nil), err)
		}
	}

	// Cert present, non-existent key, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey=/tmp/filedoesnotexist")
		if _, ok := err.(*os.PathError); !ok {
			t.Fatalf("expected %T, got %#+v", (*os.PathError)(nil), err)
		}
	}

	// Key has wrong permissions (passing the cert as the key), should fail
	if _, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey="+sslcert); err != ErrSSLKeyHasWorldPermissions {
		t.Fatalf("expected %s, got %#+v", ErrSSLKeyHasWorldPermissions, err)
	}

	sslkey := filepath.Join(certpath, "postgresql.key")

	// Should work
	if db, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey="+sslkey); err != nil {
		t.Fatal(err)
	} else {
		rows, err := db.Query("SELECT 1")
		if err != nil {
			t.Fatal(err)
		}
		if err := rows.Close(); err != nil {
			t.Fatal(err)
		}
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
	}
}
