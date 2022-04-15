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
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"hash"
	"strings"
)

//EncryptedKey contains the decryption key data from the saml2 core and xmlenc
//standards.
type EncryptedKey struct {
	// EncryptionMethod string `xml:"EncryptionMethod>Algorithm"`
	X509Data         string `xml:"KeyInfo>X509Data>X509Certificate"`
	CipherValue      string `xml:"CipherData>CipherValue"`
	EncryptionMethod EncryptionMethod
}

//EncryptionMethod specifies the type of encryption that was used.
type EncryptionMethod struct {
	Algorithm string `xml:",attr,omitempty"`
	//Digest method is present for algorithms like RSA-OAEP.
	//See https://www.w3.org/TR/xmlenc-core1/.
	//To convey the digest methods an entity supports,
	//DigestMethod in extensions element is used.
	//See http://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-metadata-algsupport.html.
	DigestMethod *DigestMethod `xml:",omitempty"`
}

//DigestMethod is a digest type specification
type DigestMethod struct {
	Algorithm string `xml:",attr,omitempty"`
}

//Well-known public-key encryption methods
const (
	MethodRSAOAEP  = "http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p"
	MethodRSAOAEP2 = "http://www.w3.org/2009/xmlenc11#rsa-oaep"
	MethodRSAv1_5  = "http://www.w3.org/2001/04/xmlenc#rsa-1_5"
)

//Well-known private key encryption methods
const (
	MethodAES128GCM    = "http://www.w3.org/2009/xmlenc11#aes128-gcm"
	MethodAES128CBC    = "http://www.w3.org/2001/04/xmlenc#aes128-cbc"
	MethodAES256CBC    = "http://www.w3.org/2001/04/xmlenc#aes256-cbc"
	MethodTripleDESCBC = "http://www.w3.org/2001/04/xmlenc#tripledes-cbc"
)

//Well-known hash methods
const (
	MethodSHA1   = "http://www.w3.org/2000/09/xmldsig#sha1"
	MethodSHA256 = "http://www.w3.org/2000/09/xmldsig#sha256"
	MethodSHA512 = "http://www.w3.org/2000/09/xmldsig#sha512"
)

//SHA-1 is commonly used for certificate fingerprints (openssl -fingerprint and ADFS thumbprint).
//SHA-1 is sufficient for our purposes here (error message).
func debugKeyFp(keyBytes []byte) string {
	if len(keyBytes) < 1 {
		return ""
	}
	hashFunc := sha1.New()
	hashFunc.Write(keyBytes)
	sum := strings.ToLower(hex.EncodeToString(hashFunc.Sum(nil)))
	var ret string
	for idx := 0; idx+1 < len(sum); idx += 2 {
		if idx == 0 {
			ret += sum[idx : idx+2]
		} else {
			ret += ":" + sum[idx:idx+2]
		}
	}
	return ret
}

//DecryptSymmetricKey returns the private key contained in the EncryptedKey document
func (ek *EncryptedKey) DecryptSymmetricKey(cert *tls.Certificate) (cipher.Block, error) {
	if len(cert.Certificate) < 1 {
		return nil, fmt.Errorf("decryption tls.Certificate has no public certs attached")
	}

	// The EncryptedKey may or may not include X509Data (certificate).
	// If included, the EncryptedKey certificate:
	// - is FYI only (fail if it does not match the SP certificate)
	// - is NOT used to decrypt CipherData
	if ek.X509Data != "" {
		if encCert, err := base64.StdEncoding.DecodeString(ek.X509Data); err != nil {
			return nil, fmt.Errorf("error decoding EncryptedKey certificate: %v", err)
		} else if !bytes.Equal(cert.Certificate[0], encCert) {
			return nil, fmt.Errorf("key decryption attempted with mismatched cert, SP cert(%.11s), assertion cert(%.11s)",
				debugKeyFp(cert.Certificate[0]), debugKeyFp(encCert))
		}
	}

	cipherText, err := base64.StdEncoding.DecodeString(ek.CipherValue)
	if err != nil {
		return nil, err
	}

	switch pk := cert.PrivateKey.(type) {
	case *rsa.PrivateKey:
		var h hash.Hash

		if ek.EncryptionMethod.DigestMethod == nil {
			//if digest method is not present lets set default method to SHA1.
			//Digest method is used by methods like RSA-OAEP.
			h = sha1.New()
		} else {
			switch ek.EncryptionMethod.DigestMethod.Algorithm {
			case "", MethodSHA1:
				h = sha1.New() // default
			case MethodSHA256:
				h = sha256.New()
			case MethodSHA512:
				h = sha512.New()
			default:
				return nil, fmt.Errorf("unsupported digest algorithm: %v",
					ek.EncryptionMethod.DigestMethod.Algorithm)
			}
		}

		switch ek.EncryptionMethod.Algorithm {
		case "":
			return nil, fmt.Errorf("missing encryption algorithm")
		case MethodRSAOAEP, MethodRSAOAEP2:
			pt, err := rsa.DecryptOAEP(h, rand.Reader, pk, cipherText, nil)
			if err != nil {
				return nil, fmt.Errorf("rsa internal error: %v", err)
			}

			b, err := aes.NewCipher(pt)
			if err != nil {
				return nil, err
			}

			return b, nil
		case MethodRSAv1_5:
			pt, err := rsa.DecryptPKCS1v15(rand.Reader, pk, cipherText)
			if err != nil {
				return nil, fmt.Errorf("rsa internal error: %v", err)
			}

			//From https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf the xml encryption
			//methods to be supported are from http://www.w3.org/2001/04/xmlenc#Element.
			//https://www.w3.org/TR/2002/REC-xmlenc-core-20021210/Overview.html#Element.
			//https://www.w3.org/TR/2002/REC-xmlenc-core-20021210/#sec-Algorithms
			//Sec 5.4 Key Transport:
			//The RSA v1.5 Key Transport algorithm given below are those used in conjunction with TRIPLEDES
			//Please also see https://www.w3.org/TR/xmlenc-core/#sec-Algorithms and
			//https://www.w3.org/TR/xmlenc-core/#rsav15note.
			b, err := aes.NewCipher(pt)
			if err != nil {
				return nil, err
			}

			return b, nil
		default:
			return nil, fmt.Errorf("unsupported encryption algorithm: %s", ek.EncryptionMethod.Algorithm)
		}
	}
	return nil, fmt.Errorf("no cipher for decoding symmetric key")
}
