package uuid

// relevant bits from https://github.com/abneptis/GoUUID/blob/master/uuid.go

import (
	"crypto/rand"
	"fmt"
)

type UUID [16]byte

// NewV4 returns random generated UUID.
func NewV4() *UUID {
	u := &UUID{}
	_, err := rand.Read(u[:16])
	if err != nil {
		panic(err)
	}

	u[8] = (u[8] | 0x80) & 0xBf
	u[6] = (u[6] | 0x40) & 0x4f
	return u
}

func (u *UUID) String() string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", u[:4], u[4:6], u[6:8], u[8:10], u[10:])
}
