package upgrader

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"sync/atomic"
	"syscall"

	"github.com/pkg/errors"
	"golang.org/x/crypto/openpgp"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const mattermostBuildPublicKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBFjZQxwBCAC6kNn3zDlq/aY83M9V7MHVPoK2jnZ3BfH7sA+ibQXsijCkPSR4
5bCUJ9qVA4XKGK+cpO9vkolSNs10igCaaemaUZNB6ksu3gT737/SZcCAfRO+cLX7
Q2la+jwTvu1YeT/M5xDZ1KHTFxsGskeIenz2rZHeuZwBl9qep34QszWtRX40eRts
fl6WltLrepiExTp6NMZ50k+Em4JGM6CWBMo22ucy0jYjZXO5hEGb3o6NGiG+Dx2z
b2J78LksCKGsSrn0F1rLJeA933bFL4g9ozv9asBlzmpgG77ESg6YE1N/Rh7WDzVA
prIR0MuB5JjElASw5LDVxDV6RZsxEVQr7ETLABEBAAG0KU1hdHRlcm1vc3QgQnVp
bGQgPGRldi1vcHNAbWF0dGVybW9zdC5jb20+iQFUBBMBCAA+AhsDBQsJCAcCBhUI
CQoLAgQWAgMBAh4BAheAFiEEobMdRvDzoQsCzy1E+PLDF0R3SygFAl6HYr0FCQlw
hqEACgkQ+PLDF0R3SyheNQgAnkiT2vFMCtU5FmC16HVYXzDpYMtdCQPh/gmeEkiI
80rFRg/cn6f0BNnaTfDu6r6cepmhLNpDAowjQ7uBnv8fL2dzCydIGFv2r7FfmcOJ
zhEQ3zXPwP6mYlxPCCgxAozsLv9Yv41KGCHIlzYwkAazc0BhpAW/h8L3VGkE+b+g
x6lKVoufm4rKnT49Dgly6fVOxuR/BqZo87B5jksV3izLTHt5hiY8Pc5GW8WwO/tr
pNAw+6HRXq1Dr/JRz5PIOr5KP5tVLBed4IteZ1xaTRd4++07ZbiZjhXY8WKpVp3y
iN7Om24jQpxbJI9+KKJ3+yhcwhr8/PJ8ZVuhJo3BNv1PcQ==
=9Qk8
-----END PGP PUBLIC KEY BLOCK-----`

var upgradePercentage int64
var upgradeError error
var upgrading int32

type writeCounter struct {
	total  int64
	readed int64
}

// InvalidPermissions indicates that the file permissions doesn't allow to upgrade
type InvalidPermissions struct {
	ErrType            string
	Path               string
	FileUsername       string
	MattermostUsername string
}

func NewInvalidPermissions(errType string, path string, mattermostUsername string, fileUsername string) *InvalidPermissions {
	return &InvalidPermissions{
		ErrType:            errType,
		Path:               path,
		FileUsername:       fileUsername,
		MattermostUsername: mattermostUsername,
	}
}

func (e *InvalidPermissions) Error() string {
	return fmt.Sprintf("the user %s is unable to update the %s file", e.MattermostUsername, e.Path)
}

// InvalidArch indicates that the current operating system or cpu architecture doesn't support upgrades
type InvalidArch struct{}

func NewInvalidArch() *InvalidArch {
	return &InvalidArch{}
}

func (e *InvalidArch) Error() string {
	return fmt.Sprintf("invalid operating system or processor architecture")
}

// InvalidArch indicates that the current operating system or cpu architecture doesn't support upgrades
type InvalidSignature struct{}

func NewInvalidSignature() *InvalidSignature {
	return &InvalidSignature{}
}

func (e *InvalidSignature) Error() string {
	return fmt.Sprintf("invalid file signature")
}

func (wc *writeCounter) Write(p []byte) (int, error) {
	n := len(p)
	wc.readed += int64(n)
	percentage := (wc.readed * 100) / wc.total
	if percentage == 0 {
		upgradePercentage = 1
	} else if percentage == 100 {
		upgradePercentage = 99
	} else {
		upgradePercentage = percentage
	}
	return n, nil
}

func getCurrentVersionTgzUrl() string {
	return "https://releases.mattermost.com/" + model.CurrentVersion + "/mattermost-" + model.CurrentVersion + "-linux-amd64.tar.gz"
}

func verifySignature(filename string, sigfilename string, publicKey string) error {
	keyring, err := openpgp.ReadArmoredKeyRing(bytes.NewReader([]byte(publicKey)))
	if err != nil {
		mlog.Error("Unable to load the public key to verify the file signature", mlog.Err(err))
		return NewInvalidSignature()
	}

	mattermost_tar, err := os.Open(filename)
	if err != nil {
		mlog.Error("Unable to open the mattermost tar file verify the file signature", mlog.Err(err))
		return NewInvalidSignature()
	}

	signature, err := os.Open(sigfilename)
	if err != nil {
		mlog.Error("Unable to open the mattermost sig file verify the file signature", mlog.Err(err))
		return NewInvalidSignature()
	}

	_, err = openpgp.CheckDetachedSignature(keyring, mattermost_tar, signature)
	if err != nil {
		mlog.Error("Unable to verify the mattermost file signature", mlog.Err(err))
		return NewInvalidSignature()
	}
	return nil
}

func canIWriteTheExecutable() error {
	executablePath, err := os.Executable()
	if err != nil {
		return errors.New("error getting the executable path")
	}
	executableInfo, err := os.Stat(executablePath)
	if err != nil {
		return errors.New("error getting the executable info")
	}
	stat, ok := executableInfo.Sys().(*syscall.Stat_t)
	if !ok {
		return errors.New("error getting the executable info")
	}
	fileUID := int(stat.Uid)
	fileUser, err := user.LookupId(strconv.Itoa(fileUID))
	if err != nil {
		return errors.New("error getting the executable info")
	}

	mattermostUID := os.Getuid()
	mattermostUser, err := user.LookupId(strconv.Itoa(mattermostUID))
	if err != nil {
		return errors.New("error getting the executable info")
	}

	mode := executableInfo.Mode()
	if fileUID != mattermostUID && mode&(1<<1) == 0 && mode&(1<<7) == 0 {
		return NewInvalidPermissions("invalid-user-and-permission", executablePath, mattermostUser.Username, fileUser.Username)
	}

	if fileUID != mattermostUID && mode&(1<<1) == 0 && mode&(1<<7) != 0 {
		return NewInvalidPermissions("invalid-user", executablePath, mattermostUser.Username, fileUser.Username)
	}

	if fileUID == mattermostUID && mode&(1<<7) == 0 {
		return NewInvalidPermissions("invalid-permission", executablePath, mattermostUser.Username, fileUser.Username)
	}
	return nil
}

func canIUpgrade() error {
	if runtime.GOARCH != "amd64" {
		return NewInvalidArch()
	}
	if runtime.GOOS != "linux" {
		return NewInvalidArch()
	}
	return canIWriteTheExecutable()
}

func CanIUpgradeToE0() error {
	if err := canIUpgrade(); err != nil {
		mlog.Error("Unable to upgrade from TE to E0", mlog.Err(err))
		return err
	}
	if model.BuildEnterpriseReady == "true" {
		mlog.Warn("Unable to upgrade from TE to E0 because the server is already in E0")
		return errors.New("You can't upgrade your code to enterprise because you are already in enterprise code")
	}
	return nil
}

func UpgradeToE0() error {
	if !atomic.CompareAndSwapInt32(&upgrading, 0, 1) {
		mlog.Warn("Trying to upgrade while other upgrade is running")
		return errors.New("One upgrade is already running.")
	}
	defer atomic.CompareAndSwapInt32(&upgrading, 1, 0)

	upgradePercentage = 1
	upgradeError = nil

	executablePath, err := os.Executable()
	if err != nil {
		upgradePercentage = 0
		upgradeError = errors.New("error getting the executable path")
		mlog.Error("Unable to get the mattermost executable path", mlog.Err(err))
		return err
	}

	filename, err := download(getCurrentVersionTgzUrl(), 1024*1024*300)
	if err != nil {
		if filename != "" {
			os.Remove(filename)
		}
		upgradeError = fmt.Errorf("error downloading the new version (percentage: %d)", upgradePercentage)
		mlog.Error("Unable to download the mattermost server version", mlog.Int64("percentage", upgradePercentage), mlog.String("url", getCurrentVersionTgzUrl()), mlog.Err(err))
		upgradePercentage = 0
		return err
	}
	defer os.Remove(filename)
	sigfilename, err := download(getCurrentVersionTgzUrl()+".sig", 1024)
	if err != nil {
		if sigfilename != "" {
			os.Remove(sigfilename)
		}
		upgradeError = errors.New("error downloading the new version signature file")
		mlog.Error("Unable to download the mattermost server version signature file", mlog.String("url", getCurrentVersionTgzUrl()+".sig"), mlog.Err(err))
		upgradePercentage = 0
		return err
	}
	defer os.Remove(sigfilename)

	err = verifySignature(filename, sigfilename, mattermostBuildPublicKey)
	if err != nil {
		upgradePercentage = 0
		upgradeError = errors.New("Unable to verify downloaded file signature")
		mlog.Error("Unable to verify downloaded file signature", mlog.Err(err))
		return err
	}

	err = extractBinary(executablePath, filename)
	if err != nil {
		upgradePercentage = 0
		upgradeError = err
		mlog.Error("Unable to extract the binary from the downloaded file", mlog.Err(err))
		return err
	}
	upgradePercentage = 100
	return nil
}

func UpgradeToE0Status() (int64, error) {
	return upgradePercentage, upgradeError
}

func download(url string, limit int64) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	out, err := ioutil.TempFile("", "*_mattermost.tar.gz")
	if err != nil {
		return "", err
	}
	defer out.Close()

	counter := &writeCounter{total: resp.ContentLength}
	_, err = io.Copy(out, io.TeeReader(&io.LimitedReader{R: resp.Body, N: limit}, counter))
	return out.Name(), err
}

func getFilePermissionsOrDefault(filename string, def os.FileMode) os.FileMode {
	file, err := os.Open(filename)
	if err != nil {
		mlog.Error("Unable to get the file permissions", mlog.String("filename", filename), mlog.Err(err))
		return def
	}
	fileStats, err := file.Stat()
	if err != nil {
		mlog.Error("Unable to get the file permissions", mlog.String("filename", filename), mlog.Err(err))
		return def
	}
	return fileStats.Mode()
}

func extractBinary(executablePath string, filename string) error {
	gzipStream, err := os.Open(filename)
	if err != nil {
		return err
	}

	uncompressedStream, err := gzip.NewReader(gzipStream)
	if err != nil {
		return err
	}

	tarReader := tar.NewReader(uncompressedStream)

	for {
		header, err := tarReader.Next()

		if err == io.EOF {
			return errors.New("Unable to find mattermost binary in the downloaded version")
		}

		if err != nil {
			return err
		}

		if header.Typeflag == tar.TypeReg && header.Name == "mattermost/bin/mattermost" {
			permissions := getFilePermissionsOrDefault(executablePath, 0755)
			tmpFile, err := ioutil.TempFile("", "*")
			if err != nil {
				return err
			}
			tmpFileName := tmpFile.Name()
			os.Remove(tmpFileName)
			err = os.Rename(executablePath, tmpFileName)
			if err != nil {
				return err
			}
			outFile, err := os.Create(executablePath)
			if err != nil {
				err2 := os.Rename(tmpFileName, executablePath)
				if err != nil {
					mlog.Critical("Unable to restore the executable backup. Restore the executable manually.")
					return errors.Wrap(err2, "critical error: unable to upgrade the binary or restore the old binary version. Please restore it manually")
				}
				return err
			}
			defer outFile.Close()
			if _, err = io.Copy(outFile, tarReader); err != nil {
				err2 := os.Remove(executablePath)
				if err2 != nil {
					mlog.Critical("Unable to restore the executable backup. Restore the executable manually.")
					return errors.Wrap(err2, "critical error: unable to upgrade the binary or restore the old binary version. Please restore it manually")
				}

				err2 = os.Rename(tmpFileName, executablePath)
				if err2 != nil {
					mlog.Critical("Unable to restore the executable backup. Restore the executable manually.")
					return errors.Wrap(err2, "critical error: unable to upgrade the binary or restore the old binary version. Please restore it manually")
				}
				return err
			}
			err = os.Remove(tmpFileName)
			if err != nil {
				mlog.Warn("Unable to unable to clean up the binary backup file.", mlog.Err(err))
			}
			err = os.Chmod(executablePath, permissions)
			if err != nil {
				mlog.Warn("Unable to unable to set the right permissions to the file.", mlog.Err(err))
			}
			break
		}
	}
	return nil
}
