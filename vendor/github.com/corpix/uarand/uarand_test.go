package uarand

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetRandom(t *testing.T) {
	for k := 0; k < len(UserAgents)*10; k++ {
		assert.NotEqual(t, "", GetRandom())
	}
}
