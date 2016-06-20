package jwt

import (
	"fmt"
	"testing"
)

const testSecret = "yd0BjPPRUL7rrDcZ2hKTdiCCkgBp55t6"

type testStruct struct {
	alg      string
	headers  map[string]interface{}
	payload  map[string]interface{}
	secret   string
	expected interface{}
}

var tests = map[string]*testStruct{

	// Test a legal JWT using HS256
	"pass_HS256": {
		HS256,
		map[string]interface{}{
			"cty": "twilio-fpa;v=1",
		},
		map[string]interface{}{
			"jti": fmt.Sprintf("%s-%s", "someissuer", "1450900077"),
			"iss": "someissuer",
			"sub": "somethingsid",
			"exp": "1450900077",
		},
		testSecret,
		nil,
	},
	"pass_HS384": {
		HS384,
		map[string]interface{}{"cty": "twilio-fpa;v=1"},
		map[string]interface{}{
			"jti": fmt.Sprintf("%s-%s", "someissuer", "1450900077"),
			"iss": "someissuer",
			"sub": "somethingsid",
			"exp": "1450900077",
		},
		testSecret,
		nil,
	},
	"pass_HS512": {
		HS512,
		map[string]interface{}{
			"cty": "twilio-fpa;v=1",
		},
		map[string]interface{}{
			"jti": fmt.Sprintf("%s-%s", "someissuer", "1450900077"),
			"iss": "someissuer",
			"sub": "somethingsid",
			"exp": "1450900077",
		},
		testSecret,
		nil,
	},

	"fail_unknownAlg": {
		"MD5",
		map[string]interface{}{
			"cty": "twilio-fpa;v=1",
		},
		map[string]interface{}{
			"jti": fmt.Sprintf("%s-%s", "someissuer", "1450900077"),
			"iss": "someissuer",
			"sub": "somethingsid",
			"exp": "1450900077",
		},
		testSecret,
		ErrUnsupportedAlgorithm,
	},
}

func (p *testStruct) run(owner string, t *testing.T) error {
	sig, err := Encode(p.payload, p.headers, p.secret, p.alg)

	if err != nil {
		return err
	}

	t.Logf("%s Signed: %v", owner, sig)

	decoded, err := Decode(sig, p.secret, true)

	if err != nil {
		return err
	}

	t.Logf("%s Decoded: %v", owner, decoded)

	return nil
}

// Test a variety of full encode/decode cycles
func TestEncode(t *testing.T) {

	p := 0
	f := 0

	for k, v := range tests {
		if err := v.run(k, t); err != v.expected {
			t.Errorf("%s: %v", k, err)
			f++
		} else {
			p++
		}
	}

	t.Logf("%d of %d tests successfully passed", p, len(tests))

	if f != 0 {
		t.Fail()
	}
}

// Test specific decode cases
func TestDecode(t *testing.T) {

	// Invalid segment encoding
	invalid := "fdsdfg9807435!@#%$.@#$@SDSAVSDFVSD234223432.@#$%gsdfg$#%3455435"
	_, err := Decode(invalid, testSecret, true)
	if err == nil {
		t.Errorf("Expected %v but got no error", ErrInvalidSegmentEncoding)
		t.Fail()
	}

	// Too few segments
	invalid = "fdsdfg9807435!@#%$.@#$@SDSAVSDFVSD234223432"
	_, err = Decode(invalid, testSecret, true)
	if err == nil {
		t.Errorf("Expected %v but got no error", ErrNotEnoughSegments)
		t.Fail()
	}

	// Too many segments
	invalid = "fdsdfg9807435!@#%$.@#$@SDSAVSDFVSD234223432.@#$%gsdfg$#%3455435.2342354DFSfdg=="
	_, err = Decode(invalid, testSecret, true)
	if err == nil {
		t.Errorf("Expected %v but got no error", ErrTooManySegments)
		t.Fail()
	}

	// Invalid signature
	invalid = "eyJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIiwidHlwIjoiSldUIn0.eyJleHAiOiIxNDUwOTAwMDc3IiwiaXNzIjoic29tZWlzc3VlciIsImp0aSI6InNvbWVpc3N1ZXItMTQ1MDkwMDA3NyIsInN1YiI6InNvbWV0aGluZ3NpZCJ9.eNH24oFxqA5obnVjtk4FanYjHub6a8d0APZTz11YS5"
	_, err = Decode(invalid, testSecret, true)
	if err == nil {
		t.Errorf("Expected %v but got no error", ErrSignatureVerificationFailure)
		t.Fail()
	}
}
