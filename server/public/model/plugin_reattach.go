package model

import (
	"net"

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

func (prr *PluginReattachRequest) IsValid() bool {
	if prr.Manifest == nil {
		return false
	}
	if prr.PluginReattachConfig == nil {
		return false
	}

	return true
}
