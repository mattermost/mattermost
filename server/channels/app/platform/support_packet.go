// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"os"
	"runtime"
	rpprof "runtime/pprof"
	"time"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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
		functions["notification log"] = ps.GetNotificationLogFile
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
	d.Server.Hostname, err = os.Hostname()
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "error while getting hostname"))
	}
	d.Server.Version = model.CurrentVersion
	d.Server.BuildHash = model.BuildHash
	installationType := os.Getenv(envVarInstallType)
	if installationType == "" {
		installationType = unknownDataPoint
	}
	d.Server.InstallationType = installationType

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

	/* Websockets */
	d.Websocket.Connections = ps.TotalWebsocketConnections()

	/* Cluster */
	if cluster := ps.Cluster(); cluster != nil {
		d.Cluster.ID = cluster.GetClusterId()
		clusterInfo := cluster.GetClusterInfos()
		d.Cluster.NumberOfNodes = len(clusterInfo)
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
	}

	/* Elastic Search */
	if se := ps.SearchEngine.ElasticsearchEngine; se != nil {
		d.ElasticSearch.ServerVersion = se.GetFullVersion()
		d.ElasticSearch.ServerPlugins = se.GetPlugins()
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

func (ps *PlatformService) getSanitizedConfigFile(rctx request.CTX) (*model.FileData, error) {
	config := ps.getSanitizedConfig(rctx)
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
