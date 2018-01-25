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

type credProvider struct {
	creds   Value
	expired bool
	err     error
}

func (s *credProvider) Retrieve() (Value, error) {
	s.expired = false
	return s.creds, s.err
}
func (s *credProvider) IsExpired() bool {
	return s.expired
}

func TestCredentialsGet(t *testing.T) {
	c := New(&credProvider{
		creds: Value{
			AccessKeyID:     "UXHW",
			SecretAccessKey: "MYSECRET",
			SessionToken:    "",
		},
		expired: true,
	})

	creds, err := c.Get()
	if err != nil {
		t.Fatal(err)
	}
	if "UXHW" != creds.AccessKeyID {
		t.Errorf("Expected \"UXHW\", got %s", creds.AccessKeyID)
	}
	if "MYSECRET" != creds.SecretAccessKey {
		t.Errorf("Expected \"MYSECRET\", got %s", creds.SecretAccessKey)
	}
	if creds.SessionToken != "" {
		t.Errorf("Expected session token to be empty, got %s", creds.SessionToken)
	}
}

func TestCredentialsGetWithError(t *testing.T) {
	c := New(&credProvider{err: errors.New("Custom error")})

	_, err := c.Get()
	if err != nil {
		if err.Error() != "Custom error" {
			t.Errorf("Expected \"Custom error\", got %s", err.Error())
		}
	}
}
