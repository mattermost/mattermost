// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build linux

package unix_test

import (
	"io/ioutil"
	"os"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func TestTime(t *testing.T) {
	var ut unix.Time_t
	ut2, err := unix.Time(&ut)
	if err != nil {
		t.Fatalf("Time: %v", err)
	}
	if ut != ut2 {
		t.Errorf("Time: return value %v should be equal to argument %v", ut2, ut)
	}

	var now time.Time

	for i := 0; i < 10; i++ {
		ut, err = unix.Time(nil)
		if err != nil {
			t.Fatalf("Time: %v", err)
		}

		now = time.Now()

		if int64(ut) == now.Unix() {
			return
		}
	}

	t.Errorf("Time: return value %v should be nearly equal to time.Now().Unix() %v", ut, now.Unix())
}

func TestUtime(t *testing.T) {
	defer chtmpdir(t)()

	touch(t, "file1")

	buf := &unix.Utimbuf{
		Modtime: 12345,
	}

	err := unix.Utime("file1", buf)
	if err != nil {
		t.Fatalf("Utime: %v", err)
	}

	fi, err := os.Stat("file1")
	if err != nil {
		t.Fatal(err)
	}

	if fi.ModTime().Unix() != 12345 {
		t.Errorf("Utime: failed to change modtime: expected %v, got %v", 12345, fi.ModTime().Unix())
	}
}

func TestGetrlimit(t *testing.T) {
	var rlim unix.Rlimit
	err := unix.Getrlimit(unix.RLIMIT_AS, &rlim)
	if err != nil {
		t.Fatalf("Getrlimit: %v", err)
	}
}

// utilities taken from os/os_test.go

func touch(t *testing.T, name string) {
	f, err := os.Create(name)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}

// chtmpdir changes the working directory to a new temporary directory and
// provides a cleanup function. Used when PWD is read-only.
func chtmpdir(t *testing.T) func() {
	oldwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("chtmpdir: %v", err)
	}
	d, err := ioutil.TempDir("", "test")
	if err != nil {
		t.Fatalf("chtmpdir: %v", err)
	}
	if err := os.Chdir(d); err != nil {
		t.Fatalf("chtmpdir: %v", err)
	}
	return func() {
		if err := os.Chdir(oldwd); err != nil {
			t.Fatalf("chtmpdir: %v", err)
		}
		os.RemoveAll(d)
	}
}
