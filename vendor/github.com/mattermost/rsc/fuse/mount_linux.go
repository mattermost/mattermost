// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package fuse

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"syscall"
)

func mount(dir string) (fusefd int, errmsg string) {
	fds, err := syscall.Socketpair(syscall.AF_FILE, syscall.SOCK_STREAM, 0)
	if err != nil {
		return -1, fmt.Sprintf("socketpair error: %v", err)
	}
	defer syscall.Close(fds[0])
	defer syscall.Close(fds[1])

	cmd := exec.Command("/bin/fusermount", "--", dir)
	cmd.Env = append(os.Environ(), "_FUSE_COMMFD=3")

	writeFile := os.NewFile(uintptr(fds[0]), "fusermount-child-writes")
	defer writeFile.Close()
	cmd.ExtraFiles = []*os.File{writeFile}

	out, err := cmd.CombinedOutput()
	if len(out) > 0 || err != nil {
		return -1, fmt.Sprintf("fusermount: %q, %v", out, err)
	}

	readFile := os.NewFile(uintptr(fds[1]), "fusermount-parent-reads")
	defer readFile.Close()
	c, err := net.FileConn(readFile)
	if err != nil {
		return -1, fmt.Sprintf("FileConn from fusermount socket: %v", err)
	}
	defer c.Close()

	uc, ok := c.(*net.UnixConn)
	if !ok {
		return -1, fmt.Sprintf("unexpected FileConn type; expected UnixConn, got %T", c)
	}

	buf := make([]byte, 32) // expect 1 byte
	oob := make([]byte, 32) // expect 24 bytes
	_, oobn, _, _, err := uc.ReadMsgUnix(buf, oob)
	scms, err := syscall.ParseSocketControlMessage(oob[:oobn])
	if err != nil {
		return -1, fmt.Sprintf("ParseSocketControlMessage: %v", err)
	}
	if len(scms) != 1 {
		return -1, fmt.Sprintf("expected 1 SocketControlMessage; got scms = %#v", scms)
	}
	scm := scms[0]
	gotFds, err := syscall.ParseUnixRights(&scm)
	if err != nil {
		return -1, fmt.Sprintf("syscall.ParseUnixRights: %v", err)
	}
	if len(gotFds) != 1 {
		return -1, fmt.Sprintf("wanted 1 fd; got %#v", gotFds)
	}
	return gotFds[0], ""
}
