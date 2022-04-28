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

package types

import (
	"encoding/xml"
	"time"

	dsigtypes "github.com/russellhaering/goxmldsig/types"
)

type EntityDescriptor struct {
	XMLName    xml.Name  `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
	ValidUntil time.Time `xml:"validUntil,attr"`
	// SAML 2.0 8.3.6 Entity Identifier could be used to represent issuer
	EntityID         string            `xml:"entityID,attr"`
	SPSSODescriptor  *SPSSODescriptor  `xml:"SPSSODescriptor,omitempty"`
	IDPSSODescriptor *IDPSSODescriptor `xml:"IDPSSODescriptor,omitempty"`
	Extensions       *Extensions       `xml:"Extensions,omitempty"`
}

type Endpoint struct {
	Binding          string `xml:"Binding,attr"`
	Location         string `xml:"Location,attr"`
	ResponseLocation string `xml:"ResponseLocation,attr,omitempty"`
}

type IndexedEndpoint struct {
	Binding  string `xml:"Binding,attr"`
	Location string `xml:"Location,attr"`
	Index    int    `xml:"index,attr"`
}

type SPSSODescriptor struct {
	XMLName                    xml.Name          `xml:"urn:oasis:names:tc:SAML:2.0:metadata SPSSODescriptor"`
	AuthnRequestsSigned        bool              `xml:"AuthnRequestsSigned,attr"`
	WantAssertionsSigned       bool              `xml:"WantAssertionsSigned,attr"`
	ProtocolSupportEnumeration string            `xml:"protocolSupportEnumeration,attr"`
	KeyDescriptors             []KeyDescriptor   `xml:"KeyDescriptor"`
	SingleLogoutServices       []Endpoint        `xml:"SingleLogoutService"`
	NameIDFormats              []string          `xml:"NameIDFormat"`
	AssertionConsumerServices  []IndexedEndpoint `xml:"AssertionConsumerService"`
	Extensions                 *Extensions       `xml:"Extensions,omitempty"`
}

type IDPSSODescriptor struct {
	XMLName                 xml.Name              `xml:"urn:oasis:names:tc:SAML:2.0:metadata IDPSSODescriptor"`
	WantAuthnRequestsSigned bool                  `xml:"WantAuthnRequestsSigned,attr"`
	KeyDescriptors          []KeyDescriptor       `xml:"KeyDescriptor"`
	NameIDFormats           []NameIDFormat        `xml:"NameIDFormat"`
	SingleSignOnServices    []SingleSignOnService `xml:"SingleSignOnService"`
	SingleLogoutServices    []SingleLogoutService `xml:"SingleLogoutService"`
	Attributes              []Attribute           `xml:"Attribute"`
	Extensions              *Extensions           `xml:"Extensions,omitempty"`
}

type KeyDescriptor struct {
	XMLName           xml.Name           `xml:"urn:oasis:names:tc:SAML:2.0:metadata KeyDescriptor"`
	Use               string             `xml:"use,attr"`
	KeyInfo           dsigtypes.KeyInfo  `xml:"KeyInfo"`
	EncryptionMethods []EncryptionMethod `xml:"EncryptionMethod"`
}

type NameIDFormat struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata NameIDFormat"`
	Value   string   `xml:",chardata"`
}

type SingleSignOnService struct {
	XMLName  xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata SingleSignOnService"`
	Binding  string   `xml:"Binding,attr"`
	Location string   `xml:"Location,attr"`
}

type SingleLogoutService struct {
	XMLName  xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata SingleLogoutService"`
	Binding  string   `xml:"Binding,attr"`
	Location string   `xml:"Location,attr"`
}

type SigningMethod struct {
	Algorithm  string `xml:",attr"`
	MinKeySize string `xml:"MinKeySize,attr,omitempty"`
	MaxKeySize string `xml:"MaxKeySize,attr,omitempty"`
}

type Extensions struct {
	DigestMethod  *DigestMethod  `xml:",omitempty"`
	SigningMethod *SigningMethod `xml:",omitempty"`
}
