package accesstoken

import (
	"github.com/mattermost/platform/twilio/jwt"
	"testing"
)

const accoutSid = "AC556823c3d28ac704df6239be0b0423fb"
const testKey = "SK792fba4a87a0b0f77b1c74fd21297664"
const testSecret = "ZJYabbDch05NwTMeMvlOuJUGd6jWpr0H"
const videoSid = "VSd8fde6c50a5165e1077bdada30ef0008"

// Generate a token and verify the signature (HS256)
func TestJWTToken(t *testing.T) {

	token := New(accoutSid, testKey, testSecret)

	token.Identity = "TestAccount"

	//token.nbf = 16810232

	videoGrant := NewConversationsGrant(videoSid)
	token.AddGrant(videoGrant)

	signed, err := token.ToJWT(DefaultAlgorithm)

	if err != nil {
		t.Errorf("token.ToJWT Failed: %v", err)
		t.Fail()
	}

	t.Logf("Token: %s", signed)

	// Parse the token.  Load the key from command line option
	parsed, err := jwt.Decode(signed, testSecret, true)

	// Print an error if we can't parse for some reason
	if err != nil {
		t.Errorf("Couldn't parse token: %v", err)
	}

	t.Logf("Parse: %s", parsed)

}
