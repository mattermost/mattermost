// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

func init() {
	if len(os.Args) < 3 || os.Args[0] != "sandbox.runProcess" {
		return
	}

	var config Configuration
	if err := json.Unmarshal([]byte(os.Args[1]), &config); err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	if err := runProcess(&config, os.Args[2]); err != nil {
		if eerr, ok := err.(*exec.ExitError); ok {
			if status, ok := eerr.Sys().(syscall.WaitStatus); ok {
				os.Exit(status.ExitStatus())
			}
		}
		fmt.Println(err.Error())
		os.Exit(1)
	}
	os.Exit(0)
}

func systemMountPoints() (points []*MountPoint) {
	points = append(points, &MountPoint{
		Source:      "proc",
		Destination: "/proc",
		Type:        "proc",
	}, &MountPoint{
		Source: "/dev/null",
	}, &MountPoint{
		Source: "/dev/zero",
	}, &MountPoint{
		Source: "/dev/full",
	})

	readOnly := []string{
		"/dev/random",
		"/dev/urandom",
		"/etc/resolv.conf",
		"/lib",
		"/lib32",
		"/lib64",
		"/etc/ssl/certs",
		"/system/etc/security/cacerts",
		"/usr/local/share/certs",
		"/etc/pki/tls/certs",
		"/etc/openssl/certs",
		"/etc/ssl/ca-bundle.pem",
		"/etc/pki/tls/cacert.pem",
		"/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
	}

	for _, v := range []string{"SSL_CERT_FILE", "SSL_CERT_DIR"} {
		if path := os.Getenv(v); path != "" {
			readOnly = append(readOnly, path)
		}
	}

	for _, point := range readOnly {
		points = append(points, &MountPoint{
			Source:   point,
			ReadOnly: true,
		})
	}

	return
}

func runProcess(config *Configuration, path string) error {
	root, err := ioutil.TempDir("", "")
	if err != nil {
		return err
	}
	defer os.RemoveAll(root)

	if err := mountMountPoints(root, systemMountPoints()); err != nil {
		return errors.Wrapf(err, "unable to mount sandbox system mount points")
	}

	if err := mountMountPoints(root, config.MountPoints); err != nil {
		return errors.Wrapf(err, "unable to mount sandbox config mount points")
	}

	if err := pivotRoot(root); err != nil {
		return errors.Wrapf(err, "unable to pivot sandbox root")
	}

	if err := os.Mkdir("/tmp", 0755); err != nil {
		return errors.Wrapf(err, "unable to create /tmp")
	}

	if config.WorkingDirectory != "" {
		if err := os.Chdir(config.WorkingDirectory); err != nil {
			return errors.Wrapf(err, "unable to set working directory")
		}
	}

	if err := dropInheritableCapabilities(); err != nil {
		return errors.Wrapf(err, "unable to drop inheritable capabilities")
	}

	if err := enableSeccompFilter(); err != nil {
		return errors.Wrapf(err, "unable to enable seccomp filter")
	}

	return runExecutable(path)
}

func mountMountPoints(root string, mountPoints []*MountPoint) error {
	for _, mountPoint := range mountPoints {
		isDir := true
		if mountPoint.Type == "" {
			stat, err := os.Stat(mountPoint.Source)
			if err != nil {
				if os.IsNotExist(err) {
					continue
				}
				return errors.Wrapf(err, "unable to stat mount point: "+mountPoint.Source)
			}
			isDir = stat.IsDir()
		}

		destination := mountPoint.Destination
		if destination == "" {
			destination = mountPoint.Source
		}
		target := filepath.Join(root, destination)

		if isDir {
			if err := os.MkdirAll(target, 0755); err != nil {
				return errors.Wrapf(err, "unable to create directory: "+target)
			}
		} else {
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return errors.Wrapf(err, "unable to create directory: "+target)
			}
			f, err := os.Create(target)
			if err != nil {
				return errors.Wrapf(err, "unable to create file: "+target)
			}
			f.Close()
		}

		var flags uintptr = syscall.MS_NOSUID | syscall.MS_NODEV
		if mountPoint.Type == "" {
			flags |= syscall.MS_BIND
		}

		if err := syscall.Mount(mountPoint.Source, target, mountPoint.Type, flags, ""); err != nil {
			return errors.Wrapf(err, "unable to mount "+mountPoint.Source)
		}

		if mountPoint.ReadOnly {
			if err := syscall.Mount(mountPoint.Source, target, mountPoint.Type, flags|syscall.MS_RDONLY|syscall.MS_REMOUNT, ""); err != nil {
				return errors.Wrapf(err, "unable to remount "+mountPoint.Source)
			}
		}
	}

	return nil
}

func pivotRoot(newRoot string) error {
	if err := syscall.Mount(newRoot, newRoot, "", syscall.MS_BIND|syscall.MS_REC, ""); err != nil {
		return errors.Wrapf(err, "unable to mount new root")
	}

	prevRoot := filepath.Join(newRoot, ".prev_root")

	if err := os.MkdirAll(prevRoot, 0700); err != nil {
		return errors.Wrapf(err, "unable to create directory for previous root")
	}

	if err := syscall.PivotRoot(newRoot, prevRoot); err != nil {
		return errors.Wrapf(err, "syscall error")
	}

	if err := os.Chdir("/"); err != nil {
		return errors.Wrapf(err, "unable to change directory")
	}

	if err := syscall.Unmount("/.prev_root", syscall.MNT_DETACH); err != nil {
		return errors.Wrapf(err, "unable to unmount previous root")
	}

	if err := os.RemoveAll("/.prev_root"); err != nil {
		return errors.Wrapf(err, "unable to remove previous root directory")
	}

	return nil
}

func dropInheritableCapabilities() error {
	type capHeader struct {
		version uint32
		pid     int
	}

	type capData struct {
		effective   uint32
		permitted   uint32
		inheritable uint32
	}

	var hdr capHeader
	var data [2]capData

	if _, _, errno := syscall.Syscall(syscall.SYS_CAPGET, uintptr(unsafe.Pointer(&hdr)), 0, 0); errno != 0 {
		return errors.Wrapf(syscall.Errno(errno), "unable to get capabilities version")
	}

	if _, _, errno := syscall.Syscall(syscall.SYS_CAPGET, uintptr(unsafe.Pointer(&hdr)), uintptr(unsafe.Pointer(&data[0])), 0); errno != 0 {
		return errors.Wrapf(syscall.Errno(errno), "unable to get capabilities")
	}

	data[0].inheritable = 0
	data[1].inheritable = 0
	if _, _, errno := syscall.Syscall(syscall.SYS_CAPSET, uintptr(unsafe.Pointer(&hdr)), uintptr(unsafe.Pointer(&data[0])), 0); errno != 0 {
		return errors.Wrapf(syscall.Errno(errno), "unable to set inheritable capabilities")
	}

	for i := 0; i < 64; i++ {
		if _, _, errno := syscall.Syscall(syscall.SYS_PRCTL, syscall.PR_CAPBSET_DROP, uintptr(i), 0); errno != 0 && errno != syscall.EINVAL {
			return errors.Wrapf(syscall.Errno(errno), "unable to drop bounding set capability")
		}
	}

	return nil
}

func enableSeccompFilter() error {
	return EnableSeccompFilter(SeccompFilter(NATIVE_AUDIT_ARCH, AllowedSyscalls))
}

func runExecutable(path string) error {
	childFiles := []*os.File{
		os.NewFile(3, ""), os.NewFile(4, ""),
	}
	defer childFiles[0].Close()
	defer childFiles[1].Close()

	cmd := exec.Command(path)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.ExtraFiles = childFiles
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Pdeathsig: syscall.SIGTERM,
	}

	if err := cmd.Run(); err != nil {
		return err
	}

	return nil
}

type process struct {
	command *exec.Cmd
}

func newProcess(ctx context.Context, config *Configuration, path string) (rpcplugin.Process, io.ReadWriteCloser, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, nil, err
	}

	ipc, childFiles, err := rpcplugin.NewIPC()
	if err != nil {
		return nil, nil, err
	}
	defer childFiles[0].Close()
	defer childFiles[1].Close()

	cmd := exec.CommandContext(ctx, "/proc/self/exe")
	cmd.Args = []string{"sandbox.runProcess", string(configJSON), path}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.ExtraFiles = childFiles

	cmd.SysProcAttr = &syscall.SysProcAttr{
		Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID | syscall.CLONE_NEWUSER,
		Pdeathsig:  syscall.SIGTERM,
		GidMappings: []syscall.SysProcIDMap{
			{
				ContainerID: 0,
				HostID:      os.Getgid(),
				Size:        1,
			},
		},
		UidMappings: []syscall.SysProcIDMap{
			{
				ContainerID: 0,
				HostID:      os.Getuid(),
				Size:        1,
			},
		},
	}

	err = cmd.Start()
	if err != nil {
		ipc.Close()
		return nil, nil, err
	}

	return &process{
		command: cmd,
	}, ipc, nil
}

func (p *process) Wait() error {
	return p.command.Wait()
}

func init() {
	if len(os.Args) < 1 || os.Args[0] != "sandbox.checkSupportInNamespace" {
		return
	}

	if err := checkSupportInNamespace(); err != nil {
		fmt.Fprintf(os.Stderr, "%v", err.Error())
		os.Exit(1)
	}

	os.Exit(0)
}

func checkSupportInNamespace() error {
	root, err := ioutil.TempDir("", "")
	if err != nil {
		return err
	}
	defer os.RemoveAll(root)

	if err := mountMountPoints(root, systemMountPoints()); err != nil {
		return errors.Wrapf(err, "unable to mount sandbox system mount points")
	}

	if err := pivotRoot(root); err != nil {
		return errors.Wrapf(err, "unable to pivot sandbox root")
	}

	if err := dropInheritableCapabilities(); err != nil {
		return errors.Wrapf(err, "unable to drop inheritable capabilities")
	}

	if err := enableSeccompFilter(); err != nil {
		return errors.Wrapf(err, "unable to enable seccomp filter")
	}

	return nil
}

func checkSupport() error {
	if AllowedSyscalls == nil {
		return fmt.Errorf("unsupported architecture")
	}

	stderr := &bytes.Buffer{}

	cmd := exec.Command("/proc/self/exe")
	cmd.Args = []string{"sandbox.checkSupportInNamespace"}
	cmd.Stderr = stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID | syscall.CLONE_NEWUSER,
		Pdeathsig:  syscall.SIGTERM,
		GidMappings: []syscall.SysProcIDMap{
			{
				ContainerID: 0,
				HostID:      os.Getgid(),
				Size:        1,
			},
		},
		UidMappings: []syscall.SysProcIDMap{
			{
				ContainerID: 0,
				HostID:      os.Getuid(),
				Size:        1,
			},
		},
	}

	if err := cmd.Start(); err != nil {
		return errors.Wrapf(err, "unable to create user namespace")
	}

	if err := cmd.Wait(); err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			return errors.Wrapf(fmt.Errorf("%v", stderr.String()), "unable to prepare namespace")
		}
		return errors.Wrapf(err, "unable to prepare namespace")
	}

	return nil
}
