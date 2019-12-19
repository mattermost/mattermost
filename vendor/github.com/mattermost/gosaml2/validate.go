package saml2

import (
	"fmt"
	"time"

	"github.com/mattermost/gosaml2/types"
)

//ErrParsing indicates that the value present in an assertion could not be
//parsed. It can be inspected for the specific tag name, the contents, and the
//intended type.
type ErrParsing struct {
	Tag, Value, Type string
}

func (ep ErrParsing) Error() string {
	return fmt.Sprintf("Error parsing %s tag value as type %s", ep.Tag, ep.Value)
}

//Oft-used messages
const (
	ReasonUnsupported = "Unsupported"
	ReasonExpired     = "Expired"
)

//ErrInvalidValue indicates that the expected value did not match the received
//value.
type ErrInvalidValue struct {
	Key, Expected, Actual string
	Reason                string
}

func (e ErrInvalidValue) Error() string {
	if e.Reason == "" {
		e.Reason = "Unrecognized"
	}
	return fmt.Sprintf("%s %s value, Expected: %s, Actual: %s", e.Reason, e.Key, e.Expected, e.Actual)
}

//Well-known methods of subject confirmation
const (
	SubjMethodBearer = "urn:oasis:names:tc:SAML:2.0:cm:bearer"
)

//VerifyAssertionConditions inspects an assertion element and makes sure that
//all SAML2 contracts are upheld.
func (sp *SAMLServiceProvider) VerifyAssertionConditions(assertion *types.Assertion) (*WarningInfo, error) {
	warningInfo := &WarningInfo{}
	now := sp.Clock.Now()

	conditions := assertion.Conditions
	if conditions == nil {
		return nil, ErrMissingElement{Tag: ConditionsTag}
	}

	if conditions.NotBefore == "" {
		return nil, ErrMissingElement{Tag: ConditionsTag, Attribute: NotBeforeAttr}
	}

	notBefore, err := time.Parse(time.RFC3339, conditions.NotBefore)
	if err != nil {
		return nil, ErrParsing{Tag: NotBeforeAttr, Value: conditions.NotBefore, Type: "time.RFC3339"}
	}

	if now.Before(notBefore) {
		warningInfo.InvalidTime = true
	}

	if conditions.NotOnOrAfter == "" {
		return nil, ErrMissingElement{Tag: ConditionsTag, Attribute: NotOnOrAfterAttr}
	}

	notOnOrAfter, err := time.Parse(time.RFC3339, conditions.NotOnOrAfter)
	if err != nil {
		return nil, ErrParsing{Tag: NotOnOrAfterAttr, Value: conditions.NotOnOrAfter, Type: "time.RFC3339"}
	}

	if now.After(notOnOrAfter) {
		warningInfo.InvalidTime = true
	}

	for _, audienceRestriction := range conditions.AudienceRestrictions {
		matched := false

		for _, audience := range audienceRestriction.Audiences {
			if audience.Value == sp.AudienceURI {
				matched = true
				break
			}
		}

		if !matched {
			warningInfo.NotInAudience = true
			break
		}
	}

	if conditions.OneTimeUse != nil {
		warningInfo.OneTimeUse = true
	}

	proxyRestriction := conditions.ProxyRestriction
	if proxyRestriction != nil {
		proxyRestrictionInfo := &ProxyRestriction{
			Count:    proxyRestriction.Count,
			Audience: []string{},
		}

		for _, audience := range proxyRestriction.Audience {
			proxyRestrictionInfo.Audience = append(proxyRestrictionInfo.Audience, audience.Value)
		}

		warningInfo.ProxyRestriction = proxyRestrictionInfo
	}

	return warningInfo, nil
}

//Validate ensures that the assertion passed is valid for the current Service
//Provider.
func (sp *SAMLServiceProvider) Validate(response *types.Response) error {
	err := sp.validateResponseAttributes(response)
	if err != nil {
		return err
	}

	if len(response.Assertions) == 0 {
		return ErrMissingAssertion
	}

	issuer := response.Issuer
	if issuer == nil {
		// FIXME?: SAML Core 2.0 Section 3.2.2 has Response.Issuer as [Optional]
		return ErrMissingElement{Tag: IssuerTag}
	}

	if sp.IdentityProviderIssuer != "" && response.Issuer.Value != sp.IdentityProviderIssuer {
		return ErrInvalidValue{
			Key:      IssuerTag,
			Expected: sp.IdentityProviderIssuer,
			Actual:   response.Issuer.Value,
		}
	}

	status := response.Status
	if status == nil {
		return ErrMissingElement{Tag: StatusTag}
	}

	statusCode := status.StatusCode
	if statusCode == nil {
		return ErrMissingElement{Tag: StatusCodeTag}
	}

	if statusCode.Value != StatusCodeSuccess {
		return ErrInvalidValue{
			Key:      StatusCodeTag,
			Expected: StatusCodeSuccess,
			Actual:   statusCode.Value,
		}
	}

	for _, assertion := range response.Assertions {
		issuer = assertion.Issuer
		if issuer == nil {
			return ErrMissingElement{Tag: IssuerTag}
		}
		if sp.IdentityProviderIssuer != "" && assertion.Issuer.Value != sp.IdentityProviderIssuer {
			return ErrInvalidValue{
				Key:      IssuerTag,
				Expected: sp.IdentityProviderIssuer,
				Actual:   issuer.Value,
			}
		}

		subject := assertion.Subject
		if subject == nil {
			return ErrMissingElement{Tag: SubjectTag}
		}

		subjectConfirmation := subject.SubjectConfirmation
		if subjectConfirmation == nil {
			return ErrMissingElement{Tag: SubjectConfirmationTag}
		}

		if subjectConfirmation.Method != SubjMethodBearer {
			return ErrInvalidValue{
				Reason:   ReasonUnsupported,
				Key:      SubjectConfirmationTag,
				Expected: SubjMethodBearer,
				Actual:   subjectConfirmation.Method,
			}
		}

		subjectConfirmationData := subjectConfirmation.SubjectConfirmationData
		if subjectConfirmationData == nil {
			return ErrMissingElement{Tag: SubjectConfirmationDataTag}
		}

		if subjectConfirmationData.Recipient != sp.AssertionConsumerServiceURL {
			return ErrInvalidValue{
				Key:      RecipientAttr,
				Expected: sp.AssertionConsumerServiceURL,
				Actual:   subjectConfirmationData.Recipient,
			}
		}

		if subjectConfirmationData.NotOnOrAfter == "" {
			return ErrMissingElement{Tag: SubjectConfirmationDataTag, Attribute: NotOnOrAfterAttr}
		}

		notOnOrAfter, err := time.Parse(time.RFC3339, subjectConfirmationData.NotOnOrAfter)
		if err != nil {
			return ErrParsing{Tag: NotOnOrAfterAttr, Value: subjectConfirmationData.NotOnOrAfter, Type: "time.RFC3339"}
		}

		now := sp.Clock.Now()
		if now.After(notOnOrAfter) {
			return ErrInvalidValue{
				Reason:   ReasonExpired,
				Key:      NotOnOrAfterAttr,
				Expected: now.Format(time.RFC3339),
				Actual:   subjectConfirmationData.NotOnOrAfter,
			}
		}

	}

	return nil
}
