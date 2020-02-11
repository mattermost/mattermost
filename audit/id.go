// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"bytes"
	"encoding/base32"

	"github.com/pborman/uuid"
)

var (
	// IDGenerator creates a new unique id for audit records. Default creates UUIDv4
	// ids that are base32 encoded (padding stripped).
	// Reassign to generate custom ids.
	IDGenerator func() string = newID
)

// encoding provides the 32 chars for base32 encoding
var encoding = base32.NewEncoding("ybndrfg8ejkmcpqxot1uwisza345h769")

// newID is the default id generator.  It generates a [A-Z0-9] string 26
// characters long.  It is a UUID version 4 Guid that is base32 encoded
// with the padding stripped off.
func newID() string {
	var b bytes.Buffer
	encoder := base32.NewEncoder(encoding, &b)
	encoder.Write(uuid.NewRandom())
	encoder.Close()
	b.Truncate(26) // removes the '==' padding
	return b.String()
}
