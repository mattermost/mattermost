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

import (
	"encoding/xml"
	"github.com/mattermost/gosaml2/types"
	"time"
)

// LogoutRequest is the go struct representation of a logout request
type LogoutRequest struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol LogoutRequest"`
	ID      string   `xml:"ID,attr"`
	Version string   `xml:"Version,attr"`
	//ProtocolBinding     string          `xml:",attr"`

	IssueInstant time.Time `xml:"IssueInstant,attr"`

	Destination string        `xml:"Destination,attr"`
	Issuer      *types.Issuer `xml:"Issuer"`

	NameID             *types.NameID `xml:"NameID"`
	SignatureValidated bool          `xml:"-"` // not read, not dumped
}
