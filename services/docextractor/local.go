package docextractor

import (
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"

	"github.com/mattermost/mattermost-server/v6/model"
)

type LocalExtractorService struct {
	nes NetworkExtractorService
}

func getFreePort() (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func NewLocalExtractorService(recursive bool) (*LocalExtractorService, error) {
	port, err := getFreePort()
	if err != nil {
		return nil, err
	}

	networkService := NetworkExtractorService{
		Host: "http://127.0.0.1",
		Port: port,
		Key:  model.NewId(),
	}

	executable, err := os.Executable()
	if err != nil {
		return nil, err
	}

	recursiveFlag := ""
	if recursive {
		recursiveFlag = "--recursive"
	}

	go func() {
		_, _ = exec.Command(executable, "docextractor", "--host", "127.0.0.1", "--port", fmt.Sprintf("%d", port), "--key", networkService.Key, recursiveFlag).Output()
	}()

	return &LocalExtractorService{
		nes: networkService,
	}, nil
}

func (les LocalExtractorService) Extract(filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	return les.nes.Extract(filename, r, settings)
}
