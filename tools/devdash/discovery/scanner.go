package discovery

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

// internalSubs are sub-projects within the mattermost repo.
var internalSubs = []struct {
	name        string
	makefileSub string
	pkgJSONSub  string
}{
	{"mattermost", "Makefile", ""},
}

func ScanAll(mmRoot string, subPkgDepth int) ([]model.Repo, error) {
	var repos []model.Repo

	// 1. Internal sub-projects
	for _, sub := range internalSubs {
		mfPath := filepath.Join(mmRoot, sub.makefileSub)
		if _, err := os.Stat(mfPath); err != nil {
			continue
		}

		repo := model.Repo{
			Name:         sub.name,
			Path:         filepath.Dir(mfPath),
			Kind:         model.RepoKindInternal,
			MakefilePath: mfPath,
		}

		targets, err := ParseMakeTargets(mfPath)
		if err == nil {
			repo.MakeTargets = targets
		}

		if sub.pkgJSONSub != "" {
			pkgPath := filepath.Join(mmRoot, sub.pkgJSONSub)
			if _, err := os.Stat(pkgPath); err == nil {
				repo.PackageJSON = pkgPath
				scripts, err := ParseNpmScripts(pkgPath)
				if err == nil {
					repo.NpmScripts = scripts
				}
			}
		}

		repos = append(repos, repo)
	}

	// 2. Sibling repos (other projects alongside mattermost)
	scanRoot := filepath.Dir(mmRoot)
	mmDirName := filepath.Base(mmRoot)
	entries, err := os.ReadDir(scanRoot)
	if err != nil {
		return repos, nil // non-fatal
	}

	// Track seen git roots to deduplicate worktrees of the same repo
	seenGitRoots := make(map[string]bool)
	if gitRoot, ok := resolveGitRepoRoot(mmRoot); ok {
		seenGitRoots[gitRoot] = true
	}

	var siblings []model.Repo
	var plugins []model.Repo
	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == mmDirName {
			continue
		}

		repoPath := filepath.Join(scanRoot, entry.Name())

		// Deduplicate by real git root (skip worktrees of already-seen repos)
		if gitRoot, ok := resolveGitRepoRoot(repoPath); ok {
			if seenGitRoots[gitRoot] {
				continue
			}
			seenGitRoots[gitRoot] = true
		}

		// Need at least a Makefile or package.json
		mfPath := filepath.Join(repoPath, "Makefile")
		pkgPath := filepath.Join(repoPath, "package.json")
		hasMakefile := fileExists(mfPath)
		hasPkgJSON := fileExists(pkgPath)
		if !hasMakefile && !hasPkgJSON {
			continue
		}

		// Determine kind and display name
		isPlugin := strings.HasPrefix(entry.Name(), "mattermost-plugin-")
		kind := model.RepoKindSibling
		displayName := entry.Name()
		if isPlugin {
			kind = model.RepoKindPlugin
			displayName = strings.TrimPrefix(entry.Name(), "mattermost-plugin-")
		} else {
			// Shorten common prefixes
			displayName = strings.TrimPrefix(displayName, "mattermost-")
		}

		repo := model.Repo{
			Name: displayName,
			Path: repoPath,
			Kind: kind,
		}

		if hasMakefile {
			repo.MakefilePath = mfPath
			targets, err := ParseMakeTargets(mfPath)
			if err == nil {
				repo.MakeTargets = targets
			}
		}

		if hasPkgJSON {
			repo.PackageJSON = pkgPath
			scripts, err := ParseNpmScripts(pkgPath)
			if err == nil {
				repo.NpmScripts = scripts
			}
		}

		// Also check webapp/package.json for repos that have a nested webapp
		if !hasPkgJSON {
			wpPath := filepath.Join(repoPath, "webapp", "package.json")
			if fileExists(wpPath) {
				repo.PackageJSON = wpPath
				scripts, err := ParseNpmScripts(wpPath)
				if err == nil {
					repo.NpmScripts = scripts
				}
			}
		}

		if isPlugin {
			plugins = append(plugins, repo)
		} else {
			siblings = append(siblings, repo)
		}
	}

	sort.Slice(siblings, func(i, j int) bool {
		return siblings[i].Name < siblings[j].Name
	})
	sort.Slice(plugins, func(i, j int) bool {
		return plugins[i].Name < plugins[j].Name
	})

	repos = append(repos, siblings...)
	repos = append(repos, plugins...)

	// 3. Discover sub-packages and insert immediately after their parent.
	// Track seen paths to deduplicate (e.g. mattermost/webapp vs webapp).
	seenPaths := make(map[string]bool)
	for _, repo := range repos {
		seenPaths[repo.Path] = true
	}

	var result []model.Repo
	for _, repo := range repos {
		result = append(result, repo)
		subs := discoverSubPackages(repo, subPkgDepth)
		sort.Slice(subs, func(i, j int) bool {
			return subs[i].Name < subs[j].Name
		})
		for _, sub := range subs {
			if seenPaths[sub.Path] {
				continue
			}
			seenPaths[sub.Path] = true
			result = append(result, sub)
		}
	}

	return result, nil
}

// discoverSubPackages scans a repo's directory tree for nested sub-projects
// (directories with a Makefile or package.json). Each becomes a separate
// Repo entry with a "parent/subpath" display name.
func discoverSubPackages(parent model.Repo, maxDepth int) []model.Repo {
	var subs []model.Repo

	walkDir(parent.Path, parent.Path, 0, maxDepth, func(dir, relDir string) {
		mfPath := filepath.Join(dir, "Makefile")
		pkgPath := filepath.Join(dir, "package.json")
		hasMakefile := fileExists(mfPath)
		hasPkgJSON := fileExists(pkgPath)

		if !hasMakefile && !hasPkgJSON {
			return
		}

		repo := model.Repo{
			Name: parent.Name + "/" + relDir,
			Path: dir,
			Kind: parent.Kind,
		}

		if hasMakefile {
			repo.MakefilePath = mfPath
			if targets, err := ParseMakeTargets(mfPath); err == nil {
				repo.MakeTargets = targets
			}
		}

		if hasPkgJSON {
			repo.PackageJSON = pkgPath
			if scripts, err := ParseNpmScripts(pkgPath); err == nil {
				repo.NpmScripts = scripts
			}
		}

		if len(repo.MakeTargets) == 0 && len(repo.NpmScripts) == 0 {
			return
		}

		subs = append(subs, repo)
	})

	return subs
}

// walkDir recursively scans directories up to maxDepth levels,
// skipping node_modules, .git, dist, and build directories.
// Calls fn for each subdirectory (depth > 0 skips the root).
func walkDir(root, dir string, depth, maxDepth int, fn func(dir, relDir string)) {
	if depth > maxDepth {
		return
	}

	if depth > 0 {
		rel, _ := filepath.Rel(root, dir)
		fn(dir, rel)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		if name == "node_modules" || name == ".git" || name == "dist" ||
			name == "build" || name == "vendor" || name == ".next" {
			continue
		}
		walkDir(root, filepath.Join(dir, name), depth+1, maxDepth, fn)
	}
}

// resolveGitRepoRoot returns the main git repository root for a path.
// For worktrees, it follows the .git file back to the main repo.
// Returns ("", false) if not a git repo.
func resolveGitRepoRoot(repoPath string) (string, bool) {
	gitPath := filepath.Join(repoPath, ".git")
	info, err := os.Lstat(gitPath)
	if err != nil {
		return "", false
	}

	// Regular repo: .git is a directory
	if info.IsDir() {
		return repoPath, true
	}

	// Worktree: .git is a file containing "gitdir: <path>"
	data, err := os.ReadFile(gitPath)
	if err != nil {
		return repoPath, true
	}

	line := strings.TrimSpace(string(data))
	if !strings.HasPrefix(line, "gitdir: ") {
		return repoPath, true
	}

	// gitdir points to .git/worktrees/<name> in the main repo
	// Walk up to find the main .git dir
	gitDir := strings.TrimPrefix(line, "gitdir: ")
	if !filepath.IsAbs(gitDir) {
		gitDir = filepath.Join(repoPath, gitDir)
	}
	gitDir = filepath.Clean(gitDir)

	// Expect: <main-repo>/.git/worktrees/<name> → go up 3 levels
	mainRoot := filepath.Dir(filepath.Dir(filepath.Dir(gitDir)))
	mainGit := filepath.Join(mainRoot, ".git")
	if info, err := os.Stat(mainGit); err == nil && info.IsDir() {
		return mainRoot, true
	}

	return repoPath, true
}

// ScanPaths creates Repo entries for specific filesystem paths (no tree walking).
// Repo names are derived from the path relative to mmRoot's parent (the scan root).
// Kind is inferred: paths inside mmRoot are Internal, mattermost-plugin-* are Plugin, rest are Sibling.
func ScanPaths(paths []string, repoNames map[string]string, mmRoot string) ([]model.Repo, error) {
	scanRoot := filepath.Dir(mmRoot)
	mmName := filepath.Base(mmRoot)

	var repos []model.Repo
	for _, dir := range paths {
		// Derive display name from path
		name := ""
		if repoNames != nil {
			name = repoNames[dir]
		}
		if name == "" {
			name = deriveRepoName(dir, scanRoot, mmName)
		}

		kind := inferRepoKind(dir, mmRoot)

		repo := model.Repo{
			Name: name,
			Path: dir,
			Kind: kind,
		}

		mf := filepath.Join(dir, "Makefile")
		if fileExists(mf) {
			repo.MakefilePath = mf
			if targets, err := ParseMakeTargets(mf); err == nil {
				repo.MakeTargets = targets
			}
		}

		pkg := filepath.Join(dir, "package.json")
		if fileExists(pkg) {
			repo.PackageJSON = pkg
			if scripts, err := ParseNpmScripts(pkg); err == nil {
				repo.NpmScripts = scripts
			}
		}

		if len(repo.MakeTargets) > 0 || len(repo.NpmScripts) > 0 {
			repos = append(repos, repo)
		}
	}

	sort.Slice(repos, func(i, j int) bool {
		if repos[i].Kind != repos[j].Kind {
			return repos[i].Kind < repos[j].Kind
		}
		return repos[i].Name < repos[j].Name
	})

	return repos, nil
}

// deriveRepoName generates a display name from a repo path.
// For paths inside mmRoot: "mattermost/server", "mattermost/webapp/channels"
// For sibling repos: "mobile", "desktop" (strips mattermost- prefix)
// For plugins: "playbooks" (strips mattermost-plugin- prefix)
func deriveRepoName(dir, scanRoot, mmName string) string {
	rel, err := filepath.Rel(scanRoot, dir)
	if err != nil {
		return filepath.Base(dir)
	}

	// Split into parts: e.g. "mattermost/server" or "mattermost-plugin-playbooks/webapp"
	parts := strings.Split(rel, string(filepath.Separator))
	if len(parts) == 0 {
		return filepath.Base(dir)
	}

	// Top-level directory name
	topDir := parts[0]

	// Inside mmRoot: use mmName as prefix
	if topDir == mmName {
		return strings.Join(parts, "/")
	}

	// Plugin: strip prefix on top-level, keep sub-path
	if strings.HasPrefix(topDir, "mattermost-plugin-") {
		parts[0] = strings.TrimPrefix(topDir, "mattermost-plugin-")
		return strings.Join(parts, "/")
	}

	// Sibling: strip mattermost- prefix
	parts[0] = strings.TrimPrefix(topDir, "mattermost-")
	return strings.Join(parts, "/")
}

// inferRepoKind determines the RepoKind from a path relative to mmRoot.
// Paths inside mmRoot are Internal, mattermost-plugin-* are Plugin, rest are Sibling.
func inferRepoKind(dir, mmRoot string) model.RepoKind {
	// Inside the mattermost repo → Internal
	if strings.HasPrefix(dir, mmRoot+string(filepath.Separator)) || dir == mmRoot {
		return model.RepoKindInternal
	}
	// Plugin repos
	base := filepath.Base(dir)
	if strings.HasPrefix(base, "mattermost-plugin-") {
		return model.RepoKindPlugin
	}
	// Walk up to check if any parent is a plugin
	parent := filepath.Dir(dir)
	for parent != filepath.Dir(parent) {
		if strings.HasPrefix(filepath.Base(parent), "mattermost-plugin-") {
			return model.RepoKindPlugin
		}
		parent = filepath.Dir(parent)
	}
	return model.RepoKindSibling
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
