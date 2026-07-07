// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

// diagnosticsYAMLComments annotates non-obvious fields in diagnostics.yaml
// with inline (and a few group-header) comments so support engineers reading
// the file under triage conditions have units, omitempty semantics, and
// cumulative-vs-point-in-time semantics visible at a glance.
var diagnosticsYAMLComments = yaml.CommentMap{
	// server: — grouped into Machine / Capacity / Process lifecycle / Software
	"$.server.os":                        {yaml.HeadComment(" Machine")},
	"$.server.cpu_cores":                 {yaml.HeadComment(" Capacity (hardware → effective quota)"), yaml.LineComment(" logical CPUs visible to the OS")},
	"$.server.total_memory_mb":           {yaml.LineComment(" host/VM total RAM; may exceed container limit")},
	"$.server.container_cpu_limit":       {yaml.LineComment(" cgroup v2 CPU quota in CPUs; Linux only, omitted if no limit set")},
	"$.server.container_memory_limit_mb": {yaml.LineComment(" cgroup v2 memory quota in MB; Linux only, omitted if no limit set")},
	"$.server.process_id":                {yaml.HeadComment(" Process lifecycle")},
	"$.server.started_at":                {yaml.LineComment(" when Mattermost process started")},
	"$.server.host_started_at":           {yaml.LineComment(" when the host OS booted; omitted if unavailable")},
	"$.server.open_file_descriptors":     {yaml.LineComment(" current open FDs for this process")},
	"$.server.max_file_descriptors":      {yaml.LineComment(" system limit (ulimit -n)")},
	"$.server.version":                   {yaml.HeadComment(" Software")},

	// database: sql.DBStats cumulative counters (lifetime of process; all drivers)
	"$.database.master_pool_wait_count":                  {yaml.LineComment(" cumulative; total times a goroutine waited for a connection since process start")},
	"$.database.master_pool_wait_duration_ms":            {yaml.LineComment(" cumulative wait time across all goroutines since process start")},
	"$.database.master_connections_closed_max_idle":      {yaml.LineComment(" cumulative; connections closed because the idle pool was full")},
	"$.database.master_connections_closed_max_lifetime":  {yaml.LineComment(" cumulative; connections closed for exceeding ConnMaxLifetime")},
	"$.database.replica_pool_wait_count":                 {yaml.LineComment(" cumulative across all replicas; see master_pool_wait_count")},
	"$.database.replica_pool_wait_duration_ms":           {yaml.LineComment(" cumulative across all replicas")},
	"$.database.replica_connections_closed_max_idle":     {yaml.LineComment(" cumulative across all replicas")},
	"$.database.replica_connections_closed_max_lifetime": {yaml.LineComment(" cumulative across all replicas")},

	// database: PostgreSQL-only fields (omitted on MySQL)
	"$.database.cache_hit_ratio":                {yaml.HeadComment(" PostgreSQL-only (these fields are omitted on MySQL)"), yaml.LineComment(" blks_hit / (blks_hit + blks_read) from pg_stat_database; cumulative since stats reset")},
	"$.database.deadlocks":                      {yaml.LineComment(" cumulative since pg_stat_database reset")},
	"$.database.temp_files":                     {yaml.LineComment(" cumulative count of temp files created since stats reset")},
	"$.database.temp_bytes_mb":                  {yaml.LineComment(" cumulative bytes written to temp files, in MB")},
	"$.database.rollbacks":                      {yaml.LineComment(" cumulative transaction rollbacks since stats reset")},
	"$.database.idle_in_transaction_count":      {yaml.LineComment(" point-in-time count from pg_stat_activity")},
	"$.database.longest_query_duration_seconds": {yaml.LineComment(" point-in-time; max age of any active query right now")},
	"$.database.waiting_for_lock_count":         {yaml.LineComment(" point-in-time count of backends waiting on a Lock wait_event_type")},
	"$.database.posts_dead_tuples":              {yaml.LineComment(" n_dead_tup for the posts table from pg_stat_user_tables")},
	"$.database.posts_last_autovacuum":          {yaml.LineComment(" last autovacuum on posts; null if never autovacuumed (then omitted)")},

	// file_store: local driver only fields
	"$.file_store.filesystem_type": {yaml.LineComment(" local driver only (e.g. ext4, xfs); omitted for s3 and other remote drivers")},
	"$.file_store.total_mb":        {yaml.LineComment(" local driver only; capacity of the volume hosting FileSettings.Directory")},
	"$.file_store.available_mb":    {yaml.LineComment(" local driver only; free space remaining on that volume")},
}

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
	d.Database.MasterConnections = ps.Store.TotalMasterDbConnections()
	d.Database.ReplicaConnections = ps.Store.TotalReadDbConnections()
	d.Database.SearchConnections = ps.Store.TotalSearchDbConnections()

	err = ps.applyStoreDiagnostics(rctx.Context(), &d)
	if err != nil {
		rErr = multierror.Append(rErr, err)
	}

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
	if samlDiagnostic := ps.SamlDiagnostic(); samlDiagnostic != nil && model.SafeDereference(ps.Config().SamlSettings.Enable) {
		if err = samlDiagnostic.RunSupportPacketTest(rctx, ps.Config().SamlSettings); err != nil {
			d.SAML.Status = model.StatusFail
			d.SAML.Error = err.Error()
		} else {
			d.SAML.Status = model.StatusOk
		}
	} else {
		d.SAML.Status = model.StatusDisabled
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

	/* OAuth2 / OpenID Connect Providers */
	d.OAuthProviders.GitLab = probeOAuthProvider(rctx.Context(), &ps.Config().GitLabSettings)
	d.OAuthProviders.Google = probeOAuthProvider(rctx.Context(), &ps.Config().GoogleSettings)
	d.OAuthProviders.Office365 = probeOAuthProvider(rctx.Context(), ps.Config().Office365Settings.SSOSettings())
	d.OAuthProviders.OpenID = probeOAuthProvider(rctx.Context(), &ps.Config().OpenIdSettings)

	/* Push Notifications */
	if model.SafeDereference(ps.Config().EmailSettings.SendPushNotifications) {
		pushServerURL := model.SafeDereference(ps.Config().EmailSettings.PushNotificationServer)
		if pushErr := ps.testPushProxyConnection(rctx.Context(), pushServerURL); pushErr != nil {
			d.Notifications.Push.Status = model.StatusFail
			d.Notifications.Push.Error = pushErr.Error()
		} else {
			d.Notifications.Push.Status = model.StatusOk
		}
	} else {
		d.Notifications.Push.Status = model.StatusDisabled
	}

	b, err := yaml.MarshalWithOptions(&d, yaml.WithComment(diagnosticsYAMLComments))
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to marshal Support Packet into yaml"))
	}

	fileData := &model.FileData{
		Filename: "diagnostics.yaml",
		Body:     b,
	}
	return fileData, rErr.ErrorOrNil()
}

func (ps *PlatformService) applyStoreDiagnostics(ctx context.Context, diagnostics *model.SupportPacketDiagnostics) error {
	storeDiagnostics, err := ps.Store.GetDiagnostics(ctx)
	if storeDiagnostics == nil {
		if err != nil {
			return errors.Wrap(err, "error while collecting support packet database diagnostics")
		}
		return nil
	}

	diagnostics.Database.MasterConnectionsInUse = storeDiagnostics.MasterConnectionsInUse
	diagnostics.Database.MasterConnectionsIdle = storeDiagnostics.MasterConnectionsIdle
	diagnostics.Database.MasterPoolWaitCount = storeDiagnostics.MasterPoolWaitCount
	diagnostics.Database.MasterPoolWaitDurationMs = storeDiagnostics.MasterPoolWaitDurationMs
	diagnostics.Database.MasterConnectionsClosedMaxIdle = storeDiagnostics.MasterConnectionsClosedMaxIdle
	diagnostics.Database.MasterConnectionsClosedMaxLifetime = storeDiagnostics.MasterConnectionsClosedMaxLifetime
	diagnostics.Database.ReplicaConnectionsInUse = storeDiagnostics.ReplicaConnectionsInUse
	diagnostics.Database.ReplicaConnectionsIdle = storeDiagnostics.ReplicaConnectionsIdle
	diagnostics.Database.ReplicaPoolWaitCount = storeDiagnostics.ReplicaPoolWaitCount
	diagnostics.Database.ReplicaPoolWaitDurationMs = storeDiagnostics.ReplicaPoolWaitDurationMs
	diagnostics.Database.ReplicaConnectionsClosedMaxIdle = storeDiagnostics.ReplicaConnectionsClosedMaxIdle
	diagnostics.Database.ReplicaConnectionsClosedMaxLifetime = storeDiagnostics.ReplicaConnectionsClosedMaxLifetime
	diagnostics.Database.CacheHitRatio = storeDiagnostics.CacheHitRatio
	diagnostics.Database.Deadlocks = storeDiagnostics.Deadlocks
	diagnostics.Database.TempFiles = storeDiagnostics.TempFiles
	diagnostics.Database.TempBytesMB = storeDiagnostics.TempBytesMB
	diagnostics.Database.Rollbacks = storeDiagnostics.Rollbacks
	diagnostics.Database.IdleInTransactionCount = storeDiagnostics.IdleInTransactionCount
	diagnostics.Database.LongestQueryDurationSeconds = storeDiagnostics.LongestQueryDurationSeconds
	diagnostics.Database.WaitingForLockCount = storeDiagnostics.WaitingForLockCount
	diagnostics.Database.PostsDeadTuples = storeDiagnostics.PostsDeadTuples
	diagnostics.Database.PostsLastAutovacuum = storeDiagnostics.PostsLastAutovacuum

	if err != nil {
		return errors.Wrap(err, "error while collecting support packet database diagnostics")
	}

	return nil
}

// probeOAuthProvider checks connectivity for an OAuth2/OpenID Connect provider.
// If the provider has a DiscoveryEndpoint configured, it issues an HTTP GET to
// that URL and verifies the response is a valid OIDC discovery document.
// Otherwise it probes the TokenEndpoint host: any HTTP response (including
// 4xx/5xx) is treated as reachable, since token endpoints typically reject GETs.
func probeOAuthProvider(ctx context.Context, sso *model.SSOSettings) model.OAuthProviderStatus {
	if !model.SafeDereference(sso.Enable) {
		return model.OAuthProviderStatus{Status: model.StatusDisabled}
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if discoveryEndpoint := model.SafeDereference(sso.DiscoveryEndpoint); discoveryEndpoint != "" {
		if err := probeOIDCDiscovery(ctx, discoveryEndpoint); err != nil {
			return model.OAuthProviderStatus{Status: model.StatusFail, Error: err.Error()}
		}
		return model.OAuthProviderStatus{Status: model.StatusOk}
	}

	if tokenEndpoint := model.SafeDereference(sso.TokenEndpoint); tokenEndpoint != "" {
		if err := probeOAuthTokenEndpoint(ctx, tokenEndpoint); err != nil {
			return model.OAuthProviderStatus{Status: model.StatusFail, Error: err.Error()}
		}
		return model.OAuthProviderStatus{Status: model.StatusOk}
	}

	return model.OAuthProviderStatus{Status: model.StatusFail, Error: "no discovery or token endpoint configured"}
}

func probeOIDCDiscovery(ctx context.Context, discoveryURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discoveryURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer drainAndCloseBody(resp.Body)
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("discovery endpoint returned unexpected status %d", resp.StatusCode)
	}
	// Cap the discovery document at 1 MiB; real OIDC discovery responses are a few KiB.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return errors.Wrap(err, "failed to read discovery response")
	}
	var doc struct {
		Issuer string `json:"issuer"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return errors.Wrap(err, "discovery endpoint did not return valid JSON")
	}
	if doc.Issuer == "" {
		return fmt.Errorf("discovery endpoint response missing required 'issuer' field")
	}
	return nil
}

func probeOAuthTokenEndpoint(ctx context.Context, tokenURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer drainAndCloseBody(resp.Body)
	return nil
}

// drainAndCloseBody fully reads and discards an HTTP response body (up to 1 MiB
// to bound a misbehaving server) and closes it. Draining before closing allows
// net/http to return the underlying TCP connection to the idle pool for
// keep-alive reuse on subsequent requests.
func drainAndCloseBody(body io.ReadCloser) {
	_, _ = io.Copy(io.Discard, io.LimitReader(body, 1<<20))
	_ = body.Close()
}

// TODO: move this into its own push proxy package once one exists (see also pushNotificationClient in server.go)
func (ps *PlatformService) testPushProxyConnection(ctx context.Context, serverURL string) error {
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
	defer drainAndCloseBody(resp.Body)
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
	case strings.Contains(normalizedURL, "/adfs") || strings.Contains(normalizedURL, "/federationmetadata/"):
		return "ADFS"
	case strings.Contains(normalizedURL, "shibboleth.net") || strings.Contains(normalizedURL, "/idp/shibboleth"):
		return "Shibboleth"
	default:
		return unknownDataPoint
	}
}
