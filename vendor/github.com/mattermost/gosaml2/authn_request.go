// Copyright 2016 Russell Haering et al.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package saml2

import "time"

// AuthNRequest is the go struct representation of an authentication request
type AuthNRequest struct {
	ID                          string `xml:",attr"`
	Version                     string `xml:",attr"`
	ProtocolBinding             string `xml:",attr"`
	AssertionConsumerServiceURL string `xml:",attr"`

	IssueInstant time.Time `xml:",attr"`

	Destination string `xml:",attr"`
	Issuer      string
}
