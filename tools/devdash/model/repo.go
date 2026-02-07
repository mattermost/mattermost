package model

type RepoKind int

const (
	RepoKindInternal RepoKind = iota
	RepoKindPlugin
)

type TargetCategory int

const (
	CategoryDeploy TargetCategory = iota
	CategoryRun
	CategoryLint
	CategoryTest
	CategoryBuild
	CategoryClean
	CategoryOther
)

// CategoryName returns a short display name.
func CategoryName(c TargetCategory) string {
	switch c {
	case CategoryRun:
		return "Run"
	case CategoryDeploy:
		return "Deploy"
	case CategoryLint:
		return "Lint"
	case CategoryTest:
		return "Test"
	case CategoryBuild:
		return "Build"
	case CategoryClean:
		return "Clean"
	default:
		return "Other"
	}
}

type Repo struct {
	Name         string
	Path         string
	Kind         RepoKind
	MakeTargets  []Target
	NpmScripts   []NpmScript
	MakefilePath string
	PackageJSON  string
}

type Target struct {
	Name        string
	Description string
	Category    TargetCategory
}

type NpmScript struct {
	Name    string
	Command string
}
