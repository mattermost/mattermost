/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2017 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package credentials

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const credsRespTmpl = `{
  "Code": "Success",
  "Type": "AWS-HMAC",
  "AccessKeyId" : "accessKey",
  "SecretAccessKey" : "secret",
  "Token" : "token",
  "Expiration" : "%s",
  "LastUpdated" : "2009-11-23T0:00:00Z"
}`

const credsFailRespTmpl = `{
  "Code": "ErrorCode",
  "Message": "ErrorMsg",
  "LastUpdated": "2009-11-23T0:00:00Z"
}`

func initTestFailServer() *httptest.Server {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Not allowed", http.StatusBadRequest)
	}))
	return server
}

func initTestServerNoRoles() *httptest.Server {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(""))
	}))
	return server
}

func initTestServer(expireOn string, failAssume bool) *httptest.Server {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/latest/meta-data/iam/security-credentials" {
			fmt.Fprintln(w, "RoleName")
		} else if r.URL.Path == "/latest/meta-data/iam/security-credentials/RoleName" {
			if failAssume {
				fmt.Fprintf(w, credsFailRespTmpl)
			} else {
				fmt.Fprintf(w, credsRespTmpl, expireOn)
			}
		} else {
			http.Error(w, "bad request", http.StatusBadRequest)
		}
	}))

	return server
}

func TestIAMMalformedEndpoint(t *testing.T) {
	creds := NewIAM("%%%%")
	_, err := creds.Get()
	if err == nil {
		t.Fatal("Unexpected should fail here")
	}
	if err.Error() != `parse %%%%: invalid URL escape "%%%"` {
		t.Fatalf("Expected parse %%%%%%%%: invalid URL escape \"%%%%%%\", got %s", err)
	}
}

func TestIAMFailServer(t *testing.T) {
	server := initTestFailServer()
	defer server.Close()

	creds := NewIAM(server.URL)

	_, err := creds.Get()
	if err == nil {
		t.Fatal("Unexpected should fail here")
	}
	if err.Error() != "400 Bad Request" {
		t.Fatalf("Expected '400 Bad Request', got %s", err)
	}
}

func TestIAMNoRoles(t *testing.T) {
	server := initTestServerNoRoles()
	defer server.Close()

	creds := NewIAM(server.URL)
	_, err := creds.Get()
	if err == nil {
		t.Fatal("Unexpected should fail here")
	}
	if err.Error() != "No IAM roles attached to this EC2 service" {
		t.Fatalf("Expected 'No IAM roles attached to this EC2 service', got %s", err)
	}
}

func TestIAM(t *testing.T) {
	server := initTestServer("2014-12-16T01:51:37Z", false)
	defer server.Close()

	p := &IAM{
		Client:   http.DefaultClient,
		endpoint: server.URL,
	}

	creds, err := p.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	if "accessKey" != creds.AccessKeyID {
		t.Errorf("Expected \"accessKey\", got %s", creds.AccessKeyID)
	}

	if "secret" != creds.SecretAccessKey {
		t.Errorf("Expected \"secret\", got %s", creds.SecretAccessKey)
	}

	if "token" != creds.SessionToken {
		t.Errorf("Expected \"token\", got %s", creds.SessionToken)
	}

	if !p.IsExpired() {
		t.Error("Expected creds to be expired.")
	}
}

func TestIAMFailAssume(t *testing.T) {
	server := initTestServer("2014-12-16T01:51:37Z", true)
	defer server.Close()

	p := &IAM{
		Client:   http.DefaultClient,
		endpoint: server.URL,
	}

	_, err := p.Retrieve()
	if err == nil {
		t.Fatal("Unexpected success, should fail")
	}
	if err.Error() != "ErrorMsg" {
		t.Errorf("Expected \"ErrorMsg\", got %s", err)
	}
}

func TestIAMIsExpired(t *testing.T) {
	server := initTestServer("2014-12-16T01:51:37Z", false)
	defer server.Close()

	p := &IAM{
		Client:   http.DefaultClient,
		endpoint: server.URL,
	}
	p.CurrentTime = func() time.Time {
		return time.Date(2014, 12, 15, 21, 26, 0, 0, time.UTC)
	}

	if !p.IsExpired() {
		t.Error("Expected creds to be expired before retrieve.")
	}

	_, err := p.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	if p.IsExpired() {
		t.Error("Expected creds to not be expired after retrieve.")
	}

	p.CurrentTime = func() time.Time {
		return time.Date(3014, 12, 15, 21, 26, 0, 0, time.UTC)
	}

	if !p.IsExpired() {
		t.Error("Expected creds to be expired when curren time has changed")
	}
}
