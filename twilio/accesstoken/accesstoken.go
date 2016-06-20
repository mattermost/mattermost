package accesstoken

import (
	"fmt"
	"github.com/mattermost/platform/twilio/jwt"
	"time"
)

// DefaultAlgorithm is your preferred signing algorithm
var DefaultAlgorithm = jwt.HS256

// AccessToken is a JWT that grants access to Twilio services
type AccessToken struct {
	accountSid string  // SID from here: https://www.twilio.com/user/account/settings
	apiKey     string  // Generated here: https://www.twilio.com/user/account/video/dev-tools/api-keys
	apiSecret  string  // Generated here: https://www.twilio.com/user/account/video/dev-tools/api-keys
	Identity   string  // Generated here: https://www.twilio.com/user/account/video/profiles
	ttl        int64   // Must be a UTC timestamp (in milliseconds). Default: 3600
	nbf        int64   // Not before time: current date/time must be after this time. Default: 0 (not enforced)
	grants     []Grant // Slice of grants attached to this
}

// New creates a new AccessToken. TTL is set to default and
// grants are defaulted to an empty slice of Grant.
func New(accountSid, apiKey, apiSecret string) *AccessToken {
	var grants []Grant
	return &AccessToken{
		accountSid: accountSid,
		apiKey:     apiKey,
		apiSecret:  apiSecret,
		ttl:        3600,
		nbf:        0,
		grants:     grants,
	}

}

// AddGrant adds a grant to this AccessToken
func (t *AccessToken) AddGrant(grant Grant) {
	t.grants = append(t.grants, grant)
}

// ToJWT returns this token as a signed JWT using the specified hash algorithm
// Returns the signed JWT or an error
// Ported from: https://github.com/twilio/twilio-python/blob/master/twilio/access_token.py
func (t *AccessToken) ToJWT(algorithm string) (string, error) {

	if algorithm == "" {
		algorithm = DefaultAlgorithm
	}

	header := map[string]interface{}{
		"typ": "JWT",
		"cty": "twilio-fpa;v=1",
	}

	now := time.Now().UTC().Unix()
	payload := map[string]interface{}{}

	payload["jti"] = fmt.Sprintf("%s-%d", t.apiKey, now)
	payload["iss"] = t.apiKey
	payload["sub"] = t.accountSid
	payload["exp"] = now + t.ttl

	if len(t.grants) > 0 {

		payload["grants"] = map[string]interface{}{}

		if len(t.Identity) > 0 {
			payload["grants"].(map[string]interface{})["identity"] = t.Identity
		}

		for _, grant := range t.grants {
			payload["grants"].(map[string]interface{})[grant.key()] = grant.toPayload()
		}

	}

	if t.nbf != 0 {
		payload["nbf"] = t.nbf
	}

	//Sign and return the AccessToken
	return jwt.Encode(payload, header, t.apiSecret, algorithm)
}
