package template_test

import (
	"testing"

	socktmpl "github.com/hashicorp/go-sockaddr/template"
)

func TestSockAddr_Parse(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		output        string
		fail          bool
		requireOnline bool
	}{
		{
			name:   `basic include "name"`,
			input:  `{{GetAllInterfaces | include "name" "lo0" | printf "%v"}}`,
			output: `[127.0.0.1/8 {1 16384 lo0  up|loopback|multicast} ::1 {1 16384 lo0  up|loopback|multicast} fe80::1/64 {1 16384 lo0  up|loopback|multicast}]`,
		},
		{
			name:   "invalid input",
			input:  `{{`,
			output: ``,
			fail:   true,
		},
		{
			name:   "GetDefaultInterface",
			input:  `{{GetDefaultInterfaces | include "type" "IPv4" | attr "name" }}`,
			output: `en0`,
		},
		{
			name:   `include "name" regexp`,
			input:  `{{GetAllInterfaces | include "name" "^(en|lo)0$" | exclude "name" "^en0$" | sort "type" | sort "address" | join "address" " " }}`,
			output: `127.0.0.1 ::1 fe80::1`,
		},
		{
			name:   `exclude "name"`,
			input:  `{{. | include "name" "^(en|lo)0$" | exclude "name" "^en0$" | sort "type" | sort "address" | join "address" " " }}`,
			output: `127.0.0.1 ::1 fe80::1`,
		},
		{
			name:   `"dot" pipeline, IPv4 type`,
			input:  `{{. | include "type" "IPv4" | include "name" "^lo0$" | sort "type" | sort "address" }}`,
			output: `[127.0.0.1/8 {1 16384 lo0  up|loopback|multicast}]`,
		},
		{
			name:   `include "type" "IPv6`,
			input:  `{{. | include "type" "IPv6" | include "name" "^lo0$" | sort "address" }}`,
			output: `[::1 {1 16384 lo0  up|loopback|multicast} fe80::1/64 {1 16384 lo0  up|loopback|multicast}]`,
		},
		{
			name:   "better example for IP types",
			input:  `{{. | include "type" "IPv4|IPv6" | include "name" "^lo0$" | sort "type" | sort "address" }}`,
			output: `[127.0.0.1/8 {1 16384 lo0  up|loopback|multicast} ::1 {1 16384 lo0  up|loopback|multicast} fe80::1/64 {1 16384 lo0  up|loopback|multicast}]`,
		},
		{
			name:   "ifAddrs1",
			input:  `{{. | include "type" "IPv4" | include "name" "^lo0$"}}`,
			output: `[127.0.0.1/8 {1 16384 lo0  up|loopback|multicast}]`,
		},
		{
			name:   "ifAddrs2",
			input:  `{{. | include "type" "IP" | include "name" "^lo0$" | sort "type" | sort "address" }}`,
			output: `[127.0.0.1/8 {1 16384 lo0  up|loopback|multicast} ::1 {1 16384 lo0  up|loopback|multicast} fe80::1/64 {1 16384 lo0  up|loopback|multicast}]`,
		},
		{
			name:   `range "dot" example`,
			input:  `{{range . | include "type" "IP" | include "name" "^lo0$"}}{{.Name}} {{.SockAddr}} {{end}}`,
			output: `lo0 127.0.0.1/8 lo0 ::1 lo0 fe80::1/64 `,
		},
		{
			name:   `exclude "type"`,
			input:  `{{. | exclude "type" "IPv4" | include "name" "^lo0$" | sort "address" | unique "name" | join "name" " "}} {{range . | exclude "type" "IPv4" | include "name" "^lo0$"}}{{.SockAddr}} {{end}}`,
			output: `lo0 ::1 fe80::1/64 `,
		},
		{
			name:   "with variable pipeline",
			input:  `{{with $ifSet := include "type" "IPv4" . | include "name" "^lo0$"}}{{range $ifSet }}{{.Name}} {{end}}{{range $ifSet}}{{.SockAddr}} {{end}}{{end}}`,
			output: `lo0 127.0.0.1/8 `,
		},
		{
			name:   "range sample on lo0",
			input:  `{{with $ifAddrs := . | exclude "rfc" "1918" | include "name" "lo0" | sort "type,address" }}{{range $ifAddrs }}{{.Name}}/{{.SockAddr.NetIP}} {{end}}{{end}}`,
			output: `lo0/127.0.0.1 lo0/::1 lo0/fe80::1 `,
		},
		{
			name:   "non-RFC1918 on on lo0",
			input:  `{{. | exclude "rfc" "1918" | include "name" "lo0" | sort "type,address" | len | eq 3}}`,
			output: `true`,
		},
		{
			// NOTE(sean@): Difficult to reliably test includeByRFC.
			// In this case, we ass-u-me that the host running the
			// test has at least one RFC1918 address on their host.
			name:          `include "rfc"`,
			input:         `{{(. | include "rfc" "1918" | attr "name")}}`,
			output:        `en0`,
			requireOnline: true,
		},
		{
			name:   "test for non-empty array",
			input:  `{{. | include "type" "IPv4" | include "rfc" "1918" | print | len | eq (len "[]")}}`,
			output: `false`,
		},
		{
			// NOTE(sean@): This will fail if there is a public IPv4 address on loopback.
			name:   "non-IPv4 RFC1918",
			input:  `{{. | include "name" "lo0" | exclude "type" "IPv4" | include "rfc" "1918" | len | eq 0}}`,
			output: `true`,
		},
		{
			// NOTE(sean@): There are no RFC6598 addresses on most testing hosts so this should be empty.
			name:   "rfc6598",
			input:  `{{. | include "type" "IPv4" | include "rfc" "6598" | print | len | eq (len "[]")}}`,
			output: `true`,
		},
		{
			name:   "invalid RFC",
			input:  `{{. | include "type" "IPv4" | include "rfc" "99999999999" | print | len | eq (len "[]")}}`,
			output: `true`,
			fail:   true,
		},
		{
			name:   `sort asc address`,
			input:  `{{ . | include "name" "lo0" | sort "type,address" | join "address" " " }}`,
			output: `127.0.0.1 ::1 fe80::1`,
		},
		{
			name:   `sort asc address old`,
			input:  `{{with $ifSet := include "name" "lo0" . }}{{ range include "type" "IPv4" $ifSet | sort "address"}}{{ .SockAddr }} {{end}}{{ range include "type" "IPv6" $ifSet | sort "address"}}{{ .SockAddr }} {{end}}{{end}}`,
			output: `127.0.0.1/8 ::1 fe80::1/64 `,
		},
		{
			name:   `sort desc address`,
			input:  `{{ . | include "name" "lo0" | sort "type,-address" | join "address" " " }}`,
			output: `127.0.0.1 fe80::1 ::1`,
		},
		{
			name:   `sort desc address`,
			input:  `{{ . | include "name" "lo0" | include "type" "IPv6" | sort "type,-address" | join "address" " " }}`,
			output: `fe80::1 ::1`,
		},
		{
			name:   `sort asc address`,
			input:  `{{with $ifSet := include "name" "lo0" . }}{{ range include "type" "IPv6" $ifSet | sort "address"}}{{ .SockAddr }} {{end}}{{end}}`,
			output: `::1 fe80::1/64 `,
		},
		{
			name:   "lo0 limit 1",
			input:  `{{. | include "name" "lo0" | include "type" "IPv6" | sort "address" | limit 1 | len}}`,
			output: `1`,
		},
		{
			name:   "join address",
			input:  `{{. | include "name" "lo0" | include "type" "IPv6" | sort "address" | join "address" " " }}`,
			output: `::1 fe80::1`,
		},
		{
			name:   "join name",
			input:  `{{. | include "name" "lo0" | include "type" "IPv6" | sort "address" | join "name" " " }}`,
			output: `lo0 lo0`,
		},
		{
			name:   "lo0 flags up and limit 1",
			input:  `{{. | include "name" "lo0" | include "flag" "up" | sort "-type,+address" | attr "address" }}`,
			output: `::1`,
		},
		{
			// NOTE(sean@): This is the HashiCorp default in 2016.
			// Indented for effect.  Using "true" as the output
			// instead of printing the correct $rfc*Addrs values.
			name: "HashiCorpDefault2016",
			input: `
{{- with $addr := GetAllInterfaces | include "type" "IP" | include "rfc" "1918|6598" | sort "address" | attr "address" -}}

  {{- if ($addr | len) gt 0 -}}
    {{- print "true" -}}{{/* print $addr*/ -}}
  {{- end -}}
{{- end -}}`,
			output: `true`,
		},
	}

	for i, test := range tests {
		test := test // capture range variable
		if test.name == "" {
			t.Fatalf("test number %d has an empty test name", i)
		}
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			out, err := socktmpl.Parse(test.input)
			if err != nil && !test.fail {
				t.Fatalf("%q: bad: %v", test.name, err)
			}

			if out != test.output && !test.fail {
				t.Fatalf("%q: Expected %+q, received %+q\n%+q", test.name, test.output, out, test.input)
			}
		})
	}
}
