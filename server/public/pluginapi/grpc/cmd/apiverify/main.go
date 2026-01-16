// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package main provides the apiverify tool which ensures that the gRPC PluginAPI
// service definition stays in sync with the Go plugin.API interface.
//
// Usage:
//
//	go run ./server/public/pluginapi/grpc/cmd/apiverify
//
// Exit codes:
//   - 0: All methods match
//   - 1: Mismatch detected (missing or extra RPCs)
//   - 2: Error parsing files
package main

import (
	"bufio"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

func main() {
	// Find the repository root by looking for go.mod
	repoRoot, err := findRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error finding repository root: %v\n", err)
		os.Exit(2)
	}

	apiGoPath := filepath.Join(repoRoot, "server/public/plugin/api.go")
	apiProtoPath := filepath.Join(repoRoot, "server/public/pluginapi/grpc/proto/api.proto")

	// Parse Go API interface
	goMethods, err := parseGoAPIInterface(apiGoPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing Go API interface: %v\n", err)
		os.Exit(2)
	}

	// Parse proto service RPCs
	protoRPCs, err := parseProtoServiceRPCs(apiProtoPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing proto service RPCs: %v\n", err)
		os.Exit(2)
	}

	// Compare
	missingInProto := difference(goMethods, protoRPCs)
	extraInProto := difference(protoRPCs, goMethods)

	if len(missingInProto) == 0 && len(extraInProto) == 0 {
		fmt.Printf("OK: All %d API methods have corresponding RPCs in api.proto\n", len(goMethods))
		os.Exit(0)
	}

	if len(missingInProto) > 0 {
		fmt.Printf("MISSING in api.proto (%d methods):\n", len(missingInProto))
		sort.Strings(missingInProto)
		for _, m := range missingInProto {
			fmt.Printf("  - %s\n", m)
		}
	}

	if len(extraInProto) > 0 {
		fmt.Printf("EXTRA in api.proto (not in plugin.API interface, %d RPCs):\n", len(extraInProto))
		sort.Strings(extraInProto)
		for _, m := range extraInProto {
			fmt.Printf("  + %s\n", m)
		}
	}

	fmt.Printf("\nSummary: Go API has %d methods, proto has %d RPCs\n", len(goMethods), len(protoRPCs))
	os.Exit(1)
}

// findRepoRoot walks up from the current directory looking for the server/public/plugin/api.go file
// This handles both running from the repo root and from the server subdirectory.
func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		// Check if server/public/plugin/api.go exists (we're at repo root)
		if _, err := os.Stat(filepath.Join(dir, "server/public/plugin/api.go")); err == nil {
			return dir, nil
		}
		// Check if public/plugin/api.go exists (we're in server directory)
		if _, err := os.Stat(filepath.Join(dir, "public/plugin/api.go")); err == nil {
			// Return parent to normalize paths
			return filepath.Dir(dir), nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root without finding the file
			return "", fmt.Errorf("could not find plugin/api.go in any parent directory")
		}
		dir = parent
	}
}

// parseGoAPIInterface extracts method names from the API interface in api.go
func parseGoAPIInterface(path string) ([]string, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", path, err)
	}

	var methods []string

	ast.Inspect(node, func(n ast.Node) bool {
		// Look for type declarations
		typeSpec, ok := n.(*ast.TypeSpec)
		if !ok {
			return true
		}

		// Check if this is the API interface
		if typeSpec.Name.Name != "API" {
			return true
		}

		// Get the interface type
		iface, ok := typeSpec.Type.(*ast.InterfaceType)
		if !ok {
			return true
		}

		// Extract method names
		for _, method := range iface.Methods.List {
			// Each method has exactly one name
			if len(method.Names) == 1 {
				methods = append(methods, method.Names[0].Name)
			}
		}

		return false // Found the API interface, no need to continue
	})

	if len(methods) == 0 {
		return nil, fmt.Errorf("no methods found in API interface in %s", path)
	}

	return methods, nil
}

// parseProtoServiceRPCs extracts RPC names from the PluginAPI service in api.proto
func parseProtoServiceRPCs(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open %s: %w", path, err)
	}
	defer file.Close()

	var rpcs []string
	inService := false

	// Match "service PluginAPI {"
	serviceStartRe := regexp.MustCompile(`^\s*service\s+PluginAPI\s*\{`)
	// Match "rpc MethodName(RequestType) returns (ResponseType);"
	rpcRe := regexp.MustCompile(`^\s*rpc\s+(\w+)\s*\(`)
	// Match closing brace
	closeBraceRe := regexp.MustCompile(`^\s*\}`)

	braceCount := 0
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()

		if !inService {
			if serviceStartRe.MatchString(line) {
				inService = true
				braceCount = 1
			}
			continue
		}

		// Track nested braces
		braceCount += strings.Count(line, "{")
		braceCount -= strings.Count(line, "}")

		if braceCount <= 0 {
			break // End of service definition
		}

		// Look for RPC definitions
		if matches := rpcRe.FindStringSubmatch(line); matches != nil {
			rpcs = append(rpcs, matches[1])
		}

		// Also handle closing brace on its own line
		if closeBraceRe.MatchString(line) && braceCount <= 0 {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading %s: %w", path, err)
	}

	return rpcs, nil
}

// difference returns elements in a that are not in b
func difference(a, b []string) []string {
	bSet := make(map[string]bool)
	for _, x := range b {
		bSet[x] = true
	}

	var diff []string
	for _, x := range a {
		if !bSet[x] {
			diff = append(diff, x)
		}
	}

	return diff
}
