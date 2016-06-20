package jwt

// JSON Web Token implementation
// follows the minimum design implemented in Twilio's Node Server with https://www.npmjs.com/package/jsonwebtoken package

import (
	"crypto"
	"crypto/hmac"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"

	_ "crypto/sha256" // Required for linking SHA256 to binary
	_ "crypto/sha512" // Required for linking SHA384 and SHA512 to binary
)

// Suported Algorithms
const (
	HS256 = "HS256" // HMAC SHA256 implementation
	HS384 = "HS384" // HMAC SHA384 implementation
	HS512 = "HS512" // HMAC SHA512 implementation
)

var (
	ErrUnsupportedAlgorithm         = errors.New("Algorithm not supported")
	ErrHashNotAvailable             = errors.New("The specified hash is not available")
	ErrSignatureVerificationFailure = errors.New("Signature verification failed")
	ErrInvalidSegmentEncoding       = errors.New("Invalid segment encoding")
	ErrNotEnoughSegments            = errors.New("Not enough segments")
	ErrTooManySegments              = errors.New("Too many segments")
)

var signingMethods = map[string]crypto.Hash{}

func init() {

	signingMethods["HS256"] = crypto.SHA256
	signingMethods["HS384"] = crypto.SHA384
	signingMethods["HS512"] = crypto.SHA512
}

// Encode generates a valid JWT with the given payload.
func Encode(payload map[string]interface{}, customHeaders map[string]interface{}, key string, algorithm string) (string, error) {

	alg, ok := signingMethods[algorithm]
	if !ok {
		return "", ErrUnsupportedAlgorithm
	}

	header := map[string]interface{}{
		"typ": "JWT",
		"alg": algorithm,
	}

	// Update map with any user-defined headers
	if customHeaders != nil {
		for k, v := range customHeaders {
			header[k] = v
		}
	}

	segments := []string{encodeSegment(header), encodeSegment(payload)}
	signMe := strings.Join(segments, ".")

	signature := sign(alg, signMe, []byte(key))

	segments = append(segments, encodeBase64Url(signature))
	token := strings.Join(segments, ".")

	return token, nil

}

// Decode returns the payload portion of the JWT and optionally
// verifies the signature
func Decode(jwt string, key string, verify bool) (interface{}, error) {
	splits := strings.Split(jwt, ".")

	if len(splits) != 3 {
		if len(splits) < 3 {
			return nil, ErrNotEnoughSegments
		}
		return nil, ErrTooManySegments
	}

	payloadRaw, err := decodeBase64Url(splits[1])
	if err != nil {
		return nil, ErrInvalidSegmentEncoding
	}

	payload := jsonToMap(string(payloadRaw))

	if verify {
		if err := verifySignature(splits, []byte(key)); err != nil {
			return nil, err
		}
	}

	return payload, nil
}

// verifySignature returns nil or a specific error if the JWT signature is invalid
func verifySignature(segments []string, key []byte) error {

	b, err := decodeBase64Url(segments[0])
	if err != nil {
		return err
	}

	header := jsonToMap(string(b))
	algValue := header["alg"].(string)
	alg, ok := signingMethods[algValue]

	if !ok {
		return ErrUnsupportedAlgorithm
	}

	if !alg.Available() {
		return ErrHashNotAvailable
	}

	signaure, err := decodeBase64Url(segments[2])
	if err != nil {
		return err
	}

	hasher := hmac.New(alg.New, key)
	hasher.Write([]byte(segments[0] + "." + segments[1]))
	if !hmac.Equal(signaure, hasher.Sum(nil)) {
		return ErrSignatureVerificationFailure
	}
	return nil
}

func jsonToMap(data string) map[string]interface{} {
	var arbitrary map[string]interface{}
	json.Unmarshal([]byte(data), &arbitrary)
	return arbitrary
}

func sign(hash crypto.Hash, msg string, key []byte) []byte {
	hasher := hmac.New(hash.New, key)
	hasher.Write([]byte(msg))

	return hasher.Sum(nil)
}

func encodeSegment(data map[string]interface{}) string {
	b, _ := json.Marshal(data)
	return encodeBase64Url(b)
}

func encodeBase64Url(data []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(data), "=")
}

func decodeBase64Url(data string) ([]byte, error) {
	if l := len(data) % 4; l > 0 {
		data += strings.Repeat("=", 4-l)
	}

	return base64.URLEncoding.DecodeString(data)
}
