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
	"encoding/base64"
	"fmt"

	dsig "github.com/russellhaering/goxmldsig"
)

func (sp *SAMLServiceProvider) validateLogoutRequestAttributes(request *LogoutRequest) error {
	if request.Destination != "" && request.Destination != sp.ServiceProviderSLOURL {
		return ErrInvalidValue{
			Key:      DestinationAttr,
			Expected: sp.ServiceProviderSLOURL,
			Actual:   request.Destination,
		}
	}

	if request.Version != "2.0" {
		return ErrInvalidValue{
			Reason:   ReasonUnsupported,
			Key:      "SAML version",
			Expected: "2.0",
			Actual:   request.Version,
		}
	}

	return nil
}

func (sp *SAMLServiceProvider) ValidateEncodedLogoutRequestPOST(encodedRequest string) (*LogoutRequest, error) {
	raw, err := base64.StdEncoding.DecodeString(encodedRequest)
	if err != nil {
		return nil, err
	}

	// Parse the raw request - parseResponse is generic
	doc, el, err := parseResponse(raw)
	if err != nil {
		return nil, err
	}

	var requestSignatureValidated bool
	if !sp.SkipSignatureValidation {
		el, err = sp.validateElementSignature(el)
		if err == dsig.ErrMissingSignature {
			// Unfortunately we just blew away our Response
			el = doc.Root()
		} else if err != nil {
			return nil, err
		} else if el == nil {
			return nil, fmt.Errorf("missing transformed logout request")
		} else {
			requestSignatureValidated = true
		}
	}

	decodedRequest := &LogoutRequest{}
	err = xmlUnmarshalElement(el, decodedRequest)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal logout request: %v", err)
	}
	decodedRequest.SignatureValidated = requestSignatureValidated

	err = sp.ValidateDecodedLogoutRequest(decodedRequest)
	if err != nil {
		return nil, err
	}

	return decodedRequest, nil
}
