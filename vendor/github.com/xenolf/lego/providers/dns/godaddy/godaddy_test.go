package godaddy

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

var (
	godaddyAPIKey    string
	godaddyAPISecret string
	godaddyDomain    string
	godaddyLiveTest  bool
)

func init() {
	godaddyAPIKey = os.Getenv("GODADDY_API_KEY")
	godaddyAPISecret = os.Getenv("GODADDY_API_SECRET")
	godaddyDomain = os.Getenv("GODADDY_DOMAIN")

	if len(godaddyAPIKey) > 0 && len(godaddyAPISecret) > 0 && len(godaddyDomain) > 0 {
		godaddyLiveTest = true
	}
}

func TestNewDNSProvider(t *testing.T) {
	provider, err := NewDNSProvider()

	if !godaddyLiveTest {
		assert.Error(t, err)
	} else {
		assert.NotNil(t, provider)
		assert.NoError(t, err)
	}
}

func TestDNSProvider_Present(t *testing.T) {
	if !godaddyLiveTest {
		t.Skip("skipping live test")
	}

	provider, err := NewDNSProvider()
	assert.NoError(t, err)

	err = provider.Present(godaddyDomain, "", "123d==")
	assert.NoError(t, err)
}

func TestDNSProvider_CleanUp(t *testing.T) {
	if !godaddyLiveTest {
		t.Skip("skipping live test")
	}

	provider, err := NewDNSProvider()
	assert.NoError(t, err)

	err = provider.CleanUp(godaddyDomain, "", "123d==")
	assert.NoError(t, err)
}
