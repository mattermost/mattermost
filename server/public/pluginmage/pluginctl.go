package pluginmage

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"time"

	"github.com/magefile/mage/mg"
	"github.com/mattermost/mattermost/server/public/model"
)

type Pluginctl mg.Namespace

const commandTimeout = 120 * time.Second

// Deploy uploads and enables a plugin via the Client4 API
func (Pluginctl) Deploy() error {
	bundleName := fmt.Sprintf("%s-%s.tar.gz", info.Manifest.Id, info.Manifest.Version)
	bundlePath := filepath.Join("dist", bundleName)

	// Check if the bundle exists and is accessible
	fileInfo, err := os.Stat(bundlePath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("plugin bundle not found at %s - did you run 'make dist' first?", bundlePath)
		}
		return fmt.Errorf("failed to access plugin bundle at %s: %w", bundlePath, err)
	}

	// Validate the file size
	if fileInfo.Size() == 0 {
		return fmt.Errorf("plugin bundle at %s is empty", bundlePath)
	}

	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()

	client, err := getClient(ctx)
	if err != nil {
		return err
	}

	pluginBundle, err := os.Open(bundlePath)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", bundlePath, err)
	}
	defer pluginBundle.Close()

	Logger.Info("Uploading plugin via API")
	_, _, err = client.UploadPluginForced(ctx, pluginBundle)
	if err != nil {
		return fmt.Errorf("failed to upload plugin bundle: %w", err)
	}

	Logger.Info("Enabling plugin")
	_, err = client.EnablePlugin(ctx, info.Manifest.Id)
	if err != nil {
		return fmt.Errorf("failed to enable plugin: %w", err)
	}

	return nil
}

// Disable disables a plugin via the Client4 API
func (Pluginctl) Disable() error {
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()

	client, err := getClient(ctx)
	if err != nil {
		return err
	}

	Logger.Info("Disabling plugin")
	_, err = client.DisablePlugin(ctx, info.Manifest.Id)
	if err != nil {
		return fmt.Errorf("failed to disable plugin: %w", err)
	}

	return nil
}

// Enable enables a plugin via the Client4 API
func (Pluginctl) Enable() error {
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()

	client, err := getClient(ctx)
	if err != nil {
		return err
	}

	Logger.Info("Enabling plugin")
	_, err = client.EnablePlugin(ctx, info.Manifest.Id)
	if err != nil {
		return fmt.Errorf("failed to enable plugin: %w", err)
	}

	return nil
}

// Reset disables and re-enables a plugin via the Client4 API
func (Pluginctl) Reset() error {
	mg.SerialDeps(Pluginctl.Disable, Pluginctl.Enable)
	return nil
}

// getClient returns a Client4 instance configured for local or remote connection
func getClient(ctx context.Context) (*model.Client4, error) {
	socketPath := os.Getenv("MM_LOCALSOCKETPATH")
	if socketPath == "" {
		socketPath = model.LocalModeSocketPath
	}

	client, connected := getUnixClient(socketPath)
	if connected {
		Logger.Info("Connecting using local mode", "socket", socketPath)
		return client, nil
	}

	if os.Getenv("MM_LOCALSOCKETPATH") != "" {
		Logger.Info("No socket found for local mode deployment, attempting to authenticate with credentials", "socket", socketPath)
	}

	siteURL := os.Getenv("MM_SERVICESETTINGS_SITEURL")
	adminToken := os.Getenv("MM_ADMIN_TOKEN")
	adminUsername := os.Getenv("MM_ADMIN_USERNAME")
	adminPassword := os.Getenv("MM_ADMIN_PASSWORD")

	if siteURL == "" {
		return nil, errors.New("MM_SERVICESETTINGS_SITEURL is not set")
	}

	client = model.NewAPIv4Client(siteURL)

	if adminToken != "" {
		Logger.Info("Authenticating using token", "url", siteURL)
		client.SetToken(adminToken)
		return client, nil
	}

	if adminUsername != "" && adminPassword != "" {
		client := model.NewAPIv4Client(siteURL)
		Logger.Info("Authenticating with credentials", "username", adminUsername, "url", siteURL)
		_, _, err := client.Login(ctx, adminUsername, adminPassword)
		if err != nil {
			return nil, fmt.Errorf("failed to login as %s: %w", adminUsername, err)
		}

		return client, nil
	}

	return nil, errors.New("one of MM_ADMIN_TOKEN or MM_ADMIN_USERNAME/MM_ADMIN_PASSWORD must be defined")
}

func getUnixClient(socketPath string) (*model.Client4, bool) {
	_, err := net.Dial("unix", socketPath)
	if err != nil {
		return nil, false
	}

	return model.NewAPIv4SocketClient(socketPath), true
}
