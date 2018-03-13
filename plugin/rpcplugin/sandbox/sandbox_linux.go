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
	"golang.org/x/sys/unix"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

func init() {
	if len(os.Args) < 4 || os.Args[0] != "sandbox.runProcess" {
		return
	}

	var config Configuration
	if err := json.Unmarshal([]byte(os.Args[1]), &config); err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	if err := runProcess(&config, os.Args[2], os.Args[3]); err != nil {
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
		Source:      "/dev/null",
		Destination: "/dev/null",
	}, &MountPoint{
		Source:      "/dev/zero",
		Destination: "/dev/zero",
	}, &MountPoint{
		Source:      "/dev/full",
		Destination: "/dev/full",
	})

	readOnly := []string{
		"/dev/random",
		"/dev/urandom",
		"/etc/resolv.conf",
		"/lib",
		"/lib32",
		"/lib64",
		"/usr/lib",
		"/usr/lib32",
		"/usr/lib64",
		"/etc/ca-certificates",
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
			Source:      point,
			Destination: point,
			ReadOnly:    true,
		})
	}

	return
}

func runProcess(config *Configuration, path, root string) error {
	if err := syscall.Mount("", "/", "", syscall.MS_PRIVATE|syscall.MS_REC, ""); err != nil {
		return errors.Wrapf(err, "unable to make root private")
	}

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

func mountMountPoint(root string, mountPoint *MountPoint) error {
	isDir := true
	if mountPoint.Type == "" {
		stat, err := os.Lstat(mountPoint.Source)
		if err != nil {
			return nil
		}
		if (stat.Mode() & os.ModeSymlink) != 0 {
			if path, err := filepath.EvalSymlinks(mountPoint.Source); err == nil {
				newMountPoint := *mountPoint
				newMountPoint.Source = path
				if err := mountMountPoint(root, &newMountPoint); err != nil {
					return errors.Wrapf(err, "unable to mount symbolic link target: "+mountPoint.Source)
				}
				return nil
			}
		}
		isDir = stat.IsDir()
	}

	target := filepath.Join(root, mountPoint.Destination)

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

	flags := uintptr(syscall.MS_NOSUID | syscall.MS_NODEV)
	if mountPoint.Type == "" {
		flags |= syscall.MS_BIND
	}
	if mountPoint.ReadOnly {
		flags |= syscall.MS_RDONLY
	}

	if err := syscall.Mount(mountPoint.Source, target, mountPoint.Type, flags, ""); err != nil {
		return errors.Wrapf(err, "unable to mount "+mountPoint.Source)
	}

	if (flags & syscall.MS_BIND) != 0 {
		// If this was a bind mount, our other flags actually got silently ignored during the above syscall:
		//
		//     If mountflags includes MS_BIND [...] The remaining bits in the mountflags argument are
		//     also ignored, with the exception of MS_REC.
		//
		// Furthermore, remounting will fail if we attempt to unset a bit that was inherited from
		// the mount's parent:
		//
		//     The mount(2) flags MS_RDONLY, MS_NOSUID, MS_NOEXEC, and the "atime" flags
		//     (MS_NOATIME, MS_NODIRATIME, MS_RELATIME) settings become locked when propagated from
		//     a more privileged to a less privileged mount namespace, and may not be changed in the
		//     less privileged mount namespace.
		//
		// So we need to get the actual flags, add our new ones, then do a remount if needed.
		var stats syscall.Statfs_t
		if err := syscall.Statfs(target, &stats); err != nil {
			return errors.Wrap(err, "unable to get mount flags for target: "+target)
		}
		const lockedFlagsMask = unix.MS_RDONLY | unix.MS_NOSUID | unix.MS_NOEXEC | unix.MS_NOATIME | unix.MS_NODIRATIME | unix.MS_RELATIME
		lockedFlags := uintptr(stats.Flags & lockedFlagsMask)
		if lockedFlags != ((flags | lockedFlags) & lockedFlagsMask) {
			if err := syscall.Mount("", target, "", flags|lockedFlags|syscall.MS_REMOUNT, ""); err != nil {
				return errors.Wrapf(err, "unable to remount "+mountPoint.Source)
			}
		}
	}

	return nil
}

func mountMountPoints(root string, mountPoints []*MountPoint) error {
	for _, mountPoint := range mountPoints {
		if err := mountMountPoint(root, mountPoint); err != nil {
			return err
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

	prevRoot = "/.prev_root"

	if err := syscall.Unmount(prevRoot, syscall.MNT_DETACH); err != nil {
		return errors.Wrapf(err, "unable to unmount previous root")
	}

	if err := os.RemoveAll(prevRoot); err != nil {
		return errors.Wrapf(err, "unable to remove previous root directory")
	}

	return nil
}

func dropInheritableCapabilities() error {
	type capHeader struct {
		version uint32
		pid     int32
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
	root    string
}

func newProcess(ctx context.Context, config *Configuration, path string) (pOut rpcplugin.Process, rwcOut io.ReadWriteCloser, errOut error) {
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

	root, err := ioutil.TempDir("", "")
	if err != nil {
		return nil, nil, err
	}
	defer func() {
		if errOut != nil {
			os.RemoveAll(root)
		}
	}()

	cmd := exec.CommandContext(ctx, "/proc/self/exe")
	cmd.Args = []string{"sandbox.runProcess", string(configJSON), path, root}
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
		root:    root,
	}, ipc, nil
}

func (p *process) Wait() error {
	defer os.RemoveAll(p.root)
	return p.command.Wait()
}

func init() {
	if len(os.Args) < 2 || os.Args[0] != "sandbox.checkSupportInNamespace" {
		return
	}

	if err := checkSupportInNamespace(os.Args[1]); err != nil {
		fmt.Fprintf(os.Stderr, "%v", err.Error())
		os.Exit(1)
	}

	os.Exit(0)
}

func checkSupportInNamespace(root string) error {
	if err := syscall.Mount("", "/", "", syscall.MS_PRIVATE|syscall.MS_REC, ""); err != nil {
		return errors.Wrapf(err, "unable to make root private")
	}

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

	if f, err := os.Create(os.DevNull); err != nil {
		return errors.Wrapf(err, "unable to open os.DevNull")
	} else {
		defer f.Close()
		if _, err = f.Write([]byte("foo")); err != nil {
			return errors.Wrapf(err, "unable to write to os.DevNull")
		}
	}

	return nil
}

func checkSupport() error {
	if AllowedSyscalls == nil {
		return fmt.Errorf("unsupported architecture")
	}

	stderr := &bytes.Buffer{}

	root, err := ioutil.TempDir("", "")
	if err != nil {
		return err
	}
	defer os.RemoveAll(root)

	cmd := exec.Command("/proc/self/exe")
	cmd.Args = []string{"sandbox.checkSupportInNamespace", root}
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
