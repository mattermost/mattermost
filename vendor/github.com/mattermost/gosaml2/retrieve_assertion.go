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

import "fmt"

//ErrMissingElement is the error type that indicates an element and/or attribute is
//missing. It provides a structured error that can be more appropriately acted
//upon.
type ErrMissingElement struct {
	Tag, Attribute string
}

type ErrVerification struct {
	Cause error
}

func (e ErrVerification) Error() string {
	return fmt.Sprintf("error validating response: %s", e.Cause.Error())
}

//ErrMissingAssertion indicates that an appropriate assertion element could not
//be found in the SAML Response
var (
	ErrMissingAssertion = ErrMissingElement{Tag: AssertionTag}
)

func (e ErrMissingElement) Error() string {
	if e.Attribute != "" {
		return fmt.Sprintf("missing %s attribute on %s element", e.Attribute, e.Tag)
	}
	return fmt.Sprintf("missing %s element", e.Tag)
}

//RetrieveAssertionInfo takes an encoded response and returns the AssertionInfo
//contained, or an error message if an error has been encountered.
func (sp *SAMLServiceProvider) RetrieveAssertionInfo(encodedResponse string) (*AssertionInfo, error) {
	assertionInfo := &AssertionInfo{
		Values: make(Values),
	}

	response, err := sp.ValidateEncodedResponse(encodedResponse)
	if err != nil {
		return nil, ErrVerification{Cause: err}
	}

	// TODO: Support multiple assertions
	if len(response.Assertions) == 0 {
		return nil, ErrMissingAssertion
	}

	assertion := response.Assertions[0]
	assertionInfo.Assertions = response.Assertions
	assertionInfo.ResponseSignatureValidated = response.SignatureValidated

	warningInfo, err := sp.VerifyAssertionConditions(&assertion)
	if err != nil {
		return nil, err
	}

	//Get the NameID
	subject := assertion.Subject
	if subject == nil {
		return nil, ErrMissingElement{Tag: SubjectTag}
	}

	nameID := subject.NameID
	if nameID == nil {
		return nil, ErrMissingElement{Tag: NameIdTag}
	}

	assertionInfo.NameID = nameID.Value

	//Get the actual assertion attributes
	attributeStatement := assertion.AttributeStatement
	if attributeStatement == nil && !sp.AllowMissingAttributes {
		return nil, ErrMissingElement{Tag: AttributeStatementTag}
	}

	if attributeStatement != nil {
		for _, attribute := range attributeStatement.Attributes {
			assertionInfo.Values[attribute.Name] = attribute
		}
	}

	if assertion.AuthnStatement != nil {
		if assertion.AuthnStatement.AuthnInstant != nil {
			assertionInfo.AuthnInstant = assertion.AuthnStatement.AuthnInstant
		}
		if assertion.AuthnStatement.SessionNotOnOrAfter != nil {
			assertionInfo.SessionNotOnOrAfter = assertion.AuthnStatement.SessionNotOnOrAfter
		}

		assertionInfo.SessionIndex = assertion.AuthnStatement.SessionIndex
	}

	assertionInfo.WarningInfo = warningInfo
	return assertionInfo, nil
}
