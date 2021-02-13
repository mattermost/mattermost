// +build !linux,!darwin,!dragonfly,!freebsd,!netbsd,!openbsd

package netpoll

import "fmt"

func setNonblock(fd int, nonblocking bool) (err error) {
	return fmt.Errorf("setNonblock is not supported on this operating system")
}
