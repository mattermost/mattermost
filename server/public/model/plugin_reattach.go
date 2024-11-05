package model

import (
	"net"
	"net/http"

	"github.com/hashicorp/go-plugin"
)

// PluginReattachConfig is a serializable version of go-plugin's ReattachConfig.
type PluginReattachConfig struct {
	Protocol        string
	ProtocolVersion int
	Addr            net.UnixAddr
	Pid             int
	Test            bool
}

func NewPluginReattachConfig(pluginReattachmentConfig *plugin.ReattachConfig) *PluginReattachConfig {
	return &PluginReattachConfig{
		Protocol:        string(pluginReattachmentConfig.Protocol),
		ProtocolVersion: pluginReattachmentConfig.ProtocolVersion,
		Addr: net.UnixAddr{
			Name: pluginReattachmentConfig.Addr.String(),
			Net:  pluginReattachmentConfig.Addr.Network(),
		},
		Pid:  pluginReattachmentConfig.Pid,
		Test: pluginReattachmentConfig.Test,
	}
}

func (prc *PluginReattachConfig) ToHashicorpPluginReattachmentConfig() *plugin.ReattachConfig {
	addr := prc.Addr

	return &plugin.ReattachConfig{
		Protocol:        plugin.Protocol(prc.Protocol),
		ProtocolVersion: prc.ProtocolVersion,
		Addr:            &addr,
		Pid:             prc.Pid,
		ReattachFunc:    nil,
		Test:            prc.Test,
	}
}

type PluginReattachRequest struct {
	Manifest             *Manifest
	PluginReattachConfig *PluginReattachConfig
}

func (prr *PluginReattachRequest) IsValid() *AppError {
	if prr.Manifest == nil {
		return NewAppError("PluginReattachRequest.IsValid", "plugin_reattach_request.is_valid.manifest.app_error", nil, "", http.StatusBadRequest)
	}
	if prr.PluginReattachConfig == nil {
		return NewAppError("PluginReattachRequest.IsValid", "plugin_reattach_request.is_valid.plugin_reattach_config.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
