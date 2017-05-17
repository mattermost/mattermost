package sockaddr

import "testing"

func Test_parseBSDDefaultIfName(t *testing.T) {
	testCases := []struct {
		name     string
		routeOut string
		want     string
	}{
		{
			name: "macOS Sierra 10.12 - Common",
			routeOut: `   route to: default
destination: default
       mask: default
    gateway: 10.23.9.1
  interface: en0
      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING>
 recvpipe  sendpipe  ssthresh  rtt,msec    rttvar  hopcount      mtu     expire
       0         0         0         0         0         0      1500         0 
`,
			want: "en0",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseDefaultIfNameFromRoute(tc.routeOut)
			if err != nil {
				t.Fatalf("unable to parse default interface from route output: %v", err)
			}

			if got != tc.want {
				t.Errorf("got %s; want %s", got, tc.want)
			}
		})
	}
}

func Test_parseLinuxDefaultIfName(t *testing.T) {
	testCases := []struct {
		name     string
		routeOut string
		want     string
	}{
		{
			name: "Linux Ubuntu 14.04 - Common",
			routeOut: `default via 10.1.2.1 dev eth0 
10.1.2.0/24 dev eth0  proto kernel  scope link  src 10.1.2.5 
`,
			want: "eth0",
		},
		{
			name: "Chromebook - 8743.85.0 (Official Build) stable-channel gandof, Milestone 54",
			routeOut: `default via 192.168.1.1 dev wlan0  metric 1 
192.168.1.0/24 dev wlan0  proto kernel  scope link  src 192.168.1.174 
`,
			want: "wlan0",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseDefaultIfNameFromIPCmd(tc.routeOut)
			if err != nil {
				t.Fatalf("unable to parse default interface from route output: %v", err)
			}

			if got != tc.want {
				t.Errorf("got %+q; want %+q", got, tc.want)
			}
		})
	}
}

func Test_parseWindowsDefaultIfName(t *testing.T) {
	testCases := []struct {
		name        string
		routeOut    string
		ipconfigOut string
		want        string
	}{
		{
			name: "Windows 10 - Enterprise",
			routeOut: `===========================================================================
Interface List
 10...08 00 27 a2 e9 51 ......Intel(R) PRO/1000 MT Desktop Adapter
 13...08 00 27 35 02 ed ......Intel(R) PRO/1000 MT Desktop Adapter #2
  1...........................Software Loopback Interface 1
  5...00 00 00 00 00 00 00 e0 Microsoft ISATAP Adapter
  8...00 00 00 00 00 00 00 e0 Microsoft ISATAP Adapter #3
===========================================================================

IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0         10.0.2.2        10.0.2.15     25
         10.0.2.0    255.255.255.0         On-link         10.0.2.15    281
        10.0.2.15  255.255.255.255         On-link         10.0.2.15    281
       10.0.2.255  255.255.255.255         On-link         10.0.2.15    281
        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331
        127.0.0.1  255.255.255.255         On-link         127.0.0.1    331
  127.255.255.255  255.255.255.255         On-link         127.0.0.1    331
     192.168.56.0    255.255.255.0         On-link    192.168.56.100    281
   192.168.56.100  255.255.255.255         On-link    192.168.56.100    281
   192.168.56.255  255.255.255.255         On-link    192.168.56.100    281
        224.0.0.0        240.0.0.0         On-link         127.0.0.1    331
        224.0.0.0        240.0.0.0         On-link    192.168.56.100    281
        224.0.0.0        240.0.0.0         On-link         10.0.2.15    281
  255.255.255.255  255.255.255.255         On-link         127.0.0.1    331
  255.255.255.255  255.255.255.255         On-link    192.168.56.100    281
  255.255.255.255  255.255.255.255         On-link         10.0.2.15    281
===========================================================================
Persistent Routes:
  None

IPv6 Route Table
===========================================================================
Active Routes:
 If Metric Network Destination      Gateway
  1    331 ::1/128                  On-link
 13    281 fe80::/64                On-link
 10    281 fe80::/64                On-link
 13    281 fe80::60cc:155f:77a4:ab99/128
                                    On-link
 10    281 fe80::cccc:710e:f5bb:3088/128
                                    On-link
  1    331 ff00::/8                 On-link
 13    281 ff00::/8                 On-link
 10    281 ff00::/8                 On-link
===========================================================================
Persistent Routes:
  None
`,
			ipconfigOut: `Windows IP Configuration


Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . : host.example.org
   Link-local IPv6 Address . . . . . : fe80::cccc:710e:f5bb:3088%10
   IPv4 Address. . . . . . . . . . . : 10.0.2.15
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 10.0.2.2

Ethernet adapter Ethernet 2:

   Connection-specific DNS Suffix  . : 
   Link-local IPv6 Address . . . . . : fe80::60cc:155f:77a4:ab99%13
   IPv4 Address. . . . . . . . . . . : 192.168.56.100
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 

Tunnel adapter isatap.host.example.org:

   Media State . . . . . . . . . . . : Media disconnected
   Connection-specific DNS Suffix  . : 

Tunnel adapter Reusable ISATAP Interface {F3F2E4A5-8823-40E5-87EA-1F6881BACC95}:

   Media State . . . . . . . . . . . : Media disconnected
   Connection-specific DNS Suffix  . : host.example.org
`,
			want: "Ethernet",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseDefaultIfNameWindows(tc.routeOut, tc.ipconfigOut)
			if err != nil {
				t.Fatalf("unable to parse default interface from route output: %v", err)
			}

			if got != tc.want {
				t.Errorf("got %s; want %s", got, tc.want)
			}
		})
	}
}

func Test_VisitComands(t *testing.T) {
	ri, err := NewRouteInfo()
	if err != nil {
		t.Fatalf("bad: %v", err)
	}

	var count int
	ri.VisitCommands(func(name string, cmd []string) {
		count++
	})
	if count == 0 {
		t.Fatalf("Expected more than 0 items")
	}
}
