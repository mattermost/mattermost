// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package packet builds a healthcheck.Snapshot from a Support Packet zip. It depends only on
// public/model and the healthcheck package, so mmctl can evaluate a packet with no server.
package packet

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"maps"
	"os"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/goccy/go-yaml"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// Packet is a parsed Support Packet: the snapshot to evaluate, plus what the caller should
// tell the user about how far to trust it.
type Packet struct {
	Snapshot *healthcheck.Snapshot
	Warnings []string
}

// ReadFile reads the Support Packet zip at path.
func ReadFile(path string) (*Packet, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, err
	}

	return Read(f, info.Size())
}

// Read builds a snapshot from a Support Packet zip. An error means there is nothing to
// evaluate; anything short of that is reported in Packet.Warnings.
func Read(r io.ReaderAt, size int64) (*Packet, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("failed to open the Support Packet: %w", err)
	}

	return readPacket(&budgetedZip{zr: zr, remaining: maxTotalSize})
}

func readPacket(z *budgetedZip) (*Packet, error) {
	names := make([]string, 0, len(z.zr.File))
	for _, file := range z.zr.File {
		names = append(names, file.Name)
	}

	root, byNode := splitNodeFiles(names)
	if len(byNode) == 0 && !slices.Contains(root, model.SupportPacketDiagnosticsFileName) {
		return nil, fmt.Errorf("not a Support Packet: no %s found", model.SupportPacketDiagnosticsFileName)
	}
	if len(byNode) > maxNodes {
		return nil, fmt.Errorf("the Support Packet has %d nodes, more than the %d this reader accepts", len(byNode), maxNodes)
	}

	nodes, warnings := readNodes(z, root, byNode)
	leader, reported := selectLeader(nodes)
	if len(nodes) > 1 && !reported {
		warnings = append(warnings, fmt.Sprintf("The packet does not record which node is the leader, so the configuration was read from %s. Configuration findings may not match the leader's configuration.", leader.Hostname))
	}

	snapshot := healthcheck.NewSnapshot(nodes)
	snapshot.Sections = map[model.WorkspaceSection]error{}

	configFile := model.SupportPacketConfigFileName
	if len(byNode) > 0 {
		configFile = path.Join(leader.Hostname, configFile)
	}
	snapshot.Config = readSection[model.SupportPacketConfig](z, snapshot.Sections, model.SectionConfig, configFile, json.Unmarshal)
	snapshot.Stats = readSection[model.SupportPacketStats](z, snapshot.Sections, model.SectionStats, model.SupportPacketStatsFileName, yaml.Unmarshal)
	snapshot.Jobs = readSection[model.SupportPacketJobList](z, snapshot.Sections, model.SectionJobs, model.SupportPacketJobsFileName, yaml.Unmarshal)
	snapshot.Plugins = readSection[model.SupportPacketPluginList](z, snapshot.Sections, model.SectionPlugins, model.SupportPacketPluginsFileName, json.Unmarshal)

	if diag, ok := leader.Diag(); ok {
		snapshot.Deployment.IsCloud = diag.License.IsCloud
	}

	// The packet records no build date; the table evaluating it is this binary's, so its build date applies.
	snapshot.Version.BuildDate, _ = time.Parse(time.UnixDate, model.BuildDate)

	var metadata model.PacketMetadata
	found, err := z.readMember(model.PacketMetadataFileName, &metadata, yaml.Unmarshal)
	switch {
	case !found:
		warnings = append(warnings, fmt.Sprintf("The packet has no %s, so the time it was generated is unknown.", model.PacketMetadataFileName))
	case err != nil:
		warnings = append(warnings, fmt.Sprintf("%s. The time the packet was generated is unknown.", err))
	default:
		snapshot.Version.Current = metadata.ServerVersion
		if metadata.GeneratedAt > 0 {
			snapshot.CollectedAt = time.UnixMilli(metadata.GeneratedAt).UTC()
		}
	}

	generationErrors, found, err := z.readRaw(model.SupportPacketErrorFile)
	switch {
	case err != nil:
		warnings = append(warnings, fmt.Sprintf("%s.", err))
	case found:
		warnings = append(warnings, fmt.Sprintf("The server reported errors while generating the packet, so some data may be missing: %s", strings.TrimSpace(string(generationErrors))))
	}

	return &Packet{Snapshot: snapshot, Warnings: warnings}, nil
}

// splitNodeFiles separates root members from per-node ones. Every node writes its own
// diagnostics.yaml and sanitized_config.json under its hostname; requiring both keeps plugin
// directories, which may hold a diagnostics.yaml of their own, out of the node list.
// byNode holds each node's file names relative to its directory.
func splitNodeFiles(names []string) (root []string, byNode map[string][]string) {
	dirs := map[string][]string{}
	for _, name := range names {
		dir, file, found := strings.Cut(name, "/")
		if !found {
			root = append(root, name)
			continue
		}
		dirs[dir] = append(dirs[dir], file)
	}

	byNode = map[string][]string{}
	for dir, files := range dirs {
		if slices.Contains(files, model.SupportPacketDiagnosticsFileName) && slices.Contains(files, model.SupportPacketConfigFileName) {
			byNode[dir] = files
			continue
		}
		for _, file := range files {
			root = append(root, path.Join(dir, file))
		}
	}

	return root, byNode
}

// readNodes returns one NodeSnapshot per node directory, sorted by hostname, or a single node
// from the root files of a standalone packet. A node whose diagnostics.yaml does not parse
// keeps nil Diagnostics and adds a warning; the other nodes are still read.
func readNodes(z *budgetedZip, root []string, byNode map[string][]string) ([]*healthcheck.NodeSnapshot, []string) {
	var (
		nodes      []*healthcheck.NodeSnapshot
		warnings   []string
		newestSeen int
	)

	read := func(hostname, name string) *healthcheck.NodeSnapshot {
		node := &healthcheck.NodeSnapshot{Hostname: hostname}
		var diag model.SupportPacketDiagnostics
		if _, err := z.readMember(name, &diag, yaml.Unmarshal); err != nil {
			warnings = append(warnings, fmt.Sprintf("%s. The node's diagnostics are ignored.", err))
			return node
		}

		errs := make(model.SectionErrors, len(model.AllNodeSections()))
		for _, section := range model.AllNodeSections() {
			errs[section] = nil
		}
		node.Diagnostics = &model.NodeDiagnostics{Diagnostics: &diag, Errors: errs}
		newestSeen = max(newestSeen, diag.Version)
		return node
	}

	if len(byNode) == 0 && slices.Contains(root, model.SupportPacketDiagnosticsFileName) {
		node := read("", model.SupportPacketDiagnosticsFileName)
		if diag, ok := node.Diag(); ok {
			node.Hostname = model.SafeDereference(diag.Server.Hostname)
		}
		nodes = append(nodes, node)
	}

	for _, hostname := range slices.Sorted(maps.Keys(byNode)) {
		nodes = append(nodes, read(hostname, path.Join(hostname, model.SupportPacketDiagnosticsFileName)))
	}

	if newestSeen > model.CurrentSupportPacketVersion {
		warnings = append(warnings, fmt.Sprintf("The packet is from a newer server (Support Packet version %d, this build reads version %d). Upgrade mmctl: fields this build does not know may read as missing.", newestSeen, model.CurrentSupportPacketVersion))
	}

	return nodes, warnings
}

// selectLeader marks the node that reported itself as leader. Packets written before nodes
// reported it fall back to the first node by hostname, with reported false.
func selectLeader(nodes []*healthcheck.NodeSnapshot) (leader *healthcheck.NodeSnapshot, reported bool) {
	leader = nodes[0]
	for _, node := range nodes {
		if diag, ok := node.Diag(); ok && diag.Cluster.IsLeader {
			leader = node
			reported = true
			break
		}
	}

	leader.IsLeader = true
	return leader, reported
}

// readSection decodes a workspace section file. A present file records its section, with the
// parse error if it has one; an absent file records nothing, so its accessors report ok=false.
func readSection[T any](z *budgetedZip, sections map[model.WorkspaceSection]error, section model.WorkspaceSection, name string, unmarshal func([]byte, any) error) *T {
	var v T
	found, err := z.readMember(name, &v, unmarshal)
	if !found {
		return nil
	}

	sections[section] = err
	if err != nil {
		return nil
	}
	return &v
}

// These limits keep a crafted or corrupt packet from exhausting memory. Real packet files
// are a few hundred KB at most, and real clusters have a handful of nodes.
const (
	maxMemberSize = 64 << 20
	maxTotalSize  = 256 << 20
	maxNodes      = 100
)

// budgetedZip tracks how many bytes may still be read across all members.
type budgetedZip struct {
	zr        *zip.Reader
	remaining int64
}

func (z *budgetedZip) readMember(name string, v any, unmarshal func([]byte, any) error) (found bool, err error) {
	data, found, err := z.readRaw(name)
	if !found || err != nil {
		return found, err
	}

	if err = unmarshal(data, v); err != nil {
		return true, fmt.Errorf("failed to parse %s: %w", name, err)
	}
	return true, nil
}

func (z *budgetedZip) readRaw(name string) (data []byte, found bool, err error) {
	f, err := z.zr.Open(name)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, false, nil
	}
	if err != nil {
		return nil, true, fmt.Errorf("failed to read %s: %w", name, err)
	}
	defer f.Close()

	data, err = io.ReadAll(io.LimitReader(f, min(maxMemberSize, z.remaining)+1))
	z.remaining -= int64(len(data))
	if err != nil {
		return nil, true, fmt.Errorf("failed to read %s: %w", name, err)
	}
	if len(data) > maxMemberSize {
		return nil, true, fmt.Errorf("failed to read %s: larger than %d MiB", name, maxMemberSize>>20)
	}
	if z.remaining < 0 {
		return nil, true, fmt.Errorf("failed to read %s: the packet exceeds the total read limit", name)
	}
	return data, true, nil
}
