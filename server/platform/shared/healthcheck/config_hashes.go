// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// NodeLocalConfigPaths are config settings that cluster nodes may set differently on purpose,
// so they are left out of ConfigSectionHashes: RunJobs and RunScheduler choose which nodes run
// jobs, and the addresses and hostname identify the node itself.
var NodeLocalConfigPaths = []string{
	"JobSettings.RunJobs",
	"JobSettings.RunScheduler",
	"ClusterSettings.OverrideHostname",
	"ClusterSettings.NetworkInterface",
	"ClusterSettings.BindAddress",
	"ClusterSettings.AdvertiseAddress",
	"ServiceSettings.ListenAddress",
	"MetricsSettings.ListenAddress",
}

// configSectionHashLength is how many hex characters of each SHA-256 are kept. The hashes only
// tell sections apart, so 64 bits is ample and keeps the diagnostics short.
const configSectionHashLength = 16

// ConfigSectionHashes hashes each top-level section of a config, such as SqlSettings or
// TeamSettings, with the NodeLocalConfigPaths cleared. The health check compares them across
// nodes to detect config drift: live, each node sends its hashes with its diagnostics, and
// offline, the packet reader computes them from each node's sanitized_config.json.
//
// cfg must be sanitized the way the packet's sanitized_config.json is, so both paths hash the
// same data. Secret values therefore never count as drift; whether a secret is set does.
func ConfigSectionHashes(cfg *model.Config) map[string]string {
	if cfg == nil {
		return nil
	}

	cfg = cfg.Clone()
	for _, path := range NodeLocalConfigPaths {
		if field, ok := configField(cfg, path); ok {
			field.SetZero()
		}
	}

	v := reflect.ValueOf(cfg).Elem()
	hashes := make(map[string]string, v.NumField())
	for i := range v.NumField() {
		if !v.Type().Field(i).IsExported() {
			continue
		}
		// encoding/json sorts map keys, so equal sections always marshal to equal bytes.
		section, err := json.Marshal(v.Field(i).Interface())
		if err != nil {
			continue
		}
		sum := sha256.Sum256(section)
		hashes[v.Type().Field(i).Name] = hex.EncodeToString(sum[:])[:configSectionHashLength]
	}

	return hashes
}

// configField resolves a path like "JobSettings.RunJobs" to its settable field, following the
// pointers config sections and settings are stored behind.
func configField(cfg *model.Config, path string) (reflect.Value, bool) {
	v := reflect.ValueOf(cfg).Elem()
	for name := range strings.SplitSeq(path, ".") {
		for v.Kind() == reflect.Pointer {
			if v.IsNil() {
				return reflect.Value{}, false
			}
			v = v.Elem()
		}
		if v.Kind() != reflect.Struct {
			return reflect.Value{}, false
		}
		v = v.FieldByName(name)
		if !v.IsValid() {
			return reflect.Value{}, false
		}
	}

	return v, v.CanSet()
}
