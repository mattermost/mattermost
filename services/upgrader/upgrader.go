package upgrader

import (
	"archive/tar"
	"compress/gzip"
	"errors"
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

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

var upgradePercentage int64
var upgradeError error
var upgrading int32

type writeCounter struct {
	total  int64
	readed int64
}

// ErrNotFound indicates that a resource was not found
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

// ErrNotFound indicates that a resource was not found
type InvalidArch struct{}

func NewInvalidArch() *InvalidArch {
	return &InvalidArch{}
}

func (e *InvalidArch) Error() string {
	return fmt.Sprintf("invalid operating system or processor architecture")
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

func canIWriteTheExecutable() error {
	executablePath, err := os.Executable()
	if err != nil {
		return errors.New("error getting the executable path")
	}
	fmt.Println(executablePath)
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

	filename, err := download(getCurrentVersionTgzUrl())
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

func download(url string) (string, error) {
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
	_, err = io.Copy(out, io.TeeReader(resp.Body, counter))
	return out.Name(), err
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
			os.Rename(executablePath, executablePath+".bak")
			outFile, err := os.Create(executablePath)
			if err != nil {
				os.Rename(executablePath+".bak", executablePath)
				return err
			}
			defer outFile.Close()
			if _, err := io.Copy(outFile, tarReader); err != nil {
				os.Remove(executablePath)
				os.Rename(executablePath+".bak", executablePath)
				return err
			}
			os.Remove(executablePath + ".bak")
			os.Chmod(executablePath, 0755)
			break
		}
	}
	return nil
}
