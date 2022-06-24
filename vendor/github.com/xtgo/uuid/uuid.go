// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package uuid can be used to generate and parse universally unique
// identifiers, a standardized format in the form of a 128 bit number.
//
// http://tools.ietf.org/html/rfc4122
package uuid

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net"
	"strconv"
	"time"
)

type UUID [16]byte

var hardwareAddr []byte

const (
	VariantNCSCompat = 0
	VariantIETF      = 2
	VariantMicrosoft = 6
	VariantFuture    = 7
)

func init() {
	if interfaces, err := net.Interfaces(); err == nil {
		for _, i := range interfaces {
			if i.Flags&net.FlagLoopback == 0 && len(i.HardwareAddr) > 0 {
				hardwareAddr = i.HardwareAddr
				break
			}
		}
	}
	if hardwareAddr == nil {
		// If we failed to obtain the MAC address of the current computer,
		// we will use a randomly generated 6 byte sequence instead and set
		// the multicast bit as recommended in RFC 4122.
		hardwareAddr = make([]byte, 6)
		_, err := io.ReadFull(rand.Reader, hardwareAddr)
		if err != nil {
			panic(err)
		}
		hardwareAddr[0] = hardwareAddr[0] | 0x01
	}
}

// Parse parses a 32 digit hexadecimal number (that might contain hyphens)
// representing an UUID.
func Parse(input string) (UUID, error) {
	var u UUID
	j := 0
	for i := 0; i < len(input); i++ {
		b := input[i]
		switch {
		default:
			fallthrough
		case j == 32:
			goto err
		case b == '-':
			continue
		case '0' <= b && b <= '9':
			b -= '0'
		case 'a' <= b && b <= 'f':
			b -= 'a' - 10
		case 'A' <= b && b <= 'F':
			b -= 'A' - 10
		}
		u[j/2] |= b << byte(^j&1<<2)
		j++
	}
	if j == 32 {
		return u, nil
	}
err:
	return UUID{}, errors.New("invalid UUID " + strconv.Quote(input))
}

// FromBytes converts a raw byte slice to an UUID. It will panic if the slice
// isn't exactly 16 bytes long.
func FromBytes(input []byte) UUID {
	var u UUID
	if len(input) != 16 {
		panic("UUIDs must be exactly 16 bytes long")
	}
	copy(u[:], input)
	return u
}

// NewRandom generates a totally random UUID (version 4) as described in
// RFC 4122.
func NewRandom() UUID {
	var u UUID
	io.ReadFull(rand.Reader, u[:])
	u[6] &= 0x0F // clear version
	u[6] |= 0x40 // set version to 4 (random uuid)
	u[8] &= 0x3F // clear variant
	u[8] |= 0x80 // set to IETF variant
	return u
}

var timeBase = time.Date(1582, time.October, 15, 0, 0, 0, 0, time.UTC).Unix()

// NewTime generates a new time based UUID (version 1) as described in RFC
// 4122. This UUID contains the MAC address of the node that generated the
// UUID, a timestamp and a sequence number.
func NewTime() UUID {
	var u UUID

	now := time.Now().In(time.UTC)
	t := uint64(now.Unix()-timeBase)*10000000 + uint64(now.Nanosecond()/100)
	u[0], u[1], u[2], u[3] = byte(t>>24), byte(t>>16), byte(t>>8), byte(t)
	u[4], u[5] = byte(t>>40), byte(t>>32)
	u[6], u[7] = byte(t>>56)&0x0F, byte(t>>48)

	var clockSeq [2]byte
	io.ReadFull(rand.Reader, clockSeq[:])
	u[8] = clockSeq[1]
	u[9] = clockSeq[0]

	copy(u[10:], hardwareAddr)

	u[6] |= 0x10 // set version to 1 (time based uuid)
	u[8] &= 0x3F // clear variant
	u[8] |= 0x80 // set to IETF variant

	return u
}

// String returns the UUID in it's canonical form, a 32 digit hexadecimal
// number in the form of xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
func (u UUID) String() string {
	buf := [36]byte{8: '-', 13: '-', 18: '-', 23: '-'}
	hex.Encode(buf[0:], u[0:4])
	hex.Encode(buf[9:], u[4:6])
	hex.Encode(buf[14:], u[6:8])
	hex.Encode(buf[19:], u[8:10])
	hex.Encode(buf[24:], u[10:])
	return string(buf[:])
}

// Bytes returns the raw byte slice for this UUID. A UUID is always 128 bits
// (16 bytes) long.
func (u UUID) Bytes() []byte {
	return u[:]
}

// Variant returns the variant of this UUID. This package will only generate
// UUIDs in the IETF variant.
func (u UUID) Variant() int {
	x := u[8]
	switch byte(0) {
	case x & 0x80:
		return VariantNCSCompat
	case x & 0x40:
		return VariantIETF
	case x & 0x20:
		return VariantMicrosoft
	}
	return VariantFuture
}

// Version extracts the version of this UUID variant. The RFC 4122 describes
// five kinds of UUIDs.
func (u UUID) Version() int {
	return int(u[6] & 0xF0 >> 4)
}

// Node extracts the MAC address of the node who generated this UUID. It will
// return nil if the UUID is not a time based UUID (version 1).
func (u UUID) Node() []byte {
	if u.Version() != 1 {
		return nil
	}
	return u[10:]
}

// Timestamp extracts the timestamp information from a time based UUID
// (version 1).
func (u UUID) Timestamp() uint64 {
	if u.Version() != 1 {
		return 0
	}
	return uint64(u[0])<<24 + uint64(u[1])<<16 + uint64(u[2])<<8 +
		uint64(u[3]) + uint64(u[4])<<40 + uint64(u[5])<<32 +
		uint64(u[7])<<48 + uint64(u[6]&0x0F)<<56
}

// Time is like Timestamp, except that it returns a time.Time.
func (u UUID) Time() time.Time {
	t := u.Timestamp()
	if t == 0 {
		return time.Time{}
	}
	sec := t / 10000000
	nsec := t - sec
	return time.Unix(int64(sec)+timeBase, int64(nsec))
}
