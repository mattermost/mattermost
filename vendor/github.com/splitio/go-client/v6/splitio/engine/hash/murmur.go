package hash

// Murmur calculates the bucket for the key and seed provided using the legacy algorithm
// © Copyright 2014 Lawrence E. Bakst All Rights Reserved
// THIS SOURCE CODE IS THE PROPRIETARY INTELLECTUAL PROPERTY AND CONFIDENTIAL
// INFORMATION OF LAWRENCE E. BAKST AND IS PROTECTED UNDER U.S. AND
// INTERNATIONAL LAW. ANY USE OF THIS SOURCE CODE WITHOUT THE
// AUTHORIZATION OF LAWRENCE E. BAKST IS STRICTLY PROHIBITED.

// This package implements the 32 bit version of the MurmurHash3 hash code.
// With the exception of the interface check, this version was developed independtly.
// However, the "spaolacci" implementation with it's bmixer interface is da bomb, although
// this version is slightly faster.
//
// https://en.wikipedia.org/wiki/MurmurHash
// https://github.com/spaolacci/murmur3

const (
	c1 uint32 = 0xcc9e2d51
	c2 uint32 = 0x1b873593
	r1 uint32 = 15
	r2 uint32 = 13
	m  uint32 = 5
	n  uint32 = 0xe6546b64
)

// Murmur3_32 returns the 32 bit hash of data given the seed.
// This is code is what I started with before I added the hash.Hash and hash.Hash32 interfaces.
func Murmur3_32(data []byte, seed uint32) uint32 {
	hash := seed
	nblocks := len(data) / 4
	for i := 0; i < nblocks; i++ {
		// k := *(*uint32)(unsafe.Pointer(&data[i*4]))
		k := uint32(data[i*4+0])<<0 | uint32(data[i*4+1])<<8 | uint32(data[i*4+2])<<16 | uint32(data[i*4+3])<<24
		k *= c1
		k = (k << r1) | (k >> (32 - r1))
		k *= c2
		hash ^= k
		hash = ((hash<<r2)|(hash>>(32-r2)))*m + n
	}

	l := nblocks * 4
	k1 := uint32(0)
	switch len(data) & 3 {
	case 3:
		k1 ^= uint32(data[l+2]) << 16
		fallthrough
	case 2:
		k1 ^= uint32(data[l+1]) << 8
		fallthrough
	case 1:
		k1 ^= uint32(data[l+0])
		k1 *= c1
		k1 = (k1 << r1) | (k1 >> (32 - r1))
		k1 *= c2
		hash ^= k1
	}

	hash ^= uint32(len(data))
	hash ^= hash >> 16
	hash *= 0x85ebca6b
	hash ^= hash >> 13
	hash *= 0xc2b2ae35
	hash ^= hash >> 16
	return hash
}
