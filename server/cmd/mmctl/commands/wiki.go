// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// Pre-compiled regex patterns for link placeholder resolution
// Note: Only ID-based placeholders are supported. Title-based placeholders (CONF_PAGE_TITLE)
// are deprecated due to ambiguity with duplicate titles. The transform tool should always
// emit CONF_PAGE_ID and CONF_FILE placeholders.
var (
	placeholderRegex = regexp.MustCompile(`\{\{CONF_(?:PAGE_ID|FILE):[^}]+\}\}`)
	pageIDRegex      = regexp.MustCompile(`\{\{CONF_PAGE_ID:([^}]+)\}\}`)
	fileIDRegex      = regexp.MustCompile(`\{\{CONF_FILE:([^}]+)\}\}`)
)

var WikiCmd = &cobra.Command{
	Use:   "wiki",
	Short: "Management of wiki pages",
}

var WikiVerifyCmd = &cobra.Command{
	Use:     "verify",
	Short:   "Verify a wiki migration against a manifest",
	Long:    "Verifies that all pages, comments, and attachments were imported correctly by comparing against the manifest file.",
	Example: "  wiki verify --manifest wiki-manifest.json --team myteam --channel mychannel",
	Args:    cobra.NoArgs,
	RunE:    withClient(wikiVerifyCmdF),
}

var WikiResolveLinksCmd = &cobra.Command{
	Use:     "resolve-links",
	Short:   "Resolve placeholder links after wiki import",
	Long:    "Scans imported pages for {{CONF_*}} placeholders and resolves them to actual Mattermost page URLs.",
	Example: "  wiki resolve-links --team myteam --channel mychannel",
	Args:    cobra.NoArgs,
	RunE:    withClient(wikiResolveLinksCmdF),
}

func init() {
	WikiVerifyCmd.Flags().StringP("manifest", "m", "", "Path to the manifest.json file from the transform")
	_ = WikiVerifyCmd.MarkFlagRequired("manifest")
	WikiVerifyCmd.Flags().String("team", "", "Team name")
	_ = WikiVerifyCmd.MarkFlagRequired("team")
	WikiVerifyCmd.Flags().String("channel", "", "Channel name")
	_ = WikiVerifyCmd.MarkFlagRequired("channel")
	WikiVerifyCmd.Flags().StringP("output", "o", "", "Output file for verification report (optional)")

	WikiResolveLinksCmd.Flags().String("team", "", "Team name")
	_ = WikiResolveLinksCmd.MarkFlagRequired("team")
	WikiResolveLinksCmd.Flags().String("channel", "", "Channel name")
	_ = WikiResolveLinksCmd.MarkFlagRequired("channel")
	WikiResolveLinksCmd.Flags().Bool("dry-run", false, "Scan for links without updating")

	WikiCmd.AddCommand(
		WikiVerifyCmd,
		WikiResolveLinksCmd,
	)
	RootCmd.AddCommand(WikiCmd)
}

// VerificationReport contains the results of post-import verification.
type VerificationReport struct {
	GeneratedAt    time.Time    `json:"generated_at"`
	ManifestFile   string       `json:"manifest_file"`
	ServerURL      string       `json:"server_url"`
	Expected       EntityCounts `json:"expected"`
	Actual         EntityCounts `json:"actual"`
	CountsMatch    bool         `json:"counts_match"`
	HierarchyValid bool         `json:"hierarchy_valid"`
	OrphanedPages  []string     `json:"orphaned_pages,omitempty"`
	BrokenLinks    []BrokenLink `json:"broken_links,omitempty"`
	LinksValid     bool         `json:"links_valid"`
	Passed         bool         `json:"passed"`
	FailureReasons []string     `json:"failure_reasons,omitempty"`
}

// EntityCounts holds entity counts for verification.
type EntityCounts struct {
	Pages       int `json:"pages"`
	Comments    int `json:"comments"`
	Attachments int `json:"attachments"`
}

// BrokenLink represents a link that couldn't be resolved.
type BrokenLink struct {
	PageTitle string `json:"page_title"`
	SourceID  string `json:"source_id"`
	TargetURL string `json:"target_url"`
	Reason    string `json:"reason"`
}

// Manifest represents the migration manifest file.
type Manifest struct {
	Version   string         `json:"version"`
	CreatedAt string         `json:"created_at"`
	Source    ManifestSource `json:"source"`
	Target    ManifestTarget `json:"target"`
	Counts    ManifestCounts `json:"counts"`
}

// ManifestSource contains source information.
type ManifestSource struct {
	Type     string `json:"type"`
	SpaceKey string `json:"space_key"`
}

// ManifestTarget contains target information.
type ManifestTarget struct {
	Team    string `json:"team"`
	Channel string `json:"channel"`
}

// ManifestCounts contains entity counts from manifest.
type ManifestCounts struct {
	Pages       int `json:"pages"`
	Comments    int `json:"comments"`
	Attachments int `json:"attachments"`
}

// LinkResolutionResult contains the results of link resolution.
type LinkResolutionResult struct {
	PagesScanned      int
	PagesUpdated      int
	LinksResolved     int
	LinksUnresolved   int
	UnresolvedDetails []UnresolvedLinkDetail
}

// UnresolvedLinkDetail provides details about an unresolved link.
type UnresolvedLinkDetail struct {
	PageTitle   string
	PageID      string
	Placeholder string
}

func wikiVerifyCmdF(c client.Client, command *cobra.Command, args []string) error {
	manifestPath, _ := command.Flags().GetString("manifest")
	teamName, _ := command.Flags().GetString("team")
	channelName, _ := command.Flags().GetString("channel")
	outputPath, _ := command.Flags().GetString("output")

	ctx := context.TODO()

	// Load manifest
	manifest, err := loadManifest(manifestPath)
	if err != nil {
		return fmt.Errorf("failed to load manifest: %w", err)
	}

	// Get team
	team, _, err := c.GetTeamByName(ctx, teamName, "")
	if err != nil {
		return fmt.Errorf("failed to get team %q: %w", teamName, err)
	}

	// Get channel
	channel, _, err := c.GetChannelByName(ctx, channelName, team.Id, "")
	if err != nil {
		return fmt.Errorf("failed to get channel %q: %w", channelName, err)
	}

	// Get wiki for channel
	wikis, _, err := c.GetWikisForChannel(ctx, channel.Id)
	if err != nil {
		return fmt.Errorf("failed to get wikis for channel: %w", err)
	}

	if len(wikis) == 0 {
		return fmt.Errorf("no wiki found for channel %q - import may not have completed", channelName)
	}
	wikiID := wikis[0].Id

	report := &VerificationReport{
		GeneratedAt:  time.Now().UTC(),
		ManifestFile: manifestPath,
		Expected: EntityCounts{
			Pages:       manifest.Counts.Pages,
			Comments:    manifest.Counts.Comments,
			Attachments: manifest.Counts.Attachments,
		},
		Passed: true,
	}

	printer.Print("Verifying wiki migration...")
	printer.Print(fmt.Sprintf("  Manifest: %s", manifestPath))
	printer.Print(fmt.Sprintf("  Team: %s", teamName))
	printer.Print(fmt.Sprintf("  Channel: %s", channelName))

	// Get pages with content in a single batch request (avoids N+1 API calls)
	postList, _, err := c.GetChannelPagesWithContent(ctx, channel.Id, true)
	if err != nil {
		report.FailureReasons = append(report.FailureReasons, fmt.Sprintf("failed to count pages: %v", err))
		report.Passed = false
	} else {
		report.Actual.Pages = len(postList.Posts)
	}

	// Count comments and attachments across all pages
	if postList != nil {
		totalComments := 0
		totalAttachments := 0
		for _, post := range postList.Posts {
			// Count attachments from import_file_mappings prop (set during import)
			// Note: post.FileIds may not be populated by the batch API
			if fileMappings, ok := post.GetProp("import_file_mappings").(map[string]any); ok {
				totalAttachments += len(fileMappings)
			}

			// Count comments (N+1 queries - optimization would require batch API)
			comments, _, cerr := c.GetPageComments(ctx, wikiID, post.Id)
			if cerr != nil {
				printer.Print(fmt.Sprintf("  Warning: failed to get comments for page %s: %v", post.Id, cerr))
				continue
			}
			totalComments += len(comments)
		}
		report.Actual.Comments = totalComments
		report.Actual.Attachments = totalAttachments
	}

	// Verify counts match (pages, comments, attachments)
	countsMatch := true
	if report.Expected.Pages != report.Actual.Pages {
		countsMatch = false
		report.FailureReasons = append(report.FailureReasons,
			fmt.Sprintf("page count mismatch: expected %d, found %d", report.Expected.Pages, report.Actual.Pages))
		report.Passed = false
	}
	if report.Expected.Comments != report.Actual.Comments {
		countsMatch = false
		report.FailureReasons = append(report.FailureReasons,
			fmt.Sprintf("comment count mismatch: expected %d, found %d", report.Expected.Comments, report.Actual.Comments))
		report.Passed = false
	}
	if report.Expected.Attachments != report.Actual.Attachments {
		countsMatch = false
		report.FailureReasons = append(report.FailureReasons,
			fmt.Sprintf("attachment count mismatch: expected %d, found %d", report.Expected.Attachments, report.Actual.Attachments))
		report.Passed = false
	}
	report.CountsMatch = countsMatch

	// Verify hierarchy (check for orphaned pages)
	// Note: Page hierarchy is stored in Post.PageParentId field, not in props
	if postList != nil {
		pageIDs := make(map[string]bool)
		for id := range postList.Posts {
			pageIDs[id] = true
		}

		var orphaned []string
		for _, post := range postList.Posts {
			// Use PageParentId field (not props) for hierarchy
			if post.PageParentId != "" {
				if !pageIDs[post.PageParentId] {
					title, _ := post.GetProp("title").(string)
					if title == "" {
						title = post.Id
					}
					orphaned = append(orphaned, title)
				}
			}
		}
		report.OrphanedPages = orphaned
		report.HierarchyValid = len(orphaned) == 0
		if !report.HierarchyValid {
			report.FailureReasons = append(report.FailureReasons,
				fmt.Sprintf("%d orphaned pages found", len(orphaned)))
			report.Passed = false
		}
	}

	// Check for unresolved link placeholders (content already loaded in batch)
	if postList != nil {
		var brokenLinks []BrokenLink
		for _, post := range postList.Posts {
			content := post.Message
			if content == "" {
				continue
			}

			unresolved := extractUnresolvedPlaceholders(content)
			importSourceID, _ := post.GetProp("import_source_id").(string)
			title, _ := post.GetProp("title").(string)
			if title == "" {
				title = post.Id
			}

			for _, placeholder := range unresolved {
				brokenLinks = append(brokenLinks, BrokenLink{
					PageTitle: title,
					SourceID:  importSourceID,
					TargetURL: placeholder,
					Reason:    "unresolved placeholder",
				})
			}
		}
		report.BrokenLinks = brokenLinks
		report.LinksValid = len(brokenLinks) == 0
		if !report.LinksValid {
			report.FailureReasons = append(report.FailureReasons,
				fmt.Sprintf("%d unresolved links found", len(brokenLinks)))
			report.Passed = false
		}
	}

	// Print summary
	printVerificationSummary(report)

	// Write report if output specified
	if outputPath != "" {
		data, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal report: %w", err)
		}
		if err := os.WriteFile(outputPath, data, 0644); err != nil {
			return fmt.Errorf("failed to write report: %w", err)
		}
		printer.Print(fmt.Sprintf("\nReport written to: %s", outputPath))
	}

	if !report.Passed {
		return errors.New("verification failed")
	}

	return nil
}

func wikiResolveLinksCmdF(c client.Client, command *cobra.Command, args []string) error {
	teamName, _ := command.Flags().GetString("team")
	channelName, _ := command.Flags().GetString("channel")
	dryRun, _ := command.Flags().GetBool("dry-run")

	ctx := context.TODO()

	// Get team
	team, _, err := c.GetTeamByName(ctx, teamName, "")
	if err != nil {
		return fmt.Errorf("failed to get team %q: %w", teamName, err)
	}

	// Get channel
	channel, _, err := c.GetChannelByName(ctx, channelName, team.Id, "")
	if err != nil {
		return fmt.Errorf("failed to get channel %q: %w", channelName, err)
	}

	// Get wiki for channel
	wikis, _, err := c.GetWikisForChannel(ctx, channel.Id)
	if err != nil {
		return fmt.Errorf("failed to get wikis for channel: %w", err)
	}
	if len(wikis) == 0 {
		return fmt.Errorf("no wiki found for channel %q", channelName)
	}
	wikiID := wikis[0].Id

	printer.Print("Resolving link placeholders...")
	printer.Print(fmt.Sprintf("  Team: %s", teamName))
	printer.Print(fmt.Sprintf("  Channel: %s", channelName))
	if dryRun {
		printer.Print("  Mode: DRY RUN (no changes will be made)")
	}

	// Build page mappings (confluence_id -> mattermost_id)
	pageIDMapping, err := buildPageMappings(ctx, c, channel.Id)
	if err != nil {
		return fmt.Errorf("failed to build page mappings: %w", err)
	}

	// Build file mappings (confluence_file_id -> mattermost_file_id)
	fileIDMapping, err := buildFileMappings(ctx, c, channel.Id)
	if err != nil {
		return fmt.Errorf("failed to build file mappings: %w", err)
	}

	// Get all pages with content in a single batch request (avoids N+1 API calls)
	postList, _, err := c.GetChannelPagesWithContent(ctx, channel.Id, true)
	if err != nil {
		return fmt.Errorf("failed to get channel pages: %w", err)
	}

	result := &LinkResolutionResult{}

	// Get server URL for link generation
	config, _, cerr := c.GetClientConfig(ctx, "")
	if cerr != nil {
		return fmt.Errorf("failed to get server config: %w", cerr)
	}
	serverURL := strings.TrimSuffix(config["SiteURL"], "/")
	if serverURL == "" {
		return errors.New("SiteURL is not configured on the server; cannot generate valid page links")
	}

	for _, post := range postList.Posts {
		result.PagesScanned++

		content := post.Message
		if content == "" {
			continue
		}

		if !placeholderRegex.MatchString(content) {
			continue
		}

		// Get page title from props (used for logging/display only)
		displayTitle, _ := post.GetProp("title").(string)
		if displayTitle == "" {
			displayTitle = post.Id
		}

		// Resolve placeholders (both page links and file links)
		resolved := resolvePlaceholders(content, pageIDMapping, fileIDMapping, serverURL)

		// Check if anything changed
		if resolved == content {
			unresolved := extractUnresolvedPlaceholders(content)
			result.LinksUnresolved += len(unresolved)
			for _, ph := range unresolved {
				result.UnresolvedDetails = append(result.UnresolvedDetails, UnresolvedLinkDetail{
					PageTitle:   displayTitle,
					PageID:      post.Id,
					Placeholder: ph,
				})
			}
			continue
		}

		// Count resolved links
		oldCount := len(placeholderRegex.FindAllString(content, -1))
		newCount := len(placeholderRegex.FindAllString(resolved, -1))
		result.LinksResolved += oldCount - newCount
		result.LinksUnresolved += newCount

		if !dryRun {
			// Fetch the page to get its actual title (avoid clobbering with fallback)
			existingPage, _, gerr := c.GetPage(ctx, wikiID, post.Id)
			if gerr != nil {
				return fmt.Errorf("failed to get page %s for title: %w", post.Id, gerr)
			}

			// Use actual page title from the fetched page
			actualTitle, _ := existingPage.GetProp("title").(string)
			if actualTitle == "" {
				// Fall back to displayTitle only if fetched page also has no title
				actualTitle = displayTitle
			}

			// Update page content with preserved title (baseEditAt=0 skips optimistic locking)
			_, _, uerr := c.UpdatePage(ctx, wikiID, post.Id, actualTitle, resolved, "", 0)
			if uerr != nil {
				return fmt.Errorf("failed to update page %s: %w", post.Id, uerr)
			}
		}
		result.PagesUpdated++
	}

	// Print results
	printLinkResolutionResult(result)

	if result.LinksUnresolved > 0 {
		printer.Print(fmt.Sprintf("\nWarning: %d links could not be resolved", result.LinksUnresolved))
		printer.Print("These may be links to pages that weren't included in the migration.")
	}

	if result.LinksResolved > 0 {
		if dryRun {
			printer.Print(fmt.Sprintf("\nWould resolve %d links in %d pages (dry run)", result.LinksResolved, result.PagesUpdated))
		} else {
			printer.Print(fmt.Sprintf("\nSuccessfully resolved %d links in %d pages", result.LinksResolved, result.PagesUpdated))
		}
	}

	return nil
}

func loadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}

	return &manifest, nil
}

func buildPageMappings(ctx context.Context, c client.Client, channelID string) (map[string]string, error) {
	pageIDMapping := make(map[string]string) // confluence_id -> mattermost_id

	postList, _, err := c.GetChannelPages(ctx, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get channel pages: %w", err)
	}

	for _, post := range postList.Posts {
		// Extract import_source_id from Props
		if importSourceID, ok := post.GetProp("import_source_id").(string); ok && importSourceID != "" {
			pageIDMapping[importSourceID] = post.Id
		}
	}

	return pageIDMapping, nil
}

// buildFileMappings extracts file import_source_id -> Mattermost file ID mappings from page props.
// During import, attachments with import_source_id are stored in page props as "import_file_mappings".
func buildFileMappings(ctx context.Context, c client.Client, channelID string) (map[string]string, error) {
	fileIDMapping := make(map[string]string) // confluence_file_id -> mattermost_file_id

	postList, _, err := c.GetChannelPages(ctx, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get channel pages: %w", err)
	}

	for _, post := range postList.Posts {
		// Extract import_file_mappings from Props
		if fileMappings, ok := post.GetProp("import_file_mappings").(map[string]any); ok {
			for sourceID, fileID := range fileMappings {
				if fileIDStr, ok := fileID.(string); ok && fileIDStr != "" {
					fileIDMapping[sourceID] = fileIDStr
				}
			}
		}
	}

	return fileIDMapping, nil
}

// resolvePlaceholders replaces {{CONF_PAGE_ID:xxx}} and {{CONF_FILE:xxx}} placeholders with Mattermost URLs.
// It parses the TipTap JSON structure to safely replace links without corrupting JSON.
func resolvePlaceholders(content string, pageIDToMMID map[string]string, fileIDToMMID map[string]string, baseURL string) string {
	// Try to parse as TipTap JSON first
	var doc map[string]any
	if err := json.Unmarshal([]byte(content), &doc); err == nil {
		// Successfully parsed as JSON - traverse and replace placeholders
		resolvePlaceholdersInNode(doc, pageIDToMMID, fileIDToMMID, baseURL)
		if result, err := json.Marshal(doc); err == nil {
			return string(result)
		}
	}

	// Fallback to simple regex for non-JSON content (shouldn't happen for TipTap)
	result := resolveStringPlaceholders(content, pageIDToMMID, fileIDToMMID, baseURL)
	return result
}

// resolvePlaceholdersInNode recursively traverses TipTap JSON and resolves placeholders.
// It handles:
// - text nodes: replaces placeholders in the "text" field
// - link marks: replaces placeholders in attrs.href
func resolvePlaceholdersInNode(node map[string]any, pageIDToMMID map[string]string, fileIDToMMID map[string]string, baseURL string) {
	// Handle text content in text nodes
	if text, ok := node["text"].(string); ok {
		resolved := resolveStringPlaceholders(text, pageIDToMMID, fileIDToMMID, baseURL)
		if resolved != text {
			node["text"] = resolved
		}
	}

	// Handle link marks with href attributes
	if marks, ok := node["marks"].([]any); ok {
		for _, mark := range marks {
			if markMap, ok := mark.(map[string]any); ok {
				if markType, ok := markMap["type"].(string); ok && markType == "link" {
					if attrs, ok := markMap["attrs"].(map[string]any); ok {
						if href, ok := attrs["href"].(string); ok {
							resolved := resolveStringPlaceholders(href, pageIDToMMID, fileIDToMMID, baseURL)
							if resolved != href {
								attrs["href"] = resolved
							}
						}
					}
				}
			}
		}
	}

	// Handle image/media src attributes
	if attrs, ok := node["attrs"].(map[string]any); ok {
		if src, ok := attrs["src"].(string); ok {
			resolved := resolveStringPlaceholders(src, pageIDToMMID, fileIDToMMID, baseURL)
			if resolved != src {
				attrs["src"] = resolved
			}
		}
		if href, ok := attrs["href"].(string); ok {
			resolved := resolveStringPlaceholders(href, pageIDToMMID, fileIDToMMID, baseURL)
			if resolved != href {
				attrs["href"] = resolved
			}
		}
	}

	// Recursively process child content
	if content, ok := node["content"].([]any); ok {
		for _, child := range content {
			if childMap, ok := child.(map[string]any); ok {
				resolvePlaceholdersInNode(childMap, pageIDToMMID, fileIDToMMID, baseURL)
			}
		}
	}
}

// resolveStringPlaceholders replaces all {{CONF_PAGE_ID:xxx}} and {{CONF_FILE:xxx}} placeholders in a string
func resolveStringPlaceholders(s string, pageIDToMMID map[string]string, fileIDToMMID map[string]string, baseURL string) string {
	// First resolve page placeholders
	result := pageIDRegex.ReplaceAllStringFunc(s, func(match string) string {
		submatch := pageIDRegex.FindStringSubmatch(match)
		if len(submatch) < 2 {
			return match
		}
		confID := submatch[1]
		if mmID, ok := pageIDToMMID[confID]; ok {
			return baseURL + "/pages/" + mmID
		}
		return match
	})

	// Then resolve file placeholders
	result = fileIDRegex.ReplaceAllStringFunc(result, func(match string) string {
		submatch := fileIDRegex.FindStringSubmatch(match)
		if len(submatch) < 2 {
			return match
		}
		confFileID := submatch[1]
		if mmFileID, ok := fileIDToMMID[confFileID]; ok {
			return baseURL + "/api/v4/files/" + mmFileID
		}
		return match
	})

	return result
}

func extractUnresolvedPlaceholders(content string) []string {
	return placeholderRegex.FindAllString(content, -1)
}

func printVerificationSummary(r *VerificationReport) {
	printer.Print("\n=== Verification Report ===")
	printer.Print(fmt.Sprintf("Generated: %s", r.GeneratedAt.Format(time.RFC3339)))
	printer.Print(fmt.Sprintf("Manifest: %s", r.ManifestFile))

	printer.Print("\nExpected counts:")
	printer.Print(fmt.Sprintf("  Pages: %d", r.Expected.Pages))
	printer.Print(fmt.Sprintf("  Comments: %d", r.Expected.Comments))
	printer.Print(fmt.Sprintf("  Attachments: %d", r.Expected.Attachments))

	printer.Print("\nActual counts:")
	printer.Print(fmt.Sprintf("  Pages: %d", r.Actual.Pages))
	printer.Print(fmt.Sprintf("  Comments: %d", r.Actual.Comments))
	printer.Print(fmt.Sprintf("  Attachments: %d", r.Actual.Attachments))

	if r.CountsMatch {
		printer.Print("\nCounts match: YES")
	} else {
		printer.Print("\nCounts match: NO")
	}

	if r.HierarchyValid {
		printer.Print("Hierarchy valid: YES")
	} else {
		printer.Print(fmt.Sprintf("Hierarchy valid: NO (%d orphaned pages)", len(r.OrphanedPages)))
	}

	if r.LinksValid {
		printer.Print("All links resolved: YES")
	} else {
		printer.Print(fmt.Sprintf("Unresolved links: %d", len(r.BrokenLinks)))
	}

	printer.Print("")
	if r.Passed {
		printer.Print("VERIFICATION PASSED")
	} else {
		printer.Print("VERIFICATION FAILED")
		printer.Print("Failure reasons:")
		for _, reason := range r.FailureReasons {
			printer.Print(fmt.Sprintf("  - %s", reason))
		}
	}
}

func printLinkResolutionResult(r *LinkResolutionResult) {
	printer.Print("\n=== Link Resolution Result ===")
	printer.Print(fmt.Sprintf("Pages scanned: %d", r.PagesScanned))
	printer.Print(fmt.Sprintf("Pages updated: %d", r.PagesUpdated))
	printer.Print(fmt.Sprintf("Links resolved: %d", r.LinksResolved))
	printer.Print(fmt.Sprintf("Links unresolved: %d", r.LinksUnresolved))

	if len(r.UnresolvedDetails) > 0 {
		printer.Print("\nUnresolved links:")
		for i, detail := range r.UnresolvedDetails {
			if i >= 10 {
				printer.Print(fmt.Sprintf("  ... and %d more", len(r.UnresolvedDetails)-10))
				break
			}
			printer.Print(fmt.Sprintf("  - Page %q: %s", detail.PageTitle, detail.Placeholder))
		}
	}
}
