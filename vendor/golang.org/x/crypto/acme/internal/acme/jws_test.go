// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package acme

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"testing"
)

const testKeyPEM = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4xgZ3eRPkwoRvy7qeRUbmMDe0V+xH9eWLdu0iheeLlrmD2mq
WXfP9IeSKApbn34g8TuAS9g5zhq8ELQ3kmjr+KV86GAMgI6VAcGlq3QrzpTCf/30
Ab7+zawrfRaFONa1HwEzPY1KHnGVkxJc85gNkwYI9SY2RHXtvln3zs5wITNrdosq
EXeaIkVYBEhbhNu54pp3kxo6TuWLi9e6pXeWetEwmlBwtWZlPoib2j3TxLBksKZf
oyFyek380mHgJAumQ/I2fjj98/97mk3ihOY4AgVdCDj1z/GCoZkG5Rq7nbCGyosy
KWyDX00Zs+nNqVhoLeIvXC4nnWdJMZ6rogxyQQIDAQABAoIBACIEZTOI1Kao9nmV
9IeIsuaR1Y61b9neOF/MLmIVIZu+AAJFCMB4Iw11FV6sFodwpEyeZhx2WkpWVN+H
r19eGiLX3zsL0DOdqBJoSIHDWCCMxgnYJ6nvS0nRxX3qVrBp8R2g12Ub+gNPbmFm
ecf/eeERIVxfifd9VsyRu34eDEvcmKFuLYbElFcPh62xE3x12UZvV/sN7gXbawpP
G+w255vbE5MoaKdnnO83cTFlcHvhn24M/78qP7Te5OAeelr1R89kYxQLpuGe4fbS
zc6E3ym5Td6urDetGGrSY1Eu10/8sMusX+KNWkm+RsBRbkyKq72ks/qKpOxOa+c6
9gm+Y8ECgYEA/iNUyg1ubRdH11p82l8KHtFC1DPE0V1gSZsX29TpM5jS4qv46K+s
8Ym1zmrORM8x+cynfPx1VQZQ34EYeCMIX212ryJ+zDATl4NE0I4muMvSiH9vx6Xc
7FmhNnaYzPsBL5Tm9nmtQuP09YEn8poiOJFiDs/4olnD5ogA5O4THGkCgYEA5MIL
qWYBUuqbEWLRtMruUtpASclrBqNNsJEsMGbeqBJmoMxdHeSZckbLOrqm7GlMyNRJ
Ne/5uWRGSzaMYuGmwsPpERzqEvYFnSrpjW5YtXZ+JtxFXNVfm9Z1gLLgvGpOUCIU
RbpoDckDe1vgUuk3y5+DjZihs+rqIJ45XzXTzBkCgYBWuf3segruJZy5rEKhTv+o
JqeUvRn0jNYYKFpLBeyTVBrbie6GkbUGNIWbrK05pC+c3K9nosvzuRUOQQL1tJbd
4gA3oiD9U4bMFNr+BRTHyZ7OQBcIXdz3t1qhuHVKtnngIAN1p25uPlbRFUNpshnt
jgeVoHlsBhApcs5DUc+pyQKBgDzeHPg/+g4z+nrPznjKnktRY1W+0El93kgi+J0Q
YiJacxBKEGTJ1MKBb8X6sDurcRDm22wMpGfd9I5Cv2v4GsUsF7HD/cx5xdih+G73
c4clNj/k0Ff5Nm1izPUno4C+0IOl7br39IPmfpSuR6wH/h6iHQDqIeybjxyKvT1G
N0rRAoGBAKGD+4ZI/E1MoJ5CXB8cDDMHagbE3cq/DtmYzE2v1DFpQYu5I4PCm5c7
EQeIP6dZtv8IMgtGIb91QX9pXvP0aznzQKwYIA8nZgoENCPfiMTPiEDT9e/0lObO
9XWsXpbSTsRPj0sv1rB+UzBJ0PgjK4q2zOF0sNo7b1+6nlM3BWPx
-----END RSA PRIVATE KEY-----
`

// This thumbprint is for the testKey defined above.
const testKeyThumbprint = "6nicxzh6WETQlrvdchkz-U3e3DOQZ4heJKU63rfqMqQ"

var testKey *rsa.PrivateKey

func init() {
	d, _ := pem.Decode([]byte(testKeyPEM))
	if d == nil {
		panic("no block found in testKeyPEM")
	}
	var err error
	testKey, err = x509.ParsePKCS1PrivateKey(d.Bytes)
	if err != nil {
		panic(err.Error())
	}
}

func TestJWSEncodeJSON(t *testing.T) {
	claims := struct{ Msg string }{"Hello JWS"}
	// JWS signed with testKey and "nonce" as the nonce value
	// JSON-serialized JWS fields are split for easier testing
	const (
		// {"alg":"RS256","jwk":{"e":"AQAB","kty":"RSA","n":"..."},"nonce":"nonce"}
		protected = "eyJhbGciOiJSUzI1NiIsImp3ayI6eyJlIjoiQVFBQiIsImt0eSI6" +
			"IlJTQSIsIm4iOiI0eGdaM2VSUGt3b1J2eTdxZVJVYm1NRGUwVi14" +
			"SDllV0xkdTBpaGVlTGxybUQybXFXWGZQOUllU0tBcGJuMzRnOFR1" +
			"QVM5ZzV6aHE4RUxRM2ttanItS1Y4NkdBTWdJNlZBY0dscTNRcnpw" +
			"VENmXzMwQWI3LXphd3JmUmFGT05hMUh3RXpQWTFLSG5HVmt4SmM4" +
			"NWdOa3dZSTlTWTJSSFh0dmxuM3pzNXdJVE5yZG9zcUVYZWFJa1ZZ" +
			"QkVoYmhOdTU0cHAza3hvNlR1V0xpOWU2cFhlV2V0RXdtbEJ3dFda" +
			"bFBvaWIyajNUeExCa3NLWmZveUZ5ZWszODBtSGdKQXVtUV9JMmZq" +
			"ajk4Xzk3bWszaWhPWTRBZ1ZkQ0RqMXpfR0NvWmtHNVJxN25iQ0d5" +
			"b3N5S1d5RFgwMFpzLW5OcVZob0xlSXZYQzRubldkSk1aNnJvZ3h5" +
			"UVEifSwibm9uY2UiOiJub25jZSJ9"
		// {"Msg":"Hello JWS"}
		payload   = "eyJNc2ciOiJIZWxsbyBKV1MifQ"
		signature = "eAGUikStX_UxyiFhxSLMyuyBcIB80GeBkFROCpap2sW3EmkU_ggF" +
			"knaQzxrTfItICSAXsCLIquZ5BbrSWA_4vdEYrwWtdUj7NqFKjHRa" +
			"zpLHcoR7r1rEHvkoP1xj49lS5fc3Wjjq8JUhffkhGbWZ8ZVkgPdC" +
			"4tMBWiQDoth-x8jELP_3LYOB_ScUXi2mETBawLgOT2K8rA0Vbbmx" +
			"hWNlOWuUf-8hL5YX4IOEwsS8JK_TrTq5Zc9My0zHJmaieqDV0UlP" +
			"k0onFjPFkGm7MrPSgd0MqRG-4vSAg2O4hDo7rKv4n8POjjXlNQvM" +
			"9IPLr8qZ7usYBKhEGwX3yq_eicAwBw"
	)

	b, err := jwsEncodeJSON(claims, testKey, "nonce")
	if err != nil {
		t.Fatal(err)
	}
	var jws struct{ Protected, Payload, Signature string }
	if err := json.Unmarshal(b, &jws); err != nil {
		t.Fatal(err)
	}
	if jws.Protected != protected {
		t.Errorf("protected:\n%s\nwant:\n%s", jws.Protected, protected)
	}
	if jws.Payload != payload {
		t.Errorf("payload:\n%s\nwant:\n%s", jws.Payload, payload)
	}
	if jws.Signature != signature {
		t.Errorf("signature:\n%s\nwant:\n%s", jws.Signature, signature)
	}
}

func TestJWKThumbprint(t *testing.T) {
	// Key example from RFC 7638
	const base64N = "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAt" +
		"VT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn6" +
		"4tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FD" +
		"W2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n9" +
		"1CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINH" +
		"aQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw"
	const base64E = "AQAB"
	const expected = "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"

	bytes, err := base64.RawURLEncoding.DecodeString(base64N)
	if err != nil {
		t.Fatalf("Error parsing example key N: %v", err)
	}
	n := new(big.Int).SetBytes(bytes)

	bytes, err = base64.RawURLEncoding.DecodeString(base64E)
	if err != nil {
		t.Fatalf("Error parsing example key E: %v", err)
	}
	e := new(big.Int).SetBytes(bytes)

	pub := &rsa.PublicKey{N: n, E: int(e.Uint64())}
	th := JWKThumbprint(pub)
	if th != expected {
		t.Errorf("th = %q; want %q", th, expected)
	}
}
