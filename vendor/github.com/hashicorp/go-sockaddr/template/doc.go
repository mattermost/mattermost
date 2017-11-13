/*

Package sockaddr/template provides a text/template interface the SockAddr helper
functions.  The primary entry point into the sockaddr/template package is
through its Parse() call.  For example:

    import (
      "fmt"

      template "github.com/hashicorp/go-sockaddr/template"
    )

    results, err := template.Parse(`{{ GetPrivateIP }}`)
    if err != nil {
      fmt.Errorf("Unable to find a private IP address: %v", err)
    }
    fmt.Printf("My Private IP address is: %s\n", results)

Below is a list of builtin template functions and details re: their usage.  It
is possible to add additional functions by calling ParseIfAddrsTemplate
directly.

In general, the calling convention for this template library is to seed a list
of initial interfaces via one of the Get*Interfaces() calls, then filter, sort,
and extract the necessary attributes for use as string input.  This template
interface is primarily geared toward resolving specific values that are only
available at runtime, but can be defined as a heuristic for execution when a
config file is parsed.

All functions, unless noted otherwise, return an array of IfAddr structs making
it possible to `sort`, `filter`, `limit`, seek (via the `offset` function), or
`unique` the list.  To extract useful string information, the `attr` and `join`
functions return a single string value.  See below for details.

Important note: see the
https://github.com/hashicorp/go-sockaddr/tree/master/cmd/sockaddr utility for
more examples and for a CLI utility to experiment with the template syntax.

`GetAllInterfaces` - Returns an exhaustive set of IfAddr structs available on
the host.  `GetAllInterfaces` is the initial input and accessible as the initial
"dot" in the pipeline.

Example:

    {{ GetAllInterfaces }}


`GetDefaultInterfaces` - Returns one IfAddr for every IP that is on the
interface containing the default route for the host.

Example:

    {{ GetDefaultInterfaces }}

`GetPrivateInterfaces` - Returns one IfAddr for every forwardable IP address
that is included in RFC 6890 and whose interface is marked as up.  NOTE: RFC 6890 is a more exhaustive
version of RFC1918 because it spans IPv4 and IPv6, however, RFC6890 does permit the
inclusion of likely undesired addresses such as multicast, therefore our version
of "private" also filters out non-forwardable addresses.

Example:

    {{ GetPrivateInterfaces | sort "default" | join "address" " " }}


`GetPublicInterfaces` - Returns a list of IfAddr structs whos IPs are
forwardable, do not match RFC 6890, and whose interface is marked up.

Example:

    {{ GetPublicInterfaces | sort "default" | join "name" " " }}


`GetPrivateIP` - Helper function that returns a string of the first IP address
from GetPrivateInterfaces.

Example:

    {{ GetPrivateIP }}


`GetPrivateIPs` - Helper function that returns a string of the all private IP
addresses on the host.

Example:

    {{ GetPrivateIPs }}


`GetPublicIP` - Helper function that returns a string of the first IP from
GetPublicInterfaces.

Example:

    {{ GetPublicIP }}

`GetPublicIPs` - Helper function that returns a space-delimited string of the
all public IP addresses on the host.

Example:

    {{ GetPrivateIPs }}


`GetInterfaceIP` - Helper function that returns a string of the first IP from
the named interface.

Example:

    {{ GetInterfaceIP "en0" }}



`GetInterfaceIPs` - Helper function that returns a space-delimited list of all
IPs on a given interface.

Example:

    {{ GetInterfaceIPs "en0" }}


`sort` - Sorts the IfAddrs result based on its arguments.  `sort` takes one
argument, a list of ways to sort its IfAddrs argument.  The list of sort
criteria is comma separated (`,`):
  - `address`, `+address`: Ascending sort of IfAddrs by Address
  - `-address`: Descending sort of IfAddrs by Address
  - `default`, `+default`: Ascending sort of IfAddrs, IfAddr with a default route first
  - `-default`: Descending sort of IfAddrs, IfAttr with default route last
  - `name`, `+name`: Ascending sort of IfAddrs by lexical ordering of interface name
  - `-name`: Descending sort of IfAddrs by lexical ordering of interface name
  - `port`, `+port`: Ascending sort of IfAddrs by port number
  - `-port`: Descending sort of IfAddrs by port number
  - `private`, `+private`: Ascending sort of IfAddrs with private addresses first
  - `-private`: Descending sort IfAddrs with private addresses last
  - `size`, `+size`: Ascending sort of IfAddrs by their network size as determined
    by their netmask (larger networks first)
  - `-size`: Descending sort of IfAddrs by their network size as determined by their
    netmask (smaller networks first)
  - `type`, `+type`: Ascending sort of IfAddrs by the type of the IfAddr (Unix,
    IPv4, then IPv6)
  - `-type`: Descending sort of IfAddrs by the type of the IfAddr (IPv6, IPv4, Unix)

Example:

    {{ GetPrivateInterfaces | sort "default,-type,size,+address" }}


`exclude` and `include`: Filters IfAddrs based on the selector criteria and its
arguments.  Both `exclude` and `include` take two arguments.  The list of
available filtering criteria is:
  - "address": Filter IfAddrs based on a regexp matching the string representation
    of the address
  - "flag","flags": Filter IfAddrs based on the list of flags specified.  Multiple
    flags can be passed together using the pipe character (`|`) to create an inclusive
    bitmask of flags.  The list of flags is included below.
  - "name": Filter IfAddrs based on a regexp matching the interface name.
  - "network": Filter IfAddrs based on whether a netowkr is included in a given
    CIDR.  More than one CIDR can be passed in if each network is separated by
    the pipe character (`|`).
  - "port": Filter IfAddrs based on an exact match of the port number (number must
    be expressed as a string)
  - "rfc", "rfcs": Filter IfAddrs based on the matching RFC.  If more than one RFC
    is specified, the list of RFCs can be joined together using the pipe character (`|`).
  - "size": Filter IfAddrs based on the exact match of the mask size.
  - "type": Filter IfAddrs based on their SockAddr type.  Multiple types can be
    specified together by using the pipe character (`|`).  Valid types include:
    `ip`, `ipv4`, `ipv6`, and `unix`.

Example:

    {{ GetPrivateInterfaces | exclude "type" "IPv6" }}


`unique`: Removes duplicate entries from the IfAddrs list, assuming the list has
already been sorted.  `unique` only takes one argument:
  - "address": Removes duplicates with the same address
  - "name": Removes duplicates with the same interface names

Example:

    {{ GetAllInterfaces | sort "default,-type,address" | unique "name" }}


`limit`: Reduces the size of the list to the specified value.

Example:

    {{ GetPrivateInterfaces | limit 1 }}


`offset`: Seeks into the list by the specified value.  A negative value can be
used to seek from the end of the list.

Example:

    {{ GetPrivateInterfaces | offset "-2" | limit 1 }}


`math`: Perform a "math" operation on each member of the list and return new
values.  `math` takes two arguments, the attribute to operate on and the
operation's value.

Supported operations include:

  - `address`: Adds the value, a positive or negative value expressed as a
    decimal string, to the address.  The sign is required.  This value is
    allowed to over or underflow networks (e.g. 127.255.255.255 `"address" "+1"`
    will return "128.0.0.0").  Addresses will wrap at IPv4 or IPv6 boundaries.
  - `network`: Add the value, a positive or negative value expressed as a
    decimal string, to the network address.  The sign is required.  Positive
    values are added to the network address.  Negative values are subtracted
    from the network's broadcast address (e.g. 127.0.0.1 `"network" "-1"` will
    return "127.255.255.255").  Values that overflow the network size will
    safely wrap.
  - `mask`: Applies the given network mask to the address. The network mask is
  	expressed as a decimal value (e.g. network mask "24" corresponds to
  	`255.255.255.0`). After applying the network mask, the network mask of the
  	resulting address will be either the applied network mask or the network mask
  	of the input address depending on which network is larger
  	(e.g. 192.168.10.20/24 `"mask" "16"` will return "192.168.0.0/16" but
  	192.168.10.20/24 `"mask" "28"` will return "192.168.10.16/24").

Example:

    {{ GetPrivateInterfaces | include "type" "IP" | math "address" "+256" | attr "address" }}
    {{ GetPrivateInterfaces | include "type" "IP" | math "address" "-256" | attr "address" }}
    {{ GetPrivateInterfaces | include "type" "IP" | math "network" "+2" | attr "address" }}
    {{ GetPrivateInterfaces | include "type" "IP" | math "network" "-2" | attr "address" }}
    {{ GetPrivateInterfaces | include "type" "IP" | math "mask" "24" | attr "address" }}
    {{ GetPrivateInterfaces | include "flags" "forwardable|up" | include "type" "IPv4" | math "network" "+2" | attr "address" }}


`attr`: Extracts a single attribute of the first member of the list and returns
it as a string.  `attr` takes a single attribute name.  The list of available
attributes is type-specific and shared between `join`.  See below for a list of
supported attributes.

Example:

    {{ GetAllInterfaces | exclude "flags" "up" | attr "address" }}


`Attr`: Extracts a single attribute from an `IfAttr` and in every other way
performs the same as the `attr`.

Example:

    {{ with $ifAddrs := GetAllInterfaces | include "type" "IP" | sort "+type,+address" -}}
      {{- range $ifAddrs -}}
        {{- Attr "address" . }} -- {{ Attr "network" . }}/{{ Attr "size" . -}}
      {{- end -}}
    {{- end }}


`join`: Similar to `attr`, `join` extracts all matching attributes of the list
and returns them as a string joined by the separator, the second argument to
`join`.  The list of available attributes is type-specific and shared between
`join`.

Example:

    {{ GetAllInterfaces | include "flags" "forwardable" | join "address" " " }}


`exclude` and `include` flags:
  - `broadcast`
  - `down`: Is the interface down?
  - `forwardable`: Is the IP forwardable?
  - `global unicast`
  - `interface-local multicast`
  - `link-local multicast`
  - `link-local unicast`
  - `loopback`
  - `multicast`
  - `point-to-point`
  - `unspecified`: Is the IfAddr the IPv6 unspecified address?
  - `up`: Is the interface up?


Attributes for `attr`, `Attr`, and `join`:

SockAddr Type:
  - `string`
  - `type`

IPAddr Type:
  - `address`
  - `binary`
  - `first_usable`
  - `hex`
  - `host`
  - `last_usable`
  - `mask_bits`
  - `netmask`
  - `network`
  - `octets`: Decimal values per byte
  - `port`
  - `size`: Number of hosts in the network

IPv4Addr Type:
  - `broadcast`
  - `uint32`: unsigned integer representation of the value

IPv6Addr Type:
  - `uint128`: unsigned integer representation of the value

UnixSock Type:
  - `path`

*/
package template
