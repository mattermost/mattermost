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
	Algorithm    string       `xml:",attr,omitempty"`
	DigestMethod DigestMethod `xml:",omitempty"`
}

//DigestMethod is a digest type specification
type DigestMethod struct {
	Algorithm string `xml:",attr,omitempty"`
}

//Well-known public-key encryption methods
const (
	MethodRSAOAEP  = "http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p"
	MethodRSAOAEP2 = "http://www.w3.org/2009/xmlenc11#rsa-oaep"
)

//Well-known private key encryption methods
const (
	MethodAES128GCM = "http://www.w3.org/2009/xmlenc11#aes128-gcm"
	MethodAES128CBC = "http://www.w3.org/2001/04/xmlenc#aes128-cbc"
	MethodAES256CBC = "http://www.w3.org/2001/04/xmlenc#aes256-cbc"
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
		default:
			return nil, fmt.Errorf("unsupported encryption algorithm: %s", ek.EncryptionMethod.Algorithm)
		}
	}
	return nil, fmt.Errorf("no cipher for decoding symmetric key")
}
