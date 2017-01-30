// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package arq

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha1"
	"hash"
	"log"

	"bitbucket.org/taruti/pbkdf2.go" // TODO: Pull in copy
)

type cryptoState struct {
	c    cipher.Block
	iv   []byte
	salt []byte
}

func (c *cryptoState) unlock(pw string) {
	const (
		iter      = 1000
		keyLen    = 48
		aesKeyLen = 32
		aesIVLen  = 16
	)
	key1 := pbkdf2.Pbkdf2([]byte(pw), c.salt, iter, sha1.New, keyLen)
	var key2 []byte
	key2, c.iv = bytesToKey(sha1.New, c.salt, key1, iter, aesKeyLen, aesIVLen)
	c.c, _ = aes.NewCipher(key2)
}

func (c *cryptoState) decrypt(data []byte) []byte {
	dec := cipher.NewCBCDecrypter(c.c, c.iv)
	if len(data)%aes.BlockSize != 0 {
		log.Fatal("bad block")
	}
	dec.CryptBlocks(data, data)
	//	fmt.Printf("% x\n", data)
	//	fmt.Printf("%s\n", data)

	// unpad
	{
		n := len(data)
		p := int(data[n-1])
		if p == 0 || p > aes.BlockSize {
			log.Fatal("impossible padding")
		}
		for i := 0; i < p; i++ {
			if data[n-1-i] != byte(p) {
				log.Fatal("bad padding")
			}
		}
		data = data[:n-p]
	}
	return data
}

func sha(data []byte) score {
	h := sha1.New()
	h.Write(data)
	var sc score
	copy(sc[:], h.Sum(nil))
	return sc
}

func bytesToKey(hf func() hash.Hash, salt, data []byte, iter int, keySize, ivSize int) (key, iv []byte) {
	h := hf()
	var d, dcat []byte
	sum := make([]byte, 0, h.Size())
	for len(dcat) < keySize+ivSize {
		// D_i = HASH^count(D_(i-1) || data || salt)
		h.Reset()
		h.Write(d)
		h.Write(data)
		h.Write(salt)
		sum = h.Sum(sum[:0])

		for j := 1; j < iter; j++ {
			h.Reset()
			h.Write(sum)
			sum = h.Sum(sum[:0])
		}

		d = append(d[:0], sum...)
		dcat = append(dcat, d...)
	}

	return dcat[:keySize], dcat[keySize : keySize+ivSize]
}
