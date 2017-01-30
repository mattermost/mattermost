package ber

import (
	"bytes"
	"io"
	"io/ioutil"
	"testing"
)

var errEOF = io.ErrUnexpectedEOF.Error()

// Tests from http://www.strozhevsky.com/free_docs/free_asn1_testsuite_descr.pdf
// Source files and descriptions at http://www.strozhevsky.com/free_docs/TEST_SUITE.zip
var testcases = []struct {
	// File contains the path to the BER-encoded file
	File string
	// Error indicates whether a decoding error is expected
	Error string
	// AbnormalEncoding indicates whether a normalized re-encoding is expected to differ from the original source
	AbnormalEncoding bool
	// IndefiniteEncoding indicates the source file used indefinite-length encoding, so the re-encoding is expected to differ (since the length is known)
	IndefiniteEncoding bool
}{
	// Common blocks
	{File: "tests/tc1.ber", Error: "high-tag-number tag overflow"},
	{File: "tests/tc2.ber", Error: errEOF},
	{File: "tests/tc3.ber", Error: errEOF},
	{File: "tests/tc4.ber", Error: "invalid length byte 0xff"},
	{File: "tests/tc5.ber", Error: "", AbnormalEncoding: true},
	// Real numbers (some expected failures are disabled until support is added)
	{File: "tests/tc6.ber", Error: ""}, // Error: "REAL value +0 must be encoded with zero-length value block"},
	{File: "tests/tc7.ber", Error: ""}, // Error: "REAL value -0 must be encoded as a special value"},
	{File: "tests/tc8.ber", Error: ""},
	{File: "tests/tc9.ber", Error: ""}, // Error: "Bits 6 and 5 of information octet for REAL are equal to 11"
	{File: "tests/tc10.ber", Error: ""},
	{File: "tests/tc11.ber", Error: ""}, // Error: "Incorrect NR form"
	{File: "tests/tc12.ber", Error: ""}, // Error: "Encoding of "special value" not from ASN.1 standard"
	{File: "tests/tc13.ber", Error: errEOF},
	{File: "tests/tc14.ber", Error: errEOF},
	{File: "tests/tc15.ber", Error: ""}, // Error: "Too big value of exponent"
	{File: "tests/tc16.ber", Error: ""}, // Error: "Too big value of mantissa"
	{File: "tests/tc17.ber", Error: ""}, // Error: "Too big values for exponent and mantissa + using of "scaling factor" value"
	// Integers
	{File: "tests/tc18.ber", Error: ""},
	{File: "tests/tc19.ber", Error: errEOF},
	{File: "tests/tc20.ber", Error: ""},
	// Object identifiers
	{File: "tests/tc21.ber", Error: ""},
	{File: "tests/tc22.ber", Error: ""},
	{File: "tests/tc23.ber", Error: errEOF},
	{File: "tests/tc24.ber", Error: ""},
	// Booleans
	{File: "tests/tc25.ber", Error: ""},
	{File: "tests/tc26.ber", Error: ""},
	{File: "tests/tc27.ber", Error: errEOF},
	{File: "tests/tc28.ber", Error: ""},
	{File: "tests/tc29.ber", Error: ""},
	// Null
	{File: "tests/tc30.ber", Error: ""},
	{File: "tests/tc31.ber", Error: errEOF},
	{File: "tests/tc32.ber", Error: ""},
	// Bitstring (some expected failures are disabled until support is added)
	{File: "tests/tc33.ber", Error: ""}, // Error: "Too big value for "unused bits""
	{File: "tests/tc34.ber", Error: errEOF},
	{File: "tests/tc35.ber", Error: "", IndefiniteEncoding: true}, // Error: "Using of different from BIT STRING types as internal types for constructive encoding"
	{File: "tests/tc36.ber", Error: "", IndefiniteEncoding: true}, // Error: "Using of "unused bits" in internal BIT STRINGs with constructive form of encoding"
	{File: "tests/tc37.ber", Error: ""},
	{File: "tests/tc38.ber", Error: "", IndefiniteEncoding: true},
	{File: "tests/tc39.ber", Error: ""},
	{File: "tests/tc40.ber", Error: ""},
	// Octet string (some expected failures are disabled until support is added)
	{File: "tests/tc41.ber", Error: "", IndefiniteEncoding: true}, // Error: "Using of different from OCTET STRING types as internal types for constructive encoding"
	{File: "tests/tc42.ber", Error: errEOF},
	{File: "tests/tc43.ber", Error: errEOF},
	{File: "tests/tc44.ber", Error: ""},
	{File: "tests/tc45.ber", Error: ""},
	// Bitstring
	{File: "tests/tc46.ber", Error: "indefinite length used with primitive type"},
	{File: "tests/tc47.ber", Error: "eoc child not allowed with definite length"},
	{File: "tests/tc48.ber", Error: "", IndefiniteEncoding: true}, // Error: "Using of more than 7 "unused bits" in BIT STRING with constrictive encoding form"
}

func TestSuiteDecodePacket(t *testing.T) {
	// Debug = true
	for _, tc := range testcases {
		file := tc.File

		dataIn, err := ioutil.ReadFile(file)
		if err != nil {
			t.Errorf("%s: %v", file, err)
			continue
		}

		// fmt.Printf("%s: decode %d\n", file, len(dataIn))
		packet, err := DecodePacketErr(dataIn)
		if err != nil {
			if tc.Error == "" {
				t.Errorf("%s: unexpected error during DecodePacket: %v", file, err)
			} else if tc.Error != err.Error() {
				t.Errorf("%s: expected error %q during DecodePacket, got %q", file, tc.Error, err)
			}
			continue
		}
		if tc.Error != "" {
			t.Errorf("%s: expected error %q, got none", file, tc.Error)
			continue
		}

		dataOut := packet.Bytes()
		if tc.AbnormalEncoding || tc.IndefiniteEncoding {
			// Abnormal encodings and encodings that used indefinite length should re-encode differently
			if bytes.Equal(dataOut, dataIn) {
				t.Errorf("%s: data should have been re-encoded differently", file)
			}
		} else if !bytes.Equal(dataOut, dataIn) {
			// Make sure the serialized data matches the source
			t.Errorf("%s: data should be the same", file)
		}

		packet, err = DecodePacketErr(dataOut)
		if err != nil {
			t.Errorf("%s: unexpected error: %v", file, err)
			continue
		}

		// Make sure the re-serialized data matches our original serialization
		dataOut2 := packet.Bytes()
		if !bytes.Equal(dataOut, dataOut2) {
			t.Errorf("%s: data should be the same", file)
		}
	}
}

func TestSuiteReadPacket(t *testing.T) {
	for _, tc := range testcases {
		file := tc.File

		dataIn, err := ioutil.ReadFile(file)
		if err != nil {
			t.Errorf("%s: %v", file, err)
			continue
		}

		buffer := bytes.NewBuffer(dataIn)
		packet, err := ReadPacket(buffer)
		if err != nil {
			if tc.Error == "" {
				t.Errorf("%s: unexpected error during ReadPacket: %v", file, err)
			} else if tc.Error != err.Error() {
				t.Errorf("%s: expected error %q during ReadPacket, got %q", file, tc.Error, err)
			}
			continue
		}
		if tc.Error != "" {
			t.Errorf("%s: expected error %q, got none", file, tc.Error)
			continue
		}

		dataOut := packet.Bytes()
		if tc.AbnormalEncoding || tc.IndefiniteEncoding {
			// Abnormal encodings and encodings that used indefinite length should re-encode differently
			if bytes.Equal(dataOut, dataIn) {
				t.Errorf("%s: data should have been re-encoded differently", file)
			}
		} else if !bytes.Equal(dataOut, dataIn) {
			// Make sure the serialized data matches the source
			t.Errorf("%s: data should be the same", file)
		}

		packet, err = DecodePacketErr(dataOut)
		if err != nil {
			t.Errorf("%s: unexpected error: %v", file, err)
			continue
		}

		// Make sure the re-serialized data matches our original serialization
		dataOut2 := packet.Bytes()
		if !bytes.Equal(dataOut, dataOut2) {
			t.Errorf("%s: data should be the same", file)
		}
	}
}
