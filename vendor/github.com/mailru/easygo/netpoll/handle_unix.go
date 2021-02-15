// +build linux darwin dragonfly freebsd netbsd openbsd

package netpoll

import "syscall"

func setNonblock(fd int, nonblocking bool) (err error) {
	return syscall.SetNonblock(fd, nonblocking)
}
