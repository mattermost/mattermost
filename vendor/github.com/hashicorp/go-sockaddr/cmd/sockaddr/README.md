# `sockaddr(1)`

`sockaddr` is a CLI utility that wraps and exposes `go-sockaddr` functionality
from the command line.

```text
$ go get -u github.com/hashicorp/go-sockaddr/cmd/sockaddr
```

```text
% sockaddr -h
usage: sockaddr [--version] [--help] <command> [<args>]

Available commands are:
    dump       Parses IP addresses
    eval       Evaluates a sockaddr template
    rfc        Test to see if an IP is part of a known RFC
    version    Prints the sockaddr version
```

## `sockaddr dump`

```text
Usage: sockaddr dump [options] input [...]

  Parse address(es) or interface and dumps various output.

Options:

  -4  Parse the input as IPv4 only
  -6  Parse the input as IPv6 only
  -H  Machine readable output
  -I  Parse the argument as an interface name
  -i  Parse the input as IP address (either IPv4 or IPv6)
  -n  Show only the value
  -o  Name of an attribute to pass through
  -u  Parse the input as a UNIX Socket only
```

### `sockaddr dump` example output

By default it prints out all available information unless the `-o` flag is
specified.

```text
% sockaddr dump 127.0.0.2/8
Attribute     Value
type          IPv4
string        127.0.0.2/8
host          127.0.0.2
address       127.0.0.2
port          0
netmask       255.0.0.0
network       127.0.0.0/8
mask_bits     8
binary        01111111000000000000000000000010
hex           7f000002
first_usable  127.0.0.1
last_usable   127.255.255.254
octets        127 0 0 2
size          16777216
broadcast     127.255.255.255
uint32        2130706434
DialPacket    "udp4" ""
DialStream    "tcp4" ""
ListenPacket  "udp4" ""
ListenStream  "tcp4" ""
$ sockaddr dump -H -o host,address,port -o mask_bits 127.0.0.3:8600
host	127.0.0.3:8600
address	127.0.0.3
port	8600
mask_bits	32
$ sockaddr dump -H -n -o host,address,port -o mask_bits 127.0.0.3:8600
127.0.0.3:8600
127.0.0.3
8600
32
$ sockaddr dump -o type,address,hex,network '[2001:db8::3/32]'
Attribute  Value
type       IPv6
address    2001:db8::3
network    2001:db8::/32
hex        20010db8000000000000000000000003
$ sockaddr dump /tmp/example.sock
Attribute     Value
type          UNIX
string        "/tmp/example.sock"
path          /tmp/example.sock
DialPacket    "unixgram" "/tmp/example.sock"
DialStream    "unix" "/tmp/example.sock"
ListenPacket  "unixgram" "/tmp/example.sock"
ListenStream  "unix" "/tmp/example.sock"
```

## `sockaddr eval`

```text
Usage: sockaddr eval [options] [template ...]

  Parse the sockaddr template and evaluates the output.

  The `sockaddr` library has the potential to be very complex,
  which is why the `sockaddr` command supports an `eval`
  subcommand in order to test configurations from the command
  line.  The `eval` subcommand automatically wraps its input
  with the `{{` and `}}` template delimiters unless the `-r`
  command is specified, in which case `eval` parses the raw
  input.  If the `template` argument passed to `eval` is a
  dash (`-`), then `sockaddr eval` will read from stdin and
  automatically sets the `-r` flag.

Options:

  -d  Debug output
  -n  Suppress newlines between args
  -r  Suppress wrapping the input with {{ }} delimiters
```

Here are a few impractical examples to get you started:

```text
$ sockaddr eval 'GetAllInterfaces | include "flags" "forwardable" | include "up" | sort "default,type,size" | include "RFC" "6890" | attr "address"'
172.14.6.167
$ sockaddr eval 'GetDefaultInterfaces | sort "type,size" | include "RFC" "6890" | limit 1 | join "address" " "'
172.14.6.167
$ sockaddr eval 'GetPublicIP'
203.0.113.4
$ sockaddr eval 'GetPrivateIP'
172.14.6.167
$ sockaddr eval 'GetInterfaceIP "eth0"'
172.14.6.167
$ sockaddr eval 'GetAllInterfaces | include "network" "172.14.6.0/24" | attr "address"'
172.14.6.167
$ sockaddr eval 'GetPrivateInterfaces | join "type" " "'
IPv4 IPv6
$ sockaddr eval 'GetAllInterfaces | include "flags" "forwardable" | join "address" " "'
203.0.113.4 2001:0DB8::1
$ sockaddr eval 'GetAllInterfaces | include "name" "lo0" | include "type" "IPv6" | sort "address" | join "address" " "'
100:: fe80::1
$ sockaddr eval '. | include "rfc" "1918" | print | len | lt 2'
true
$ sockaddr eval -r '{{with $ifSet := include "name" "lo0" . }}{{ range include "type" "IPv6" $ifSet | sort "address" | reverse}}{{ . }} {{end}}{{end}}'
fe80::1/64 {1 16384 lo0  up|loopback|multicast} 100:: {1 16384 lo0  up|loopback|multicast}
$ sockaddr eval '. | include "name" "lo0" | include "type" "IPv6" | sort "address" | join "address" " "'
100:: fe80::1
$ cat <<'EOF' | sockaddr eval -
{{. | include "name" "lo0" | include "type" "IPv6" | sort "address" | join "address" " "}}
EOF
100:: fe80::1
$ sockaddr eval 'GetPrivateInterfaces | include "flags" "forwardable|up" | include "type" "IPv4" | math "network" "+2" | attr "address"'
172.14.6.2
$ cat <<'EOF' | sudo tee -a /etc/profile
export CONSUL_HTTP_ADDR="http://`sockaddr eval 'GetInterfaceIP \"eth0\"'`:8500"
EOF
```

## `sockaddr rfc`

```text
$ sockaddr rfc
Usage: sockaddr rfc [RFC Number] [IP Address]

  Tests a given IP address to see if it is part of a known
  RFC.  If the IP address belongs to a known RFC, return exit
  code 0 and print the status.  If the IP does not belong to
  an RFC, return 1.  If the RFC is not known, return 2.

Options:

  -s  Silent, only return different exit codes
$ sockaddr rfc 1918 192.168.1.10
192.168.1.10 is part of RFC 1918
$ sockaddr rfc 6890 '[::1]'
100:: is part of RFC 6890
$ sockaddr rfc list
919
1112
1122
1918
2544
2765
2928
3056
3068
3171
3330
3849
3927
4038
4193
4291
4380
4773
4843
5180
5735
5737
6052
6333
6598
6666
6890
7335
```

## `sockaddr tech-support`

If one of the helper methods that derives its output from `GetDefaultInterfaces`
is misbehaving, submit the output from this command as an issue along with
any miscellaneous details that are specific to your environment.

```text
Usage: sockaddr tech-support [options]

  Print out network diagnostic information that can be used by
  support.
  
  The `sockaddr` library relies on OS-specific commands and
  output which can potentially be brittle.  The `tech-support`
  subcommand emits all of the platform-specific network
  details required to debug why a given `sockaddr` API call is
  behaving differently than expected.  The `-output` flag
  controls the output format. The default output mode is
  Markdown (`md`) however a raw mode (`raw`) is available to
  obtain the original output.

Options:

  -output  Encode the output using one of Markdown ("md") or Raw ("raw")
```

## `sockaddr version`

The lowly version stub.

```text
$ sockaddr version
sockaddr 0.1.0-dev
```
