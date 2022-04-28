// Copyright 2016 Russell Haering et al.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"bytes"
	"crypto/cipher"
	"crypto/tls"
	"encoding/base64"
	"encoding/xml"
	"fmt"
)

type EncryptedAssertion struct {
	XMLName          xml.Name         `xml:"urn:oasis:names:tc:SAML:2.0:assertion EncryptedAssertion"`
	EncryptionMethod EncryptionMethod `xml:"EncryptedData>EncryptionMethod"`
	EncryptedKey     EncryptedKey     `xml:"EncryptedData>KeyInfo>EncryptedKey"`
	DetEncryptedKey  EncryptedKey     `xml:"EncryptedKey"` // detached EncryptedKey element
	CipherValue      string           `xml:"EncryptedData>CipherData>CipherValue"`
}

func (ea *EncryptedAssertion) DecryptBytes(cert *tls.Certificate) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(ea.CipherValue)
	if err != nil {
		return nil, err
	}

	// EncryptedKey must include CipherValue.  EncryptedKey may be part of EncryptedData.
	ek := &ea.EncryptedKey
	if ek.CipherValue == "" {
		// Use detached EncryptedKey element (sibling of EncryptedData).  See:
		// https://www.w3.org/TR/2002/REC-xmlenc-core-20021210/Overview.html#sec-Extensions-to-KeyInfo
		ek = &ea.DetEncryptedKey
	}
	k, err := ek.DecryptSymmetricKey(cert)
	if err != nil {
		return nil, fmt.Errorf("cannot decrypt, error retrieving private key: %s", err)
	}

	switch ea.EncryptionMethod.Algorithm {
	case MethodAES128GCM:
		c, err := cipher.NewGCM(k)
		if err != nil {
			return nil, fmt.Errorf("cannot create AES-GCM: %s", err)
		}

		nonce, data := data[:c.NonceSize()], data[c.NonceSize():]
		plainText, err := c.Open(nil, nonce, data, nil)
		if err != nil {
			return nil, fmt.Errorf("cannot open AES-GCM: %s", err)
		}
		return plainText, nil
	case MethodAES128CBC, MethodAES256CBC, MethodTripleDESCBC:
		nonce, data := data[:k.BlockSize()], data[k.BlockSize():]
		c := cipher.NewCBCDecrypter(k, nonce)
		c.CryptBlocks(data, data)

		// Remove zero bytes
		data = bytes.TrimRight(data, "\x00")

		// Calculate index to remove based on padding
		padLength := data[len(data)-1]
		lastGoodIndex := len(data) - int(padLength)
		return data[:lastGoodIndex], nil
	default:
		return nil, fmt.Errorf("unknown symmetric encryption method %#v", ea.EncryptionMethod.Algorithm)
	}
}

// Decrypt decrypts and unmarshals the EncryptedAssertion.
func (ea *EncryptedAssertion) Decrypt(cert *tls.Certificate) (*Assertion, error) {
	plaintext, err := ea.DecryptBytes(cert)
	if err != nil {
		return nil, fmt.Errorf("Error decrypting assertion: %v", err)
	}

	assertion := &Assertion{}

	err = xml.Unmarshal(plaintext, assertion)
	if err != nil {
		return nil, fmt.Errorf("Error unmarshaling assertion: %v", err)
	}

	return assertion, nil
}
