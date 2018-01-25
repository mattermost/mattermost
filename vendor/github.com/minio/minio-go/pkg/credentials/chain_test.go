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
	"errors"
	"testing"
)

type testCredProvider struct {
	creds   Value
	expired bool
	err     error
}

func (s *testCredProvider) Retrieve() (Value, error) {
	s.expired = false
	return s.creds, s.err
}
func (s *testCredProvider) IsExpired() bool {
	return s.expired
}

func TestChainGet(t *testing.T) {
	p := &Chain{
		Providers: []Provider{
			&credProvider{err: errors.New("FirstError")},
			&credProvider{err: errors.New("SecondError")},
			&testCredProvider{
				creds: Value{
					AccessKeyID:     "AKIF",
					SecretAccessKey: "NOSECRET",
					SessionToken:    "",
				},
			},
			&credProvider{
				creds: Value{
					AccessKeyID:     "AKID",
					SecretAccessKey: "SECRET",
					SessionToken:    "",
				},
			},
		},
	}

	creds, err := p.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	// Also check credentials
	if creds.AccessKeyID != "AKIF" {
		t.Fatalf("Expected 'AKIF', got %s", creds.AccessKeyID)
	}
	if creds.SecretAccessKey != "NOSECRET" {
		t.Fatalf("Expected 'NOSECRET', got %s", creds.SecretAccessKey)
	}
	if creds.SessionToken != "" {
		t.Fatalf("Expected empty token, got %s", creds.SessionToken)
	}
}

func TestChainIsExpired(t *testing.T) {
	credProvider := &credProvider{
		creds: Value{
			AccessKeyID:     "UXHW",
			SecretAccessKey: "MYSECRET",
			SessionToken:    "",
		},
		expired: true,
	}
	p := &Chain{
		Providers: []Provider{
			credProvider,
		},
	}

	if !p.IsExpired() {
		t.Fatal("Expected expired to be true before any Retrieve")
	}

	_, err := p.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	if p.IsExpired() {
		t.Fatal("Expected to be not expired after Retrieve")
	}
}

func TestChainWithNoProvider(t *testing.T) {
	p := &Chain{
		Providers: []Provider{},
	}
	if !p.IsExpired() {
		t.Fatal("Expected to be expired with no providers")
	}
	_, err := p.Retrieve()
	if err != nil {
		if err.Error() != "No valid providers found []" {
			t.Error(err)
		}
	}
}

func TestChainProviderWithNoValidProvider(t *testing.T) {
	errs := []error{
		errors.New("FirstError"),
		errors.New("SecondError"),
	}
	p := &Chain{
		Providers: []Provider{
			&credProvider{err: errs[0]},
			&credProvider{err: errs[1]},
		},
	}

	if !p.IsExpired() {
		t.Fatal("Expected to be expired with no providers")
	}

	_, err := p.Retrieve()
	if err != nil {
		if err.Error() != "No valid providers found [FirstError SecondError]" {
			t.Error(err)
		}
	}
}
