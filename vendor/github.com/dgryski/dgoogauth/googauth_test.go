package dgoogauth

import (
	"strconv"
	"testing"
	"time"
)

// Test vectors via:
// http://code.google.com/p/google-authenticator/source/browse/libpam/pam_google_authenticator_unittest.c
// https://google-authenticator.googlecode.com/hg/libpam/totp.html

var codeTests = []struct {
	secret string
	value  int64
	code   int
}{
	{"2SH3V3GDW7ZNMGYE", 1, 293240},
	{"2SH3V3GDW7ZNMGYE", 5, 932068},
	{"2SH3V3GDW7ZNMGYE", 10000, 50548},
}

func TestCode(t *testing.T) {

	for _, v := range codeTests {
		c := ComputeCode(v.secret, v.value)

		if c != v.code {
			t.Errorf("computeCode(%s, %d): got %d expected %d\n", v.secret, v.value, c, v.code)
		}

	}
}

func TestScratchCode(t *testing.T) {

	var cotp OTPConfig

	cotp.ScratchCodes = []int{11112222, 22223333}

	var scratchTests = []struct {
		code   int
		result bool
	}{
		{33334444, false},
		{11112222, true},
		{11112222, false},
		{22223333, true},
		{22223333, false},
		{33334444, false},
	}

	for _, s := range scratchTests {
		r := cotp.checkScratchCodes(s.code)
		if r != s.result {
			t.Errorf("scratchcode(%d) failed: got %t expected %t", s.code, r, s.result)
		}
	}
}

func TestHotpCode(t *testing.T) {

	var cotp OTPConfig

	// reuse our test values from above
	// perhaps create more?
	cotp.Secret = "2SH3V3GDW7ZNMGYE"
	cotp.HotpCounter = 1
	cotp.WindowSize = 3

	var counterCodes = []struct {
		code    int
		result  bool
		counter int
	}{
		{ /* 1 */ 293240, true, 2},   // increments on success
		{ /* 1 */ 293240, false, 3},  // and failure
		{ /* 5 */ 932068, true, 6},   // inside of window
		{ /* 10 */ 481725, false, 7}, // outside of window
		{ /* 10 */ 481725, false, 8}, // outside of window
		{ /* 10 */ 481725, true, 11}, // now inside of window
	}

	for i, s := range counterCodes {
		r := cotp.checkHotpCode(s.code)
		if r != s.result {
			t.Errorf("counterCode(%d) (step %d) failed: got %t expected %t", s.code, i, r, s.result)
		}
		if cotp.HotpCounter != s.counter {
			t.Errorf("hotpCounter incremented poorly: got %d expected %d", cotp.HotpCounter, s.counter)
		}
	}
}

func TestTotpCode(t *testing.T) {

	var cotp OTPConfig

	// reuse our test values from above
	cotp.Secret = "2SH3V3GDW7ZNMGYE"
	cotp.WindowSize = 5

	var windowTest = []struct {
		code   int
		t0     int
		result bool
	}{
		{50548, 9997, false},
		{50548, 9998, true},
		{50548, 9999, true},
		{50548, 10000, true},
		{50548, 10001, true},
		{50548, 10002, true},
		{50548, 10003, false},
	}

	for i, s := range windowTest {
		r := cotp.checkTotpCode(s.t0, s.code)
		if r != s.result {
			t.Errorf("counterCode(%d) (step %d) failed: got %t expected %t", s.code, i, r, s.result)
		}
	}

	cotp.DisallowReuse = make([]int, 0)
	var noreuseTest = []struct {
		code       int
		t0         int
		result     bool
		disallowed []int
	}{
		{50548 /* 10000 */, 9997, false, []int{}},
		{50548 /* 10000 */, 9998, true, []int{10000}},
		{50548 /* 10000 */, 9999, false, []int{10000}},
		{478726 /* 10001 */, 10001, true, []int{10000, 10001}},
		{646986 /* 10002 */, 10002, true, []int{10000, 10001, 10002}},
		{842639 /* 10003 */, 10003, true, []int{10001, 10002, 10003}},
	}

	for i, s := range noreuseTest {
		r := cotp.checkTotpCode(s.t0, s.code)
		if r != s.result {
			t.Errorf("timeCode(%d) (step %d) failed: got %t expected %t", s.code, i, r, s.result)
		}
		if len(cotp.DisallowReuse) != len(s.disallowed) {
			t.Errorf("timeCode(%d) (step %d) failed: disallowReuse len mismatch: got %d expected %d", s.code, i, len(cotp.DisallowReuse), len(s.disallowed))
		} else {
			same := true
			for j := range s.disallowed {
				if s.disallowed[j] != cotp.DisallowReuse[j] {
					same = false
				}
			}
			if !same {
				t.Errorf("timeCode(%d) (step %d) failed: disallowReused: got %v expected %v", s.code, i, cotp.DisallowReuse, s.disallowed)
			}
		}
	}
}

func TestAuthenticate(t *testing.T) {

	otpconf := &OTPConfig{
		Secret:       "2SH3V3GDW7ZNMGYE",
		WindowSize:   3,
		HotpCounter:  1,
		ScratchCodes: []int{11112222, 22223333},
	}

	type attempt struct {
		code   string
		result bool
	}

	var attempts = []attempt{
		{"foobar", false},          // not digits
		{"1fooba", false},          // not valid number
		{"1111111", false},         // bad length
		{ /* 1 */ "293240", true},  // hopt increments on success
		{ /* 1 */ "293240", false}, // hopt failure
		{"33334444", false},        // scratch
		{"11112222", true},
		{"11112222", false},
	}

	for _, a := range attempts {
		r, _ := otpconf.Authenticate(a.code)
		if r != a.result {
			t.Errorf("bad result from code=%s: got %t expected %t\n", a.code, r, a.result)
		}
	}

	// let's check some time-based codes
	otpconf.HotpCounter = 0
	// I haven't mocked the clock, so we'll just compute one
	var t0 int64
	if otpconf.UTC {
		t0 = int64(time.Now().UTC().Unix() / 30)
	} else {
		t0 = int64(time.Now().Unix() / 30)
	}
	c := ComputeCode(otpconf.Secret, t0)

	invalid := c + 1
	attempts = []attempt{
		{strconv.Itoa(invalid), false},
		{strconv.Itoa(c), true},
	}

	for _, a := range attempts {
		r, _ := otpconf.Authenticate(a.code)
		if r != a.result {
			t.Errorf("bad result from code=%s: got %t expected %t\n", a.code, r, a.result)
		}

		otpconf.UTC = true
		r, _ = otpconf.Authenticate(a.code)
		if r != a.result {
			t.Errorf("bad result from code=%s: got %t expected %t\n", a.code, r, a.result)
		}
		otpconf.UTC = false
	}

}

func TestProvisionURI(t *testing.T) {
	otpconf := OTPConfig{
		Secret: "x",
	}

	cases := []struct {
		user, iss string
		hotp      bool
		out       string
	}{
		{"test", "", false, "otpauth://totp/test?secret=x"},
		{"test", "", true, "otpauth://hotp/test?counter=1&secret=x"},
		{"test", "Company", true, "otpauth://hotp/Company:test?counter=1&issuer=Company&secret=x"},
		{"test", "Company", false, "otpauth://totp/Company:test?issuer=Company&secret=x"},
	}

	for i, c := range cases {
		otpconf.HotpCounter = 0
		if c.hotp {
			otpconf.HotpCounter = 1
		}
		got := otpconf.ProvisionURIWithIssuer(c.user, c.iss)
		if got != c.out {
			t.Errorf("%d: want %q, got %q", i, c.out, got)
		}
	}
}
