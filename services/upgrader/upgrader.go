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
	"runtime"
	"sync/atomic"

	"github.com/mattermost/mattermost-server/v5/model"
)

var upgradePercentage int64
var upgradeError error
var upgrading int32

type writeCounter struct {
	total  int64
	readed int64
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

func canIUpgrade() error {
	if runtime.GOARCH != "amd64" {
		return errors.New("Upgrades only supported for amd64 architectures.")
	}
	if runtime.GOOS != "linux" {
		return errors.New("Upgrades only supported for linux operating systems.")
	}
	return nil
}

func canIUpgradeToE0() error {
	if err := canIUpgrade(); err != nil {
		return err
	}
	if model.BuildEnterpriseReady == "true" {
		return errors.New("You can't upgrade your code to enterprise because you are already in enterprise code")
	}
	return nil
}

func UpgradeToE0() error {
	if err := canIUpgradeToE0(); err != nil {
		return err
	}

	if !atomic.CompareAndSwapInt32(&upgrading, 0, 1) {
		return errors.New("One upgrade is already running.")
	}
	defer atomic.CompareAndSwapInt32(&upgrading, 1, 0)

	upgradePercentage = 1
	upgradeError = nil

	executablePath, err := os.Executable()
	if err != nil {
		upgradePercentage = 0
		upgradeError = errors.New("error getting the executable path")
		return err
	}

	filename, err := download(getCurrentVersionTgzUrl())
	if err != nil {
		if filename != "" {
			os.Remove(filename)
		}
		upgradeError = fmt.Errorf("error downloading the new version (percentage: %d)", upgradePercentage)
		upgradePercentage = 0
		return err
	}
	defer os.Remove(filename)

	err = extractBinary(executablePath, filename)
	if err != nil {
		upgradePercentage = 0
		upgradeError = err
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
