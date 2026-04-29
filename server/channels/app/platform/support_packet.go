// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime"
	rpprof "runtime/pprof"
	"strings"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

const (
	envVarInstallType = "MM_INSTALL_TYPE"
	unknownDataPoint  = "unknown"
)

func (ps *PlatformService) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) ([]model.FileData, error) {
	functions := map[string]func(request.CTX) (*model.FileData, error){
		"diagnostics":  ps.getSupportPacketDiagnostics,
		"config":       ps.getSanitizedConfigFile,
		"cpu profile":  ps.getCPUProfile,
		"heap profile": ps.getHeapProfile,
		"goroutines":   ps.getGoroutineProfile,
	}

	if options != nil && options.IncludeLogs {
		functions["mattermost log"] = ps.GetLogFile
	}

	var (
		fileDatas []model.FileData
		rErr      *multierror.Error
	)

	for name, fn := range functions {
		fileData, err := fn(rctx)
		if err != nil {
			rctx.Logger().Error("Failed to generate file for Support Packet",
				mlog.String("file", name),
				mlog.Err(err),
			)
			rErr = multierror.Append(rErr, err)
		}

		if fileData != nil {
			fileDatas = append(fileDatas, *fileData)
		}
	}

	if options != nil && options.IncludeLogs {
		advancedLogs, err := ps.GetAdvancedLogs(rctx)
		if err != nil {
			rctx.Logger().Error("Failed to read advanced log files for Support Packet", mlog.Err(err))
			rErr = multierror.Append(rErr, err)
		}

		for _, log := range advancedLogs {
			fileDatas = append(fileDatas, *log)
		}
	}

	return fileDatas, rErr.ErrorOrNil()
}

func (ps *PlatformService) getSupportPacketDiagnostics(rctx request.CTX) (*model.FileData, error) {
	var (
		rErr *multierror.Error
		err  error
		d    model.SupportPacketDiagnostics
	)

	d.Version = model.CurrentSupportPacketVersion

	/* License */
	if license := ps.License(); license != nil {
		d.License.Company = license.Customer.Company
		d.License.Users = model.SafeDereference(license.Features.Users)
		d.License.SkuShortName = license.SkuShortName
		d.License.IsTrial = license.IsTrial
		d.License.IsGovSKU = license.IsGovSku
	}

	/* Server */
	d.Server.OS = runtime.GOOS
	d.Server.Architecture = runtime.GOARCH
	// Note: These values represent the host machine's resources, not any
	// container limits (e.g., Docker or Kubernetes) that may be in effect.
	d.Server.CPUCores = runtime.NumCPU()
	totalMemoryBytes, err := getTotalMemory()
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting total memory"))
	}
	d.Server.TotalMemoryMB = totalMemoryBytes / 1024 / 1024
	containerLimits, err := getContainerLimits()
	if err != nil {
		rctx.Logger().Debug("Failed to get container limits for Support Packet", mlog.Err(err))
	} else {
		d.Server.ContainerCPULimit = containerLimits.CPULimit
		d.Server.ContainerMemoryLimitMB = containerLimits.MemoryLimitMB
	}
	d.Server.Hostname, err = os.Hostname()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting hostname"))
	}
	d.Server.ProcessID = os.Getpid()
	d.Server.StartedAt = ps.startTime.UTC()
	if hostUptimeSeconds, hostUptimeErr := getHostUptimeSeconds(); hostUptimeErr == nil {
		d.Server.HostStartedAt = time.Now().Add(-time.Duration(hostUptimeSeconds) * time.Second).UTC()
	}
	d.Server.Version = model.CurrentVersion
	d.Server.BuildHash = model.BuildHash
	d.Server.GoVersion = runtime.Version()
	installationType := ps.installTypeOverride
	if installationType == "" {
		installationType = os.Getenv(envVarInstallType)
	}
	if installationType == "" {
		installationType = unknownDataPoint
	}
	d.Server.InstallationType = installationType
	d.Server.OpenFileDescriptors, err = getOpenFileDescriptors()
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting open file descriptor count"))
	}
	d.Server.MaxFileDescriptors, err = getMaxFileDescriptors()
	if err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "error while getting max file descriptor limit"))
	}

	/* Config */
	d.Config.Source = ps.DescribeConfig()

	/* DB */
	d.Database.Type, d.Database.SchemaVersion, err = ps.DatabaseTypeAndSchemaVersion()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting DB type and schema version"))
	}

	databaseVersion, err := ps.Store.GetDbVersion(false)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting DB version"))
	} else {
		d.Database.Version = databaseVersion
	}
	d.Database.MasterConnectios = ps.Store.TotalMasterDbConnections()
	d.Database.ReplicaConnectios = ps.Store.TotalReadDbConnections()
	d.Database.SearchConnections = ps.Store.TotalSearchDbConnections()

	/* File store */
	d.FileStore.Status = model.StatusOk
	err = ps.FileBackend().TestConnection()
	if err != nil {
		d.FileStore.Status = model.StatusFail
		d.FileStore.Error = err.Error()
	}
	d.FileStore.Driver = ps.FileBackend().DriverName()
	if d.FileStore.Driver == model.ImageDriverLocal {
		dir := model.SafeDereference(ps.Config().FileSettings.Directory)
		if dir == "" {
			dir = model.FileSettingsDefaultDirectory
		}
		di, diskErr := getDiskInfo(dir)
		if diskErr != nil {
			rErr = multierror.Append(errors.Wrap(diskErr, "error while getting disk space info"))
		} else {
			d.FileStore.FilesystemType = di.FilesystemType
			d.FileStore.TotalMB = di.TotalMB
			d.FileStore.AvailableMB = di.AvailableMB
		}
	}

	/* Websockets */
	d.Websocket.Connections = ps.TotalWebsocketConnections()

	/* Cluster */
	if cluster := ps.Cluster(); cluster != nil {
		d.Cluster.ID = cluster.GetClusterId()
		clusterInfo, e := cluster.GetClusterInfos()
		if e != nil {
			rErr = multierror.Append(rErr, errors.Wrap(e, "error while getting cluster infos"))
		} else {
			d.Cluster.NumberOfNodes = max(len(clusterInfo), 1) // clusterInfo is empty if the node is the only one in the cluster
		}
	}

	/* LDAP */
	if ldap := ps.LdapDiagnostic(); ldap != nil && (*ps.Config().LdapSettings.Enable || *ps.Config().LdapSettings.EnableSync) {
		d.LDAP.Status = model.StatusOk
		appErr := ldap.RunTest(rctx)
		if appErr != nil {
			d.LDAP.Status = model.StatusFail
			d.LDAP.Error = appErr.Error()
		}

		severName, serverVersion := unknownDataPoint, unknownDataPoint
		// Only if the LDAP test was successful, try to get the LDAP server info
		if d.LDAP.Status == model.StatusOk {
			severName, serverVersion, err = ldap.GetVendorNameAndVendorVersion(rctx)
			if err != nil {
				rErr = multierror.Append(errors.Wrap(err, "error while getting LDAP vendor info"))
			}

			if severName == "" {
				severName = unknownDataPoint
			}
			if serverVersion == "" {
				serverVersion = unknownDataPoint
			}
		}
		d.LDAP.ServerName = severName
		d.LDAP.ServerVersion = serverVersion
	} else {
		d.LDAP.Status = model.StatusDisabled
	}

	/* SAML */
	if idpDescriptorURL := model.SafeDereference(ps.Config().SamlSettings.IdpDescriptorURL); idpDescriptorURL != "" {
		d.SAML.ProviderType = detectSAMLProviderType(idpDescriptorURL)
	}

	/* Elastic Search */
	if se := ps.SearchEngine.ElasticsearchEngine; se != nil {
		d.ElasticSearch.Backend = *ps.Config().ElasticsearchSettings.Backend
		d.ElasticSearch.ServerVersion = se.GetFullVersion()
		d.ElasticSearch.ServerPlugins = se.GetPlugins()
		if *ps.Config().ElasticsearchSettings.EnableIndexing {
			appErr := se.TestConfig(rctx, ps.Config())
			if appErr != nil {
				d.ElasticSearch.Status = model.StatusFail
				d.ElasticSearch.Error = appErr.Error()
			} else {
				d.ElasticSearch.Status = model.StatusOk
			}
		} else {
			d.ElasticSearch.Status = model.StatusDisabled
		}
	} else {
		d.ElasticSearch.Status = model.StatusDisabled
	}

	/* Email Notifications */
	if model.SafeDereference(ps.Config().EmailSettings.SendEmailNotifications) {
		emailSettings := ps.Config().EmailSettings
		hostname := utils.GetHostnameFromSiteURL(model.SafeDereference(ps.Config().ServiceSettings.SiteURL))
		mailCfg := &mail.SMTPConfig{
			Hostname:                          hostname,
			ConnectionSecurity:                model.SafeDereference(emailSettings.ConnectionSecurity),
			SkipServerCertificateVerification: model.SafeDereference(emailSettings.SkipServerCertificateVerification),
			ServerName:                        model.SafeDereference(emailSettings.SMTPServer),
			Server:                            model.SafeDereference(emailSettings.SMTPServer),
			Port:                              model.SafeDereference(emailSettings.SMTPPort),
			ServerTimeout:                     model.SafeDereference(emailSettings.SMTPServerTimeout),
			Username:                          model.SafeDereference(emailSettings.SMTPUsername),
			Password:                          model.SafeDereference(emailSettings.SMTPPassword),
			EnableSMTPAuth:                    model.SafeDereference(emailSettings.EnableSMTPAuth),
			SendEmailNotifications:            true,
			FeedbackName:                      model.SafeDereference(emailSettings.FeedbackName),
			FeedbackEmail:                     model.SafeDereference(emailSettings.FeedbackEmail),
			ReplyToAddress:                    model.SafeDereference(emailSettings.ReplyToAddress),
		}
		if smtpErr := mail.TestConnection(mailCfg); smtpErr != nil {
			d.Notifications.Email.Status = model.StatusFail
			d.Notifications.Email.Error = smtpErr.Error()
		} else {
			d.Notifications.Email.Status = model.StatusOk
		}
	} else {
		d.Notifications.Email.Status = model.StatusDisabled
	}

	/* Push Notifications */
	if model.SafeDereference(ps.Config().EmailSettings.SendPushNotifications) {
		pushServerURL := model.SafeDereference(ps.Config().EmailSettings.PushNotificationServer)
		if pushErr := testPushProxyConnection(rctx.Context(), pushServerURL); pushErr != nil {
			d.Notifications.Push.Status = model.StatusFail
			d.Notifications.Push.Error = pushErr.Error()
		} else {
			d.Notifications.Push.Status = model.StatusOk
		}
	} else {
		d.Notifications.Push.Status = model.StatusDisabled
	}

	b, err := yaml.Marshal(&d)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal Support Packet into yaml"))
	}

	fileData := &model.FileData{
		Filename: "diagnostics.yaml",
		Body:     b,
	}
	return fileData, rErr.ErrorOrNil()
}

// TODO: move this into its own push proxy package once one exists (see also pushNotificationClient in server.go)
func testPushProxyConnection(ctx context.Context, serverURL string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	versionURL, err := url.JoinPath(serverURL, "version")
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, versionURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("push proxy returned unexpected status %d", resp.StatusCode)
	}
	return nil
}

func (ps *PlatformService) getSanitizedConfigFile(rctx request.CTX) (*model.FileData, error) {
	config := ps.getSanitizedConfig(rctx, &model.SanitizeOptions{PartiallyRedactDataSources: true})
	spConfig := model.SupportPacketConfig{
		Config:       config,
		FeatureFlags: *config.FeatureFlags,
	}
	sanitizedConfigPrettyJSON, err := json.MarshalIndent(spConfig, "", "    ")
	if err != nil {
		return nil, errors.Wrap(err, "failed to sanitized config into json")
	}

	fileData := &model.FileData{
		Filename: "sanitized_config.json",
		Body:     sanitizedConfigPrettyJSON,
	}
	return fileData, nil
}

func (ps *PlatformService) getCPUProfile(_ request.CTX) (*model.FileData, error) {
	var b bytes.Buffer

	err := rpprof.StartCPUProfile(&b)
	if err != nil {
		return nil, errors.Wrap(err, "failed to start CPU profile")
	}

	time.Sleep(cpuProfileDuration)

	rpprof.StopCPUProfile()

	fileData := &model.FileData{
		Filename: "cpu.prof",
		Body:     b.Bytes(),
	}
	return fileData, nil
}

func (ps *PlatformService) getHeapProfile(_ request.CTX) (*model.FileData, error) {
	var b bytes.Buffer

	err := rpprof.Lookup("heap").WriteTo(&b, 0)
	if err != nil {
		return nil, errors.Wrap(err, "failed to lookup heap profile")
	}

	fileData := &model.FileData{
		Filename: "heap.prof",
		Body:     b.Bytes(),
	}
	return fileData, nil
}

func (ps *PlatformService) getGoroutineProfile(_ request.CTX) (*model.FileData, error) {
	var b bytes.Buffer

	err := rpprof.Lookup("goroutine").WriteTo(&b, 2)
	if err != nil {
		return nil, errors.Wrap(err, "failed to lookup goroutine profile")
	}

	fileData := &model.FileData{
		Filename: "goroutines",
		Body:     b.Bytes(),
	}
	return fileData, nil
}

// detectSAMLProviderType attempts to identify the SAML provider type based on the IdpDescriptorURL.
// It returns "unknown" if the provider cannot be identified.
func detectSAMLProviderType(idpDescriptorURL string) string {
	if idpDescriptorURL == "" {
		return unknownDataPoint
	}

	// Normalize URL to lowercase for case-insensitive matching
	normalizedURL := strings.ToLower(idpDescriptorURL)

	// Check for common SAML provider patterns in the EntityID/IdpDescriptorURL
	// Order matters: more specific patterns should come before generic ones
	switch {
	case strings.Contains(normalizedURL, "login.microsoftonline.com") || strings.Contains(normalizedURL, "sts.windows.net"):
		return "Azure AD"
	case strings.Contains(normalizedURL, ".okta.com") || strings.Contains(normalizedURL, ".oktapreview.com"):
		return "Okta"
	case strings.Contains(normalizedURL, ".auth0.com"):
		return "Auth0"
	case strings.Contains(normalizedURL, ".onelogin.com"):
		return "OneLogin"
	case strings.Contains(normalizedURL, "accounts.google.com"):
		return "Google Workspace"
	case strings.Contains(normalizedURL, "sso.jumpcloud.com"):
		return "JumpCloud"
	case strings.Contains(normalizedURL, "duo.com/saml2"):
		return "Duo"
	case strings.Contains(normalizedURL, ".centrify.com"):
		return "Centrify"
	case strings.Contains(normalizedURL, "/realms/"):
		return "Keycloak"
	case strings.Contains(normalizedURL, "/adfs/") || strings.Contains(normalizedURL, "/FederationMetadata/"):
		return "ADFS"
	case strings.Contains(normalizedURL, "shibboleth.net") || strings.Contains(normalizedURL, "/idp/shibboleth"):
		return "Shibboleth"
	default:
		return unknownDataPoint
	}
}
