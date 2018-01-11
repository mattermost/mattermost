package uarand

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUserAgents(t *testing.T) {
	assert.Equal(t, true, len(UserAgents) > 0)
}
