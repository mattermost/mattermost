// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package phcparser

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParse(t *testing.T) {
	testCases := []struct {
		input     string
		output    PHC
		expectErr bool
	}{
		/////////////////////////////////////////////////////////////////
		// Valid strings
		{
			"$argon2i$m=120,t=4294967295,p=2",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m": "120",
					"t": "4294967295",
					"p": "2",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=2040,t=5000,p=255",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m": "2040",
					"t": "5000",
					"p": "255",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0ZQ",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0ZQ",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0ZQA",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0ZQA",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,data=sRlHhRmKUGzdOmXn01XmXygd5Kc",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":    "120",
					"t":    "5000",
					"p":    "2",
					"data": "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0,data=sRlHhRmKUGzdOmXn01XmXygd5Kc",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
					"data":  "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "",
				Hash: "",
			},
			false,
		},

		{
			"$argon2i$m=120,t=5000,p=2$4fXXG0spB92WPB1NitT8/OH0VKI",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m": "120",
					"t": "5000",
					"p": "2",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2$BwUgJHHQaynE+a4nZrYRzOllGSjjxuxNXxyNRUtI6Dlw/zlbt6PzOL8Onfqs6TcG",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m": "120",
					"t": "5000",
					"p": "2",
				},
				Salt: "BwUgJHHQaynE+a4nZrYRzOllGSjjxuxNXxyNRUtI6Dlw/zlbt6PzOL8Onfqs6TcG",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0$4fXXG0spB92WPB1NitT8/OH0VKI",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,data=sRlHhRmKUGzdOmXn01XmXygd5Kc$4fXXG0spB92WPB1NitT8/OH0VKI",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":    "120",
					"t":    "5000",
					"p":    "2",
					"data": "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0,data=sRlHhRmKUGzdOmXn01XmXygd5Kc$4fXXG0spB92WPB1NitT8/OH0VKI",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
					"data":  "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "",
			},
			false,
		},

		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0$4fXXG0spB92WPB1NitT8/OH0VKI$iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,data=sRlHhRmKUGzdOmXn01XmXygd5Kc$4fXXG0spB92WPB1NitT8/OH0VKI$iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":    "120",
					"t":    "5000",
					"p":    "2",
					"data": "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0,data=sRlHhRmKUGzdOmXn01XmXygd5Kc$4fXXG0spB92WPB1NitT8/OH0VKI$iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
					"data":  "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0,data=sRlHhRmKUGzdOmXn01XmXygd5Kc$iHSDPHzUhPzK7rCcJgOFfg$EkCWX6pSTqWruiR0",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
					"data":  "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "iHSDPHzUhPzK7rCcJgOFfg",
				Hash: "EkCWX6pSTqWruiR0",
			},
			false,
		},
		{
			"$argon2i",
			PHC{
				Id:     "argon2i",
				Params: map[string]string{},
			},
			false,
		},
		{
			"$argon2i$m=120",
			PHC{
				Id: "argon2i",
				Params: map[string]string{
					"m": "120",
				},
			},
			false,
		},
		{
			"$argon2i$v=120",
			PHC{
				Id:      "argon2i",
				Version: "120",
				Params:  map[string]string{},
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2",
			PHC{
				Id: "argon2i",
				Params: map[string]string{
					"m": "120",
					"t": "5000",
					"p": "2",
				},
			},
			false,
		},
		{
			"$argon2i$v=5$m=120,t=5000,p=2",
			PHC{
				Id:      "argon2i",
				Version: "5",
				Params: map[string]string{
					"m": "120",
					"t": "5000",
					"p": "2",
				},
			},
			false,
		},
		{
			"$argon2i$/LtFjH5rVL8",
			PHC{
				Id:     "argon2i",
				Params: map[string]string{},
				Salt:   "/LtFjH5rVL8",
				Hash:   "",
			},
			false,
		},
		{
			"$argon2i$/LtFjH5rVL8$iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			PHC{
				Id:     "argon2i",
				Params: map[string]string{},
				Salt:   "/LtFjH5rVL8",
				Hash:   "iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			},
			false,
		},
		{
			"$argon2i$v=v2$/LtFjH5rVL8",
			PHC{
				Id:      "argon2i",
				Version: "v2",
				Params:  map[string]string{},
				Salt:    "/LtFjH5rVL8",
				Hash:    "",
			},
			false,
		},
		{
			"$argon2i$v=v2$/LtFjH5rVL8$iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			PHC{
				Id:      "argon2i",
				Version: "v2",
				Params:  map[string]string{},
				Salt:    "/LtFjH5rVL8",
				Hash:    "iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2$/LtFjH5rVL8",
			PHC{
				Id: "argon2i",
				Params: map[string]string{
					"m": "120",
					"t": "5000",
					"p": "2",
				},
				Salt: "/LtFjH5rVL8",
				Hash: "",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2$4fXXG0spB92WPB1NitT8/OH0VKI$iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			PHC{
				Id: "argon2i",
				Params: map[string]string{
					"m": "120",
					"t": "5000",
					"p": "2",
				},
				Salt: "4fXXG0spB92WPB1NitT8/OH0VKI",
				Hash: "iPBVuORECm5biUsjq33hn9/7BKqy9aPWKhFfK2haEsM",
			},
			false,
		},
		{
			"$argon2i$m=120,t=5000,p=2,keyid=Hj5+dsK0,data=sRlHhRmKUGzdOmXn01XmXygd5Kc$iHSDPHzUhPzK7rCcJgOFfg$J4moa2MM0/6uf3HbY2Tf5Fux8JIBTwIhmhxGRbsY14qhTltQt+Vw3b7tcJNEbk8ium8AQfZeD4tabCnNqfkD1g",
			PHC{
				Id:      "argon2i",
				Version: "",
				Params: map[string]string{
					"m":     "120",
					"t":     "5000",
					"p":     "2",
					"keyid": "Hj5+dsK0",
					"data":  "sRlHhRmKUGzdOmXn01XmXygd5Kc",
				},
				Salt: "iHSDPHzUhPzK7rCcJgOFfg",
				Hash: "J4moa2MM0/6uf3HbY2Tf5Fux8JIBTwIhmhxGRbsY14qhTltQt+Vw3b7tcJNEbk8ium8AQfZeD4tabCnNqfkD1g",
			},
			false,
		},
		{
			"$pbkdf2",
			PHC{
				Id:      "pbkdf2",
				Version: "",
				Params:  map[string]string{},
				Salt:    "",
				Hash:    "",
			},
			false,
		},
		{
			"$pbkdf2$cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ",
			PHC{
				Id:      "pbkdf2",
				Version: "",
				Params:  map[string]string{},
				Salt:    "cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ",
				Hash:    "",
			},
			false,
		},
		{
			"$pbkdf2$cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ$EFpj2Mnn+EbXTxZD5kv5t5Y69wzPJnDEZI3BtqlRCH0",
			PHC{
				Id:      "pbkdf2",
				Version: "",
				Params:  map[string]string{},
				Salt:    "cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ",
				Hash:    "EFpj2Mnn+EbXTxZD5kv5t5Y69wzPJnDEZI3BtqlRCH0",
			},
			false,
		},
		{
			"$pbkdf2$f=SHA256,w=600000,l=32$cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ$EFpj2Mnn+EbXTxZD5kv5t5Y69wzPJnDEZI3BtqlRCH0",
			PHC{
				Id:      "pbkdf2",
				Version: "",
				Params: map[string]string{
					"w": "600000",
					"f": "SHA256",
					"l": "32",
				},
				Salt: "cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ",
				Hash: "EFpj2Mnn+EbXTxZD5kv5t5Y69wzPJnDEZI3BtqlRCH0",
			},
			false,
		},
		{
			"$pbkdf2$v=5$w=600000,f=SHA256,l=32$iHSDPHzUhPzK7rCcJgOFfg$J4moa2MM0/6uf3HbY2Tf5Fux8JIBTwIhmhxGRbsY14qhTltQt+Vw3b7tcJNEbk8ium8AQfZeD4tabCnNqfkD1g",
			PHC{
				Id:      "pbkdf2",
				Version: "5",
				Params: map[string]string{
					"w": "600000",
					"f": "SHA256",
					"l": "32",
				},
				Salt: "iHSDPHzUhPzK7rCcJgOFfg",
				Hash: "J4moa2MM0/6uf3HbY2Tf5Fux8JIBTwIhmhxGRbsY14qhTltQt+Vw3b7tcJNEbk8ium8AQfZeD4tabCnNqfkD1g",
			},
			false,
		},

		/////////////////////////////////////////////////////////////////
		// Invalid strings
		{
			"",
			PHC{},
			true,
		},
		{
			"$",
			PHC{},
			true,
		},
		{
			"$pbkdf2$m=",
			PHC{},
			true,
		},
		{
			"$pbkdf2$m=120,",
			PHC{},
			true,
		},
		{
			"$pbkdf2$m=120,t=",
			PHC{},
			true,
		},
		{
			"$pbkdf2$",
			PHC{},
			true,
		},
		{
			"$pbkdf2$$$$",
			PHC{},
			true,
		},
		{
			"$pbkdf2$v=5$v=600000,f=SHA256,l=32$iHSDPHzUhPzK7rCcJgOFfg$J4moa2MM0/6uf3HbY2Tf5Fux8JIBTwIhmhxGRbsY14qhTltQt+Vw3b7tcJNEbk8ium8AQfZeD4tabCnNqfkD1g",
			PHC{},
			true,
		},
		// We limit the input to MaxRunes, so any runes after the limit are ignored
		{
			"$pbkdf2$cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ" + strings.Repeat("a", MaxRunes),
			PHC{
				Id:      "pbkdf2",
				Version: "",
				Params:  map[string]string{},
				Salt:    "cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ" + strings.Repeat("a", MaxRunes-len("$pbkdf2$cGFsZXN0aW5lIHdpbGwgYmUgZnJlZQ")),
				Hash:    "",
			},
			false,
		},
		// Edge case
		{
			// This is a bcrypt hashed password: it looks like PHC, but it is not:
			// The format is $xy$n$salthash, where:
			//   - $ is the literal '$' (1 byte)
			//   - x is the major version (1 byte)
			//   - y is the minor version (0 or 1 byte)
			//   - $ is the literal '$' (1 byte)
			//   - n is the cost (2 bytes)
			//   - $ is the literal '$' (1 byte)
			//   - salt is the encoded salt (22 bytes)
			//   - hash is the encoded hash (31 bytes)
			// In total, 60 bytes (59 if there is no minor version)
			//
			// But this is not PHC-compliant: xy is not the function id, n is not
			// a parameter name=value, nor the version, and there is no '$'
			// separating the salt and the hash.
			//
			// However, it is *technically* PHC-compliant:
			//   - xy is parsed as a function ID
			//   - n is parsed as the salt
			//   - salthash is parsed as the hash
			//
			// This is somewhat of an edge-case, and should probably be rejected
			// as non-parseable because "2a" is *not* a known function ID, but
			// we don't check for specific strings as of today
			"$2a$10$z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa",
			PHC{
				Id:      "2a",
				Version: "",
				Params:  map[string]string{},
				Salt:    "10",
				Hash:    "z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa",
			},
			false,
		},
	}

	for _, tc := range testCases {
		p := New(strings.NewReader(tc.input))
		phc, err := p.Parse()
		if tc.expectErr {
			require.Error(t, err)
		} else {
			require.NoError(t, err)
			require.Equal(t, phc, tc.output)
		}
	}
}
