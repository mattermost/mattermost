// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMaskedTokenConstant(t *testing.T) {
	// The masked-token sentinel must be the eight-dash string the frontend
	// renders for hidden chips and the server emits when masking raw CEL
	// on GET / search responses.
	assert.Equal(t, "--------", maskedTokenValue)
}
