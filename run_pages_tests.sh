#!/bin/bash

# Exit immediately if a command in a pipeline fails
set -o pipefail

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function to kill all processes and exit immediately
cleanup_on_interrupt() {
    echo ""
    echo -e "${YELLOW}Interrupt received, stopping all processes...${NC}"

    # Kill all child processes (including running tests)
    jobs -p | xargs -r kill -TERM 2>/dev/null
    pkill -TERM -P $$ 2>/dev/null

    # Give processes a moment to terminate gracefully
    sleep 0.2

    # Force kill any remaining processes
    jobs -p | xargs -r kill -KILL 2>/dev/null
    pkill -KILL -P $$ 2>/dev/null

    # Clean up temp files
    rm -f /tmp/test_counts_$$.txt /tmp/test_output.log 2>/dev/null

    echo -e "${RED}Tests interrupted by user${NC}"
    exit 130
}

# Normal cleanup on exit
cleanup_on_exit() {
    # Only clean up temp files on normal exit
    rm -f /tmp/test_counts_$$.txt 2>/dev/null
}

# Set up trap for SIGINT (CTRL+C) and SIGTERM
trap cleanup_on_interrupt SIGINT SIGTERM
trap cleanup_on_exit EXIT

# Function to display usage
usage() {
    echo "=========================================="
    echo "Pages/Wiki Feature Test Suite"
    echo "=========================================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  all, --all              Run all tests (default)"
    echo "  backend, go             Run all backend Go tests"
    echo "  frontend, jest          Run all frontend Jest tests"
    echo "  e2e, playwright         Run all E2E Playwright tests"
    echo "  mmctl                   Run mmctl E2E tests (wiki export/import)"
    echo "  model                   Run Model layer tests only"
    echo "  store                   Run Store layer tests only"
    echo "  app                     Run App layer tests only"
    echo "  api                     Run API layer tests only"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "E2E Category Options (run specific E2E test groups):"
    echo "  e2e:crud                Core CRUD operations"
    echo "  e2e:navigation          Navigation tests"
    echo "  e2e:hierarchy           Hierarchy & structure tests"
    echo "  e2e:editor              Editor & content tests"
    echo "  e2e:collaboration       Collaboration & real-time tests"
    echo "  e2e:ai                  AI feature tests"
    echo "  e2e:drafts              Drafts & version control tests"
    echo "  e2e:wiki                Wiki management tests"
    echo "  e2e:permissions         Permissions & security tests"
    echo "  e2e:integration         Integration & migration tests"
    echo "  e2e:ui                  UI & display tests"
    echo "  e2e:debug               Debug & minimal tests"
    echo "  e2e:export              Wiki export/import tests"
    echo ""
    echo "Examples:"
    echo "  $0                      # Run all tests"
    echo "  $0 backend              # Run all backend tests"
    echo "  $0 jest                 # Run all frontend tests"
    echo "  $0 playwright           # Run all E2E tests"
    echo "  $0 model store          # Run model and store tests"
    echo "  $0 backend e2e          # Run backend and E2E tests"
    echo "  $0 e2e:navigation       # Run only navigation E2E tests"
    echo "  $0 e2e:editor e2e:drafts  # Run editor and drafts E2E tests"
    echo ""
    exit 0
}

# Parse command line arguments
RUN_MODEL=false
RUN_STORE=false
RUN_APP=false
RUN_API=false
RUN_FRONTEND=false
RUN_E2E=false
RUN_MMCTL=false

# E2E category flags
E2E_CRUD=false
E2E_NAVIGATION=false
E2E_HIERARCHY=false
E2E_EDITOR=false
E2E_COLLABORATION=false
E2E_AI=false
E2E_DRAFTS=false
E2E_WIKI=false
E2E_PERMISSIONS=false
E2E_INTEGRATION=false
E2E_UI=false
E2E_DEBUG=false
E2E_EXPORT=false
E2E_CATEGORY_SPECIFIED=false

# If no arguments, run all tests (except mmctl which requires special setup)
if [ $# -eq 0 ]; then
    RUN_MODEL=true
    RUN_STORE=true
    RUN_APP=true
    RUN_API=true
    RUN_FRONTEND=true
    RUN_E2E=true
    # RUN_MMCTL=true  # Disabled by default - run with: ./run_pages_tests.sh mmctl
fi

# Parse arguments
for arg in "$@"; do
    case $arg in
        -h|--help|help)
            usage
            ;;
        all|--all)
            RUN_MODEL=true
            RUN_STORE=true
            RUN_APP=true
            RUN_API=true
            RUN_FRONTEND=true
            RUN_E2E=true
            # RUN_MMCTL=true  # Disabled by default - run with: ./run_pages_tests.sh mmctl
            ;;
        backend|go)
            RUN_MODEL=true
            RUN_STORE=true
            RUN_APP=true
            RUN_API=true
            ;;
        mmctl)
            RUN_MMCTL=true
            ;;
        frontend|jest)
            RUN_FRONTEND=true
            ;;
        e2e|playwright)
            RUN_E2E=true
            ;;
        e2e:crud)
            RUN_E2E=true
            E2E_CRUD=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:navigation)
            RUN_E2E=true
            E2E_NAVIGATION=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:hierarchy)
            RUN_E2E=true
            E2E_HIERARCHY=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:editor)
            RUN_E2E=true
            E2E_EDITOR=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:collaboration)
            RUN_E2E=true
            E2E_COLLABORATION=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:ai)
            RUN_E2E=true
            E2E_AI=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:drafts)
            RUN_E2E=true
            E2E_DRAFTS=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:wiki)
            RUN_E2E=true
            E2E_WIKI=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:permissions)
            RUN_E2E=true
            E2E_PERMISSIONS=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:integration)
            RUN_E2E=true
            E2E_INTEGRATION=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:ui)
            RUN_E2E=true
            E2E_UI=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:debug)
            RUN_E2E=true
            E2E_DEBUG=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        e2e:export)
            RUN_E2E=true
            E2E_EXPORT=true
            E2E_CATEGORY_SPECIFIED=true
            ;;
        model)
            RUN_MODEL=true
            ;;
        store)
            RUN_STORE=true
            ;;
        app)
            RUN_APP=true
            ;;
        api)
            RUN_API=true
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            echo "Use '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Pages/Wiki Feature Test Suite"
echo "=========================================="
echo ""
echo "Test configuration:"
echo "  Model layer:    $([ "$RUN_MODEL" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}SKIP${NC}")"
echo "  Store layer:    $([ "$RUN_STORE" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}SKIP${NC}")"
echo "  App layer:      $([ "$RUN_APP" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}SKIP${NC}")"
echo "  API layer:      $([ "$RUN_API" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}SKIP${NC}")"
echo "  Frontend:       $([ "$RUN_FRONTEND" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}SKIP${NC}")"
if [ "$RUN_E2E" = true ] && [ "$E2E_CATEGORY_SPECIFIED" = true ]; then
    e2e_cats=""
    [ "$E2E_CRUD" = true ] && e2e_cats="${e2e_cats}crud,"
    [ "$E2E_NAVIGATION" = true ] && e2e_cats="${e2e_cats}navigation,"
    [ "$E2E_HIERARCHY" = true ] && e2e_cats="${e2e_cats}hierarchy,"
    [ "$E2E_EDITOR" = true ] && e2e_cats="${e2e_cats}editor,"
    [ "$E2E_COLLABORATION" = true ] && e2e_cats="${e2e_cats}collaboration,"
    [ "$E2E_AI" = true ] && e2e_cats="${e2e_cats}ai,"
    [ "$E2E_DRAFTS" = true ] && e2e_cats="${e2e_cats}drafts,"
    [ "$E2E_WIKI" = true ] && e2e_cats="${e2e_cats}wiki,"
    [ "$E2E_PERMISSIONS" = true ] && e2e_cats="${e2e_cats}permissions,"
    [ "$E2E_INTEGRATION" = true ] && e2e_cats="${e2e_cats}integration,"
    [ "$E2E_UI" = true ] && e2e_cats="${e2e_cats}ui,"
    [ "$E2E_DEBUG" = true ] && e2e_cats="${e2e_cats}debug,"
    [ "$E2E_EXPORT" = true ] && e2e_cats="${e2e_cats}export,"
    e2e_cats="${e2e_cats%,}"  # Remove trailing comma
    echo -e "  E2E:            ${GREEN}${e2e_cats}${NC}"
else
    echo "  E2E:            $([ "$RUN_E2E" = true ] && echo -e "${GREEN}ALL${NC}" || echo -e "${YELLOW}SKIP${NC}")"
fi
echo "  mmctl E2E:      $([ "$RUN_MMCTL" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}SKIP${NC}")"
echo ""

failed_tests=()
passed_tests=()

# Temp file to store test counts (since bash 3.2 doesn't support associative arrays)
TEST_COUNTS_FILE="/tmp/test_counts_$$.txt"
rm -f "$TEST_COUNTS_FILE"
touch "$TEST_COUNTS_FILE"

# Function to run a test and track results
run_test() {
    local test_name=$1
    local test_command=$2

    echo -e "${YELLOW}Running: $test_name${NC}"

    # Run command - trap will handle CTRL+C and kill this and all children
    if eval "$test_command" > /tmp/test_output.log 2>&1; then
        # Extract test counts from output (for Playwright tests) - using sed for macOS compatibility
        local passed=$(LC_ALL=C sed -n 's/.* \([0-9][0-9]*\) passed.*/\1/p' /tmp/test_output.log | tail -1)
        local failed=$(LC_ALL=C sed -n 's/.* \([0-9][0-9]*\) failed.*/\1/p' /tmp/test_output.log | tail -1)
        local skipped=$(LC_ALL=C sed -n 's/.* \([0-9][0-9]*\) skipped.*/\1/p' /tmp/test_output.log | tail -1)

        passed=${passed:-0}
        failed=${failed:-0}
        skipped=${skipped:-0}
        local total=$((passed + failed + skipped))

        if [ $total -gt 0 ]; then
            echo -e "${GREEN}✓ PASSED: $passed/$total tests passed${NC}\n"
            echo "$test_name|$passed|$failed|$total" >> "$TEST_COUNTS_FILE"
        else
            echo -e "${GREEN}✓ PASSED${NC}\n"
        fi
        passed_tests+=("$test_name")
    else
        # Extract test counts even on failure
        local passed=$(LC_ALL=C sed -n 's/.* \([0-9][0-9]*\) passed.*/\1/p' /tmp/test_output.log | tail -1)
        local failed=$(LC_ALL=C sed -n 's/.* \([0-9][0-9]*\) failed.*/\1/p' /tmp/test_output.log | tail -1)
        local skipped=$(LC_ALL=C sed -n 's/.* \([0-9][0-9]*\) skipped.*/\1/p' /tmp/test_output.log | tail -1)

        passed=${passed:-0}
        failed=${failed:-0}
        skipped=${skipped:-0}
        local total=$((passed + failed + skipped))

        if [ $total -gt 0 ]; then
            echo -e "${RED}✗ FAILED: $passed/$total tests passed | $failed failed${NC}"
            echo "$test_name|$passed|$failed|$total" >> "$TEST_COUNTS_FILE"
        else
            echo -e "${RED}✗ FAILED${NC}"
        fi
        failed_tests+=("$test_name")
        echo "Error output:"
        tail -50 /tmp/test_output.log | grep -v '{"timestamp"' | grep -v '^[[:space:]]*$' | tail -30
        echo ""
    fi
}

# Store the root directory
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to server directory
cd "$ROOT_DIR/server" || exit 1

if [ "$RUN_MODEL" = true ]; then
    echo "=========================================="
    echo "MODEL LAYER TESTS"
    echo "=========================================="
    echo ""

    run_test "Model: Wiki - IsValid" "go test -v ./public/model -run '^TestWikiIsValid$'"
    run_test "Model: Wiki - JSON" "go test -v ./public/model -run '^TestWikiJSON$'"
    run_test "Model: Wiki - PreSave" "go test -v ./public/model -run '^TestWikiPreSave$'"
    run_test "Model: Wiki - PreUpdate" "go test -v ./public/model -run '^TestWikiPreUpdate$'"
    run_test "Model: PageContent - IsValid" "go test -v ./public/model -run '^TestPageContentIsValid$'"
    run_test "Model: PageContent - PreSave" "go test -v ./public/model -run '^TestPageContentPreSave$'"
    run_test "Model: PageContent - SetGetDocumentJSON" "go test -v ./public/model -run '^TestPageContentSetGetDocumentJSON$'"
    run_test "Model: Draft - IsPageDraft" "go test -v ./public/model -run '^TestDraftIsPageDraft$'"
    run_test "Model: Draft - IsValid" "go test -v ./public/model -run '^TestDraftIsValid$'"
    run_test "Model: Draft - PreSave" "go test -v ./public/model -run '^TestDraftPreSave$'"
    run_test "Model: Post - PageParentId" "go test -v ./public/model -run '^TestPostIsValidPageParentId$'"
    run_test "Model: PageUtils - ParsePageUrl" "go test -v ./public/model -run '^TestParsePageUrl$'"
    run_test "Model: PageUtils - IsPageUrl" "go test -v ./public/model -run '^TestIsPageUrl$'"
    run_test "Model: PageUtils - BuildPageUrl" "go test -v ./public/model -run '^TestBuildPageUrl$'"
    run_test "Model: PageContent - SanitizeTipTapDocument" "go test -v ./public/model -run '^TestSanitizeTipTapDocument$'"
    run_test "Model: PageContent - ExtractSimpleText" "go test -v ./public/model -run '^TestExtractSimpleText$'"
    run_test "Model: PageContent - ExtractSimpleTextWithMentions" "go test -v ./public/model -run '^TestExtractSimpleTextWithMentions$'"
    run_test "Model: PageContent - ExtractTextFromNode" "go test -v ./public/model -run '^TestExtractTextFromNode$'"
    run_test "Model: PageContent - CleanText" "go test -v ./public/model -run '^TestCleanText$'"
fi

if [ "$RUN_STORE" = true ]; then
    echo "=========================================="
    echo "STORE LAYER TESTS"
    echo "=========================================="
    echo ""

    run_test "Store: WikiStore" "go test -v ./channels/store/sqlstore -run '^TestWikiStore$'"
    run_test "Store: PageContentStore" "go test -v ./channels/store/sqlstore -run '^TestPageContentStore$'"
    run_test "Store: DraftStore" "go test -v ./channels/store/sqlstore -run '^TestDraftStore$'"
    run_test "Store: PageStore" "go test -v ./channels/store/sqlstore -run '^TestPageStore$'"
    run_test "Store: PageHierarchy - BuildCTE" "go test -v ./channels/store/sqlstore -run '^TestBuildPageHierarchyCTE$'"
    run_test "Store: PageHierarchy - CTESQLSyntax" "go test -v ./channels/store/sqlstore -run '^TestBuildPageHierarchyCTE_SQLSyntaxValidity$'"
    run_test "Store: LocalCacheLayer - PageStore" "go test -v ./channels/store/localcachelayer -run '^TestPageStore$'"
fi

if [ "$RUN_APP" = true ]; then
    echo "=========================================="
    echo "APP LAYER TESTS"
    echo "=========================================="
    echo ""

    run_test "App: Page - CreatePageWithContent" "go test -v ./channels/app -run '^TestCreatePageWithContent$'"
    run_test "App: Page - GetPageWithContent" "go test -v ./channels/app -run '^TestGetPageWithContent$'"
    run_test "App: Page - UpdatePage" "go test -v ./channels/app -run '^TestUpdatePage$'"
    run_test "App: Page - DeletePage" "go test -v ./channels/app -run '^TestDeletePage$'"
    run_test "App: Page - RestorePage" "go test -v ./channels/app -run '^TestRestorePage$'"
    run_test "App: Page - PermanentDeletePage" "go test -v ./channels/app -run '^TestPermanentDeletePage$'"
    run_test "App: Page - DuplicatePage" "go test -v ./channels/app -run '^TestDuplicatePage$'"
    run_test "App: Page - GetPageChildren" "go test -v ./channels/app -run '^TestGetPageChildren$'"
    run_test "App: Page - GetPageAncestors" "go test -v ./channels/app -run '^TestGetPageAncestors$'"
    run_test "App: Page - GetPageDescendants" "go test -v ./channels/app -run '^TestGetPageDescendants$'"
    run_test "App: Page - GetChannelPages" "go test -v ./channels/app -run '^TestGetChannelPages$'"
    run_test "App: Page - ChangePageParent" "go test -v ./channels/app -run '^TestChangePageParent$'"
    run_test "App: Page - PageDepthLimit" "go test -v ./channels/app -run '^TestPageDepthLimit$'"
    run_test "App: Page - GetPageStatus" "go test -v ./channels/app -run '^TestGetPageStatus$'"
    run_test "App: Page - SetPageStatus" "go test -v ./channels/app -run '^TestSetPageStatus$'"
    run_test "App: Page - GetPageStatusField" "go test -v ./channels/app -run '^TestGetPageStatusField$'"
    run_test "App: Page - CreatePageComment" "go test -v ./channels/app -run '^TestCreatePageComment$'"
    run_test "App: Page - CreatePageCommentReply" "go test -v ./channels/app -run '^TestCreatePageCommentReply$'"
    run_test "App: Page - CreateThreadEntryForPageComment" "go test -v ./channels/app -run '^TestCreateThreadEntryForPageComment$'"
    run_test "App: Page - HandlePageCommentThreadCreation" "go test -v ./channels/app -run '^TestHandlePageCommentThreadCreation$'"
    run_test "App: Page - ExtractMentionsFromTipTapContent" "go test -v ./channels/app -run '^TestExtractMentionsFromTipTapContent$'"
    run_test "App: Page - GetExplicitMentionsFromPage" "go test -v ./channels/app -run '^TestGetExplicitMentionsFromPage$'"
    run_test "App: Page - TipTapMentionParser_ImplementsInterface" "go test -v ./channels/app -run '^TestTipTapMentionParser_ImplementsMentionParserInterface$'"
    run_test "App: Page - TipTapMentionParser_InvalidJSON" "go test -v ./channels/app -run '^TestTipTapMentionParser_InvalidJSON$'"
    run_test "App: Page - TipTapMentionParser_ProcessText" "go test -v ./channels/app -run '^TestTipTapMentionParser_ProcessText$'"
    run_test "App: Page - PageMentionSystemMessages" "go test -v ./channels/app -run '^TestPageMentionSystemMessages$'"
    run_test "App: Page - PageVersionHistory" "go test -v ./channels/app -run '^TestPageVersionHistory$'"
    run_test "App: Page - UpdatePageWithOptimisticLocking_Success" "go test -v ./channels/app -run '^TestUpdatePageWithOptimisticLocking_Success$'"
    run_test "App: Page - UpdatePageWithOptimisticLocking_Conflict" "go test -v ./channels/app -run '^TestUpdatePageWithOptimisticLocking_Conflict$'"
    run_test "App: Page - UpdatePageWithOptimisticLocking_DeletedPage" "go test -v ./channels/app -run '^TestUpdatePageWithOptimisticLocking_DeletedPage$'"
    run_test "App: Page - UpdatePageWithOptimisticLocking_ErrorDetailsIncludeModifier" "go test -v ./channels/app -run '^TestUpdatePageWithOptimisticLocking_ErrorDetailsIncludeModifier$'"
    run_test "App: Page - ConvertPlainTextToTipTapJSON" "go test -v ./channels/app -run '^TestConvertPlainTextToTipTapJSON$'"
    run_test "App: Page - IsValidTipTapJSON" "go test -v ./channels/app -run '^TestIsValidTipTapJSON$'"
    run_test "App: Page - CreatePageContentValidation" "go test -v ./channels/app -run '^TestCreatePageContentValidation$'"
    run_test "App: Wiki - GetWikisForChannel_SoftDelete" "go test -v ./channels/app -run '^TestGetWikisForChannel_SoftDelete$'"
    run_test "App: Wiki - UpdateWiki" "go test -v ./channels/app -run '^TestUpdateWiki$'"
    run_test "App: Wiki - CreateWikiWithDefaultPage" "go test -v ./channels/app -run '^TestCreateWikiWithDefaultPage$'"
    run_test "App: Wiki - CreatePage" "go test -v ./channels/app -run '^TestCreatePage$'"
    run_test "App: Wiki - MovePageToWiki" "go test -v ./channels/app -run '^TestMovePageToWiki$'"
    run_test "App: Wiki - MoveWikiToChannel" "go test -v ./channels/app -run '^TestMoveWikiToChannel$'"
    run_test "App: Draft - CreateDraft" "go test -v ./channels/app -run '^TestCreateDraft$'"
    run_test "App: Draft - GetDraft" "go test -v ./channels/app -run '^TestGetDraft$'"
    run_test "App: Draft - UpdateDraft" "go test -v ./channels/app -run '^TestUpdateDraft$'"
    run_test "App: Draft - UpsertDraft" "go test -v ./channels/app -run '^TestUpsertDraft$'"
    run_test "App: Draft - DeleteDraft" "go test -v ./channels/app -run '^TestDeleteDraft$'"
    run_test "App: Draft - GetDraftsForUser" "go test -v ./channels/app -run '^TestGetDraftsForUser$'"
    run_test "App: Draft - PublishPageDraft" "go test -v ./channels/app -run '^TestPublishPageDraft$'"
    run_test "App: Draft - PageDraftWhenPageDeleted" "go test -v ./channels/app -run '^TestPageDraftWhenPageDeleted$'"
    run_test "App: PageDraft - SavePageDraftWithMetadata" "go test -v ./channels/app -run '^TestSavePageDraftWithMetadata$'"
    run_test "App: PageDraft - GetPageDraft" "go test -v ./channels/app -run '^TestGetPageDraft$'"
    run_test "App: PageDraft - DeletePageDraft" "go test -v ./channels/app -run '^TestDeletePageDraft$'"
    run_test "App: PageDraft - GetPageDraftsForWiki" "go test -v ./channels/app -run '^TestGetPageDraftsForWiki$'"
    run_test "App: PageDraft - CheckPageDraftExists" "go test -v ./channels/app -run '^TestCheckPageDraftExists$'"
    run_test "App: SystemMessages - WikiAdded" "go test -v ./channels/app -run '^TestSystemMessages_WikiAdded$'"
    run_test "App: SystemMessages - PageAdded" "go test -v ./channels/app -run '^TestSystemMessages_PageAdded$'"
    run_test "App: SystemMessages - PageUpdated" "go test -v ./channels/app -run '^TestSystemMessages_PageUpdated$'"
    run_test "App: PageMentions - CalculateMentionDelta" "go test -v ./channels/app -run '^TestCalculateMentionDelta$'"
    run_test "App: PageMentions - GetPreviouslyNotifiedMentions" "go test -v ./channels/app -run '^TestGetPreviouslyNotifiedMentions$'"
    run_test "App: PageMentions - SetNotifiedMentions" "go test -v ./channels/app -run '^TestSetNotifiedMentions$'"

    # page_core_test.go tests
    run_test "App: PageCore - GetPage" "go test -v ./channels/app -run '^TestGetPage$'"
    run_test "App: PageCore - GetPageWithDeleted" "go test -v ./channels/app -run '^TestGetPageWithDeleted$'"
    run_test "App: PageCore - PlainTextConversion" "go test -v ./channels/app -run '^TestPlainTextConversion$'"
    run_test "App: PageCore - GetPageVersionHistory" "go test -v ./channels/app -run '^TestGetPageVersionHistory$'"
    run_test "App: PageCore - RestorePageVersion" "go test -v ./channels/app -run '^TestRestorePageVersion$'"

    # New page_hierarchy_test.go tests
    run_test "App: PageHierarchy - BuildBreadcrumbPath" "go test -v ./channels/app -run '^TestBuildBreadcrumbPath$'"
    run_test "App: PageHierarchy - CalculateMaxDepthFromPostList" "go test -v ./channels/app -run '^TestCalculateMaxDepthFromPostList$'"
    run_test "App: PageHierarchy - CalculatePageDepth" "go test -v ./channels/app -run '^TestCalculatePageDepth$'"
    run_test "App: PageHierarchy - CalculateSubtreeMaxDepth" "go test -v ./channels/app -run '^TestCalculateSubtreeMaxDepth$'"

    # New page_core_test.go tests
    run_test "App: PageCore - LoadPageContent" "go test -v ./channels/app -run '^TestLoadPageContent$'"
    run_test "App: PageCore - GetPageActiveEditors" "go test -v ./channels/app -run '^TestGetPageActiveEditors$'"
    run_test "App: PageCore - ExtractFileIdsFromContent" "go test -v ./channels/app -run '^TestExtractFileIdsFromContent$'"
    run_test "App: PageCore - CreatePageAttachesFiles" "go test -v ./channels/app -run '^TestCreatePageAttachesFiles$'"
    run_test "App: PageCore - UpdatePageAttachesFiles" "go test -v ./channels/app -run '^TestUpdatePageAttachesFiles$'"
    run_test "App: PageCore - UpdatePageWithOptimisticLockingAttachesFiles" "go test -v ./channels/app -run '^TestUpdatePageWithOptimisticLockingAttachesFiles$'"

    # New page_draft_test.go tests
    run_test "App: PageDraft - UpsertPageDraft" "go test -v ./channels/app -run '^TestUpsertPageDraft$'"
    run_test "App: PageDraft - MovePageDraft" "go test -v ./channels/app -run '^TestMovePageDraft$'"

    # New wiki_test.go tests
    run_test "App: Wiki - GetWiki" "go test -v ./channels/app -run '^TestGetWiki$'"
    run_test "App: Wiki - GetWikiPages" "go test -v ./channels/app -run '^TestGetWikiPages$'"
    run_test "App: Wiki - DeleteWiki" "go test -v ./channels/app -run '^TestDeleteWiki$'"
    run_test "App: Wiki - GetWikiIdForPage" "go test -v ./channels/app -run '^TestGetWikiIdForPage$'"
    run_test "App: Wiki - AddPageToWiki" "go test -v ./channels/app -run '^TestAddPageToWiki$'"

    # wiki_export_test.go tests
    run_test "App: WikiExport - BulkExportEmptyChannelIds" "go test -v ./channels/app -run '^TestWikiBulkExportEmptyChannelIds$'"
    run_test "App: WikiExport - BulkExportVersionLine" "go test -v ./channels/app -run '^TestWikiBulkExportVersionLine$'"
    run_test "App: WikiExport - WriteExportLine" "go test -v ./channels/app -run '^TestWriteExportLine$'"

    # New page_comments_test.go tests
    run_test "App: PageComments - GetPageComments" "go test -v ./channels/app -run '^TestGetPageComments$'"
    run_test "App: PageComments - ResolvePageComment" "go test -v ./channels/app -run '^TestResolvePageComment$'"
    run_test "App: PageComments - UnresolvePageComment" "go test -v ./channels/app -run '^TestUnresolvePageComment$'"
    run_test "App: PageComments - CanResolvePageComment" "go test -v ./channels/app -run '^TestCanResolvePageComment$'"
    run_test "App: PageComments - TransformPageCommentReply" "go test -v ./channels/app -run '^TestTransformPageCommentReply$'"

    # New page_bookmarks_test.go tests
    run_test "App: PageBookmarks - CreateBookmarkFromPage" "go test -v ./channels/app -run '^TestCreateBookmarkFromPage$'"

    # New page_notifications_test.go tests
    run_test "App: PageNotifications - HandlePageUpdateNotification" "go test -v ./channels/app -run '^TestHandlePageUpdateNotification$'"
    run_test "App: PageNotifications - CreateNewPageUpdateNotification" "go test -v ./channels/app -run '^TestCreateNewPageUpdateNotification$'"

    # import_wiki_functions_test.go tests
    run_test "App: Import - ImportImportWiki" "go test -v ./channels/app -run '^TestImportImportWiki$'"
    run_test "App: Import - ImportImportPage" "go test -v ./channels/app -run '^TestImportImportPage$'"
    run_test "App: Import - ImportImportPageComment" "go test -v ./channels/app -run '^TestImportImportPageComment$'"
    run_test "App: Import - ImportUpdatePostPropsFromImport" "go test -v ./channels/app -run '^TestImportUpdatePostPropsFromImport$'"
    run_test "App: Import - ImportPageWithMissingParent" "go test -v ./channels/app -run '^TestImportPageWithMissingParent$'"
    run_test "App: Import - GetPostsByTypeAndProps" "go test -v ./channels/app -run '^TestGetPostsByTypeAndProps$'"
    run_test "App: Import - ImportPageWithNestedComments" "go test -v ./channels/app -run '^TestImportPageWithNestedComments$'"
    run_test "App: Import - ImportThreadedCommentReplies" "go test -v ./channels/app -run '^TestImportThreadedCommentReplies$'"
    run_test "App: Import - ImportPageWithAttachments" "go test -v ./channels/app -run '^TestImportPageWithAttachments$'"
    run_test "App: Import - ImportWikiEndToEnd" "go test -v ./channels/app -run '^TestImportWikiEndToEnd$'"
    run_test "App: Import - ResolvePageTitlePlaceholders" "go test -v ./channels/app -run '^TestResolvePageTitlePlaceholders$'"
    run_test "App: Import - ResolvePageIDPlaceholders" "go test -v ./channels/app -run '^TestResolvePageIDPlaceholders$'"
    run_test "App: Import - CleanupUnresolvedPlaceholders" "go test -v ./channels/app -run '^TestCleanupUnresolvedPlaceholders$'"
    run_test "App: Import - RepairOrphanedPageHierarchy" "go test -v ./channels/app -run '^TestRepairOrphanedPageHierarchy$'"
fi

if [ "$RUN_API" = true ]; then
    echo "=========================================="
    echo "API LAYER TESTS"
    echo "=========================================="
    echo ""

    run_test "API: Wiki - CreateWiki" "go test -v ./channels/api4 -run '^TestCreateWiki$'"
    run_test "API: Wiki - GetWiki" "go test -v ./channels/api4 -run '^TestGetWiki$'"
    run_test "API: Wiki - ListChannelWikis" "go test -v ./channels/api4 -run '^TestListChannelWikis$'"
    run_test "API: Wiki - UpdateWiki" "go test -v ./channels/api4 -run '^TestUpdateWiki$'"
    run_test "API: Wiki - DeleteWiki" "go test -v ./channels/api4 -run '^TestDeleteWiki$'"
    run_test "API: Wiki - GetPages" "go test -v ./channels/api4 -run '^TestGetPages$'"
    run_test "API: Wiki - GetPage" "go test -v ./channels/api4 -run '^TestGetPage$'"
    run_test "API: Wiki - CrossChannelAccess" "go test -v ./channels/api4 -run '^TestCrossChannelAccess$'"
    run_test "API: Wiki - WikiValidation" "go test -v ./channels/api4 -run '^TestWikiValidation$'"
    run_test "API: Wiki - WikiPermissions" "go test -v ./channels/api4 -run '^TestWikiPermissions$'"
    run_test "API: Wiki - PageDraftToPublishE2E" "go test -v ./channels/api4 -run '^TestPageDraftToPublishE2E$'"
    run_test "API: Wiki - PagePublishWebSocketEvent" "go test -v ./channels/api4 -run '^TestPagePublishWebSocketEvent$'"
    run_test "API: Wiki - CreatePage (wiki_test)" "go test -v ./channels/api4 -run '^TestCreatePage$'"
    run_test "API: Wiki - CreatePageViaWikiApi" "go test -v ./channels/api4 -run '^TestCreatePageViaWikiApi$'"
    run_test "API: Wiki - GetPageBreadcrumb" "go test -v ./channels/api4 -run '^TestGetPageBreadcrumb$'"
    run_test "API: Wiki - DuplicatePage" "go test -v ./channels/api4 -run '^TestDuplicatePage$'"
    run_test "API: Wiki - UpdatePageParent" "go test -v ./channels/api4 -run '^TestUpdatePageParent$'"
    run_test "API: Wiki - PagePermissionMatrix" "go test -v ./channels/api4 -run '^TestPagePermissionMatrix$'"
    run_test "API: Wiki - PagePermissionsMultiUser" "go test -v ./channels/api4 -run '^TestPagePermissionsMultiUser$'"
    run_test "API: Wiki - PageGuestPermissions" "go test -v ./channels/api4 -run '^TestPageGuestPermissions$'"
    run_test "API: Wiki - MultiUserPageEditing" "go test -v ./channels/api4 -run '^TestMultiUserPageEditing$'"
    run_test "API: Wiki - ConcurrentPageHierarchyOperations" "go test -v ./channels/api4 -run '^TestConcurrentPageHierarchyOperations$'"
    run_test "API: Wiki - MovePageToWiki" "go test -v ./channels/api4 -run '^TestMovePageToWiki$'"
    run_test "API: Post - GetChannelPagesPermissions" "go test -v ./channels/api4 -run '^TestGetChannelPagesPermissions$'"
    run_test "API: Drafts - PageDraftPermissions" "go test -v ./channels/api4 -run '^TestPageDraftPermissions$'"
    run_test "API: Wiki - PageCommentsE2E" "go test -v ./channels/api4 -run '^TestPageCommentsE2E$'"
    run_test "API: Wiki - ResolvePageComment" "go test -v ./channels/api4 -run '^TestResolvePageComment$'"
    run_test "API: Page - UpdatePageStatus" "go test -v ./channels/api4 -run '^TestUpdatePageStatus$'"
    run_test "API: Page - GetPageStatus" "go test -v ./channels/api4 -run '^TestGetPageStatus$'"
    run_test "API: Page - GetPageStatusField" "go test -v ./channels/api4 -run '^TestGetPageStatusField$'"
    run_test "API: Page - GetPageActiveEditors" "go test -v ./channels/api4 -run '^TestGetPageActiveEditors$'"
    run_test "API: Wiki - PublishPageDraft_OptimisticLocking_Returns409" "go test -v ./channels/api4 -run '^TestPublishPageDraft_OptimisticLocking_Returns409$'"
    run_test "API: Wiki - PublishPageDraft_OptimisticLocking_Success" "go test -v ./channels/api4 -run '^TestPublishPageDraft_OptimisticLocking_Success$'"
    run_test "API: Wiki - PublishPageDraft_WrongBaseEditAtReturns409" "go test -v ./channels/api4 -run '^TestPublishPageDraft_WrongBaseEditAtReturns409$'"
    run_test "API: Wiki - SearchPages" "go test -v ./channels/api4 -run '^TestSearchPages$'"
    run_test "API: Wiki - PageDraftPermissionViolations" "go test -v ./channels/api4 -run '^TestPageDraftPermissionViolations$'"
    run_test "API: Wiki - WikiPermissionViolations" "go test -v ./channels/api4 -run '^TestWikiPermissionViolations$'"

    # page_api_test.go tests
    run_test "API: Page - GetChannelPages" "go test -v ./channels/api4 -run '^TestGetChannelPages$'"
    run_test "API: Page - GetPageComments" "go test -v ./channels/api4 -run '^TestGetPageComments$'"
    run_test "API: Page - CreatePage" "go test -v ./channels/api4 -run '^TestCreatePage$'"
    run_test "API: Page - UpdatePage" "go test -v ./channels/api4 -run '^TestUpdatePage$'"
    run_test "API: Page - DeletePage" "go test -v ./channels/api4 -run '^TestDeletePage$'"
    run_test "API: Page - RestorePage" "go test -v ./channels/api4 -run '^TestRestorePage$'"
    run_test "API: Page - GetWikiPage" "go test -v ./channels/api4 -run '^TestGetWikiPage$'"
fi

if [ "$RUN_FRONTEND" = true ]; then
    # Change to webapp directory for frontend tests
    cd "$ROOT_DIR/webapp/channels" || exit 1

    echo "=========================================="
    echo "FRONTEND TESTS"
    echo "=========================================="
    echo ""

    # --- Components: Pages Hierarchy Panel ---
    run_test "Frontend: Components - heading_node" "npm run test -- src/components/pages_hierarchy_panel/heading_node.test.tsx --silent"
    run_test "Frontend: Components - page_tree_node" "npm run test -- src/components/pages_hierarchy_panel/page_tree_node.test.tsx --silent"
    run_test "Frontend: Components - page_tree_view" "npm run test -- src/components/pages_hierarchy_panel/page_tree_view.test.tsx --silent"
    run_test "Frontend: Components - pages_hierarchy_panel" "npm run test -- src/components/pages_hierarchy_panel/pages_hierarchy_panel.test.tsx --silent"
    run_test "Frontend: Components - page_actions_menu" "npm run test -- src/components/pages_hierarchy_panel/page_actions_menu.test.tsx --silent"

    # --- Components: Pages Hierarchy Panel - Utils ---
    run_test "Frontend: Utils - tree_builder" "npm run test -- src/components/pages_hierarchy_panel/utils/tree_builder.test.ts --silent"

    # --- Components: Wiki View ---
    run_test "Frontend: Components - wiki_view" "npm run test -- src/components/wiki_view/wiki_view.test.tsx --silent"
    run_test "Frontend: Components - wiki_view_hooks" "npm run test -- src/components/wiki_view/hooks.test.ts --silent"
    run_test "Frontend: Components - page_anchor" "npm run test -- src/components/wiki_view/page_anchor.test.ts --silent"
    run_test "Frontend: Components - page_breadcrumb" "npm run test -- src/components/wiki_view/page_breadcrumb/page_breadcrumb.test.tsx --silent"
    run_test "Frontend: Components - page_status_selector" "npm run test -- src/components/wiki_view/page_status_selector/page_status_selector.test.tsx --silent"

    # --- Components: Wiki Page Header ---
    run_test "Frontend: Components - wiki_page_header" "npm run test -- src/components/wiki_view/wiki_page_header/wiki_page_header.test.tsx --silent"
    run_test "Frontend: Components - translation_indicator" "npm run test -- src/components/wiki_view/wiki_page_header/translation_indicator.test.tsx --silent"

    # --- Components: Wiki Page Editor ---
    run_test "Frontend: Components - wiki_page_editor" "npm run test -- src/components/wiki_view/wiki_page_editor/wiki_page_editor.test.tsx --silent"
    run_test "Frontend: Components - tiptap_editor" "npm run test -- src/components/wiki_view/wiki_page_editor/tiptap_editor.test.tsx --silent"
    run_test "Frontend: Components - formatting_actions" "npm run test -- src/components/wiki_view/wiki_page_editor/formatting_actions.test.ts --silent"
    run_test "Frontend: Components - callout_extension" "npm run test -- src/components/wiki_view/wiki_page_editor/callout_extension.test.ts --silent"
    run_test "Frontend: Components - video_extension" "npm run test -- src/components/wiki_view/wiki_page_editor/video_extension.test.ts --silent"
    run_test "Frontend: Components - file_attachment_extension" "npm run test -- src/components/wiki_view/wiki_page_editor/file_attachment_extension.test.ts --silent"
    run_test "Frontend: Components - file_attachment_node_view" "npm run test -- src/components/wiki_view/wiki_page_editor/file_attachment_node_view.test.tsx --silent"
    run_test "Frontend: Components - file_upload_helper" "npm run test -- src/components/wiki_view/wiki_page_editor/file_upload_helper.test.ts --silent"
    run_test "Frontend: Components - channel_mention_mm_bridge" "npm run test -- src/components/wiki_view/wiki_page_editor/channel_mention_mm_bridge.test.tsx --silent"
    run_test "Frontend: Components - comment_anchor_mark" "npm run test -- src/components/wiki_view/wiki_page_editor/comment_anchor_mark.test.ts --silent"
    run_test "Frontend: Components - use_page_rewrite" "npm run test -- src/components/wiki_view/wiki_page_editor/use_page_rewrite.test.tsx --silent"
    run_test "Frontend: Components - slash_command_menu" "npm run test -- src/components/wiki_view/wiki_page_editor/slash_command_menu.test.tsx --silent"
    run_test "Frontend: Components - link_bubble_menu" "npm run test -- src/components/wiki_view/wiki_page_editor/link_bubble_menu.test.tsx --silent"
    run_test "Frontend: Components - paste_markdown_extension" "npm run test -- src/components/wiki_view/wiki_page_editor/paste_markdown_extension.test.ts --silent"

    # --- Components: Wiki Page Editor - AI ---
    run_test "Frontend: Components - ai_tools_dropdown" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/ai_tools_dropdown.test.tsx --silent"
    run_test "Frontend: Components - proofread_action" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/proofread_action.test.ts --silent"
    run_test "Frontend: Components - translate_page_modal" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/translate_page_modal.test.tsx --silent"
    run_test "Frontend: Components - image_ai_bubble" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/image_ai_bubble.test.tsx --silent"
    run_test "Frontend: Components - image_extraction_dialog" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/image_extraction_dialog.test.tsx --silent"
    run_test "Frontend: Components - image_extraction_complete_dialog" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/image_extraction_complete_dialog.test.tsx --silent"

    # --- Components: Wiki Page Editor - AI Utils ---
    run_test "Frontend: Utils - content_validator" "npm run test -- src/components/wiki_view/wiki_page_editor/ai_utils/content_validator.test.ts --silent"
    run_test "Frontend: Utils - tiptap_reassembler" "npm run test -- src/components/wiki_view/wiki_page_editor/ai_utils/tiptap_reassembler.test.ts --silent"
    run_test "Frontend: Utils - tiptap_text_extractor" "npm run test -- src/components/wiki_view/wiki_page_editor/ai_utils/tiptap_text_extractor.test.ts --silent"

    # --- Components: Wiki RHS ---
    run_test "Frontend: Components - wiki_rhs" "npm run test -- src/components/wiki_rhs/wiki_rhs.test.tsx --silent"
    run_test "Frontend: Components - wiki_new_comment_view" "npm run test -- src/components/wiki_rhs/wiki_new_comment_view.test.tsx --silent"
    run_test "Frontend: Components - all_wiki_threads" "npm run test -- src/components/wiki_rhs/all_wiki_threads.test.tsx --silent"
    run_test "Frontend: Components - wiki_page_thread_viewer" "npm run test -- src/components/wiki_rhs/wiki_page_thread_viewer.test.tsx --silent"

    # --- Components: Modals ---
    run_test "Frontend: Components - page_link_modal" "npm run test -- src/components/page_link_modal/page_link_modal.test.tsx --silent"
    run_test "Frontend: Components - delete_page_modal" "npm run test -- src/components/delete_page_modal/delete_page_modal.test.tsx --silent"
    run_test "Frontend: Components - move_page_modal" "npm run test -- src/components/move_page_modal/move_page_modal.test.tsx --silent"
    run_test "Frontend: Components - wiki_delete_modal" "npm run test -- src/components/wiki_delete_modal/wiki_delete_modal.test.tsx --silent"
    run_test "Frontend: Components - move_wiki_modal" "npm run test -- src/components/move_wiki_modal/move_wiki_modal.test.tsx --silent"
    run_test "Frontend: Components - page_version_history_modal" "npm run test -- src/components/page_version_history/page_version_history_modal.test.tsx --silent"
    run_test "Frontend: Components - unsaved_draft_modal" "npm run test -- src/components/unsaved_draft_modal/unsaved_draft_modal.test.tsx --silent"
    run_test "Frontend: Components - conflict_warning_modal" "npm run test -- src/components/conflict_warning_modal/conflict_warning_modal.test.tsx --silent"
    run_test "Frontend: Components - text_input_modal" "npm run test -- src/components/text_input_modal/text_input_modal.test.tsx --silent"

    # --- Components: Other ---
    run_test "Frontend: Components - active_editors_indicator" "npm run test -- src/components/active_editors_indicator/active_editors_indicator.test.tsx --silent"
    run_test "Frontend: Components - inline_comment_context" "npm run test -- src/components/inline_comment_context/inline_comment_context.test.tsx --silent"
    run_test "Frontend: Components - post_search_results_item" "npm run test -- src/components/search_results/post_search_results_item.test.tsx --silent"

    # --- Hooks ---
    run_test "Frontend: Hooks - usePageMenuHandlers" "npm run test -- src/components/pages_hierarchy_panel/hooks/usePageMenuHandlers.test.ts --silent"
    run_test "Frontend: Hooks - useActiveEditors" "npm run test -- src/hooks/useActiveEditors.test.ts --silent"
    run_test "Frontend: Hooks - usePageComments" "npm run test -- src/hooks/usePageComments.test.ts --silent"
    run_test "Frontend: Hooks - usePageDraft" "npm run test -- src/hooks/usePageDraft.test.ts --silent"
    run_test "Frontend: Hooks - usePublishedDraftCleanup" "npm run test -- src/hooks/usePublishedDraftCleanup.test.ts --silent"
    run_test "Frontend: Hooks - useVisionCapability" "npm run test -- src/components/common/hooks/useVisionCapability.test.ts --silent"
    run_test "Frontend: Hooks - use_page_translate" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/use_page_translate.test.tsx --silent"
    run_test "Frontend: Hooks - use_page_proofread" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/use_page_proofread.test.tsx --silent"
    run_test "Frontend: Hooks - use_image_ai" "npm run test -- src/components/wiki_view/wiki_page_editor/ai/use_image_ai.test.tsx --silent"

    # --- Actions ---
    run_test "Frontend: Actions - pages" "npm run test -- src/actions/pages.test.ts --silent"
    run_test "Frontend: Actions - page_drafts" "npm run test -- src/actions/page_drafts.test.ts --silent"
    run_test "Frontend: Actions - wiki_actions" "npm run test -- src/actions/wiki_actions.test.ts --silent"
    run_test "Frontend: Actions - wiki_edit" "npm run test -- src/actions/wiki_edit.test.ts --silent"

    # --- Actions/Views ---
    run_test "Frontend: Actions/Views - create_page_comment" "npm run test -- src/actions/views/create_page_comment.test.ts --silent"
    run_test "Frontend: Actions/Views - pages_hierarchy" "npm run test -- src/actions/views/pages_hierarchy.test.ts --silent"
    run_test "Frontend: Actions/Views - wiki_rhs" "npm run test -- src/actions/views/wiki_rhs.test.ts --silent"

    # --- Redux Actions ---
    run_test "Frontend: Redux Actions - active_editors" "npm run test -- src/packages/mattermost-redux/src/actions/active_editors.test.ts --silent"
    run_test "Frontend: Redux Actions - page_threads" "npm run test -- src/packages/mattermost-redux/src/actions/page_threads.test.ts --silent"
    run_test "Frontend: Redux Actions - wikis" "npm run test -- src/packages/mattermost-redux/src/actions/wikis.test.ts --silent"

    # --- Reducers ---
    run_test "Frontend: Reducers - wiki_pages" "npm run test -- src/packages/mattermost-redux/src/reducers/entities/wiki_pages.test.ts --silent"
    run_test "Frontend: Reducers - wikis" "npm run test -- src/packages/mattermost-redux/src/reducers/entities/wikis.test.ts --silent"
    run_test "Frontend: Reducers - active_editors" "npm run test -- src/packages/mattermost-redux/src/reducers/entities/active_editors.test.ts --silent"
    run_test "Frontend: Reducers - wiki_requests" "npm run test -- src/packages/mattermost-redux/src/reducers/requests/wiki.test.ts --silent"
    run_test "Frontend: Reducers - rhs" "npm run test -- src/reducers/views/rhs.test.js --silent"

    # --- Reducers/Views ---
    run_test "Frontend: Reducers/Views - pages_hierarchy" "npm run test -- src/reducers/views/pages_hierarchy.test.ts --silent"
    run_test "Frontend: Reducers/Views - wiki_rhs" "npm run test -- src/reducers/views/wiki_rhs.test.ts --silent"

    # --- Selectors ---
    run_test "Frontend: Selectors - pages" "npm run test -- src/selectors/pages.test.ts --silent"
    run_test "Frontend: Selectors - page_drafts" "npm run test -- src/selectors/page_drafts.test.ts --silent"
    run_test "Frontend: Selectors - pages_hierarchy" "npm run test -- src/selectors/pages_hierarchy.test.ts --silent"
    run_test "Frontend: Selectors - wiki_posts" "npm run test -- src/selectors/wiki_posts.test.ts --silent"
    run_test "Frontend: Selectors - wiki_rhs" "npm run test -- src/selectors/wiki_rhs.test.ts --silent"
    run_test "Frontend: Selectors - active_editors" "npm run test -- src/packages/mattermost-redux/src/selectors/entities/active_editors.test.ts --silent"

    # --- Utils ---
    run_test "Frontend: Utils - page_outline" "npm run test -- src/utils/page_outline.test.ts --silent"
    run_test "Frontend: Utils - draft_autosave" "npm run test -- src/utils/draft_autosave.test.ts --silent"
    run_test "Frontend: Utils - tiptap_to_markdown" "npm run test -- src/utils/tiptap_to_markdown.test.ts --silent"
    run_test "Frontend: Utils - markdown_roundtrip" "npm run test -- src/utils/markdown_roundtrip.test.ts --silent"
    run_test "Frontend: Utils - markdown_full_roundtrip" "npm run test -- src/utils/markdown_full_roundtrip.test.ts --silent"

    # --- Components: Wiki Page Editor - Additional ---
    run_test "Frontend: Components - emoticon_mm_bridge" "npm run test -- src/components/wiki_view/wiki_page_editor/emoticon_mm_bridge.test.tsx --silent"
    run_test "Frontend: Components - suggestion_renderer" "npm run test -- src/components/wiki_view/wiki_page_editor/suggestion_renderer.test.tsx --silent"
fi

if [ "$RUN_E2E" = true ]; then
    # Change to e2e-tests directory for Playwright tests
    cd "$ROOT_DIR/e2e-tests/playwright" || exit 1

    echo "=========================================="
    echo "E2E TESTS (PLAYWRIGHT)"
    echo "=========================================="
    echo ""

    echo -e "${YELLOW}Note: E2E tests require a running Mattermost server${NC}"
    echo -e "${YELLOW}If server is not running, E2E tests will be skipped${NC}"
    echo ""

    # Check if server is running (port 8065)
    if curl -s http://localhost:8065/api/v4/system/ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is running on localhost:8065${NC}"
        echo ""

        # Helper function to check if category should run
        should_run_category() {
            local category=$1
            # If no category specified, run all
            if [ "$E2E_CATEGORY_SPECIFIED" = false ]; then
                return 0
            fi
            # Check specific category flag
            case $category in
                crud) [ "$E2E_CRUD" = true ] ;;
                navigation) [ "$E2E_NAVIGATION" = true ] ;;
                hierarchy) [ "$E2E_HIERARCHY" = true ] ;;
                editor) [ "$E2E_EDITOR" = true ] ;;
                collaboration) [ "$E2E_COLLABORATION" = true ] ;;
                ai) [ "$E2E_AI" = true ] ;;
                drafts) [ "$E2E_DRAFTS" = true ] ;;
                wiki) [ "$E2E_WIKI" = true ] ;;
                permissions) [ "$E2E_PERMISSIONS" = true ] ;;
                integration) [ "$E2E_INTEGRATION" = true ] ;;
                ui) [ "$E2E_UI" = true ] ;;
                debug) [ "$E2E_DEBUG" = true ] ;;
                export) [ "$E2E_EXPORT" = true ] ;;
                *) return 1 ;;
            esac
        }

        # Show which categories will run
        if [ "$E2E_CATEGORY_SPECIFIED" = true ]; then
            echo "E2E categories to run:"
            [ "$E2E_CRUD" = true ] && echo "  - CRUD"
            [ "$E2E_NAVIGATION" = true ] && echo "  - Navigation"
            [ "$E2E_HIERARCHY" = true ] && echo "  - Hierarchy"
            [ "$E2E_EDITOR" = true ] && echo "  - Editor"
            [ "$E2E_COLLABORATION" = true ] && echo "  - Collaboration"
            [ "$E2E_AI" = true ] && echo "  - AI"
            [ "$E2E_DRAFTS" = true ] && echo "  - Drafts"
            [ "$E2E_WIKI" = true ] && echo "  - Wiki"
            [ "$E2E_PERMISSIONS" = true ] && echo "  - Permissions"
            [ "$E2E_INTEGRATION" = true ] && echo "  - Integration"
            [ "$E2E_UI" = true ] && echo "  - UI"
            [ "$E2E_DEBUG" = true ] && echo "  - Debug"
            [ "$E2E_EXPORT" = true ] && echo "  - Export"
            echo ""
        fi

        # --- Core CRUD & Navigation ---
        if should_run_category crud; then
            run_test "E2E: CRUD Operations" "npm run test -- pages_crud --project=chrome"
        fi
        if should_run_category navigation; then
            run_test "E2E: Navigation" "npm run test -- pages_navigation --project=chrome"
            run_test "E2E: Anchor Navigation" "npm run test -- pages_anchor_navigation --project=chrome"
            run_test "E2E: Search" "npm run test -- pages_search --project=chrome"
            run_test "E2E: Bookmarks" "npm run test -- pages_bookmarks --project=chrome"
        fi

        # --- Hierarchy & Structure ---
        if should_run_category hierarchy; then
            run_test "E2E: Hierarchy" "npm run test -- pages_hierarchy.spec.ts --project=chrome"
            run_test "E2E: Hierarchy - Drag and Drop" "npm run test -- pages_drag_drop.spec.ts --project=chrome"
            run_test "E2E: Hierarchy - Outline" "npm run test -- pages_hierarchy_outline.spec.ts --project=chrome"
            run_test "E2E: Large Hierarchy" "npm run test -- pages_large_hierarchy --project=chrome"
            run_test "E2E: Duplicate Pages" "npm run test -- pages_duplicate --project=chrome"
        fi

        # --- Editor & Content ---
        if should_run_category editor; then
            run_test "E2E: Editor" "npm run test -- pages_editor --project=chrome"
            run_test "E2E: Editor Resilience" "npm run test -- pages_editor_resilience --project=chrome"
            run_test "E2E: Formatting" "npm run test -- pages_formatting --project=chrome"
            run_test "E2E: Callout Extension" "npm run test -- pages_callout --project=chrome"
            run_test "E2E: Emoji" "npm run test -- pages_emoji --project=chrome"
            run_test "E2E: Mentions" "npm run test -- pages_mentions --project=chrome"
            run_test "E2E: Link Bubble Menu" "npm run test -- pages_link_bubble --project=chrome"
            run_test "E2E: Slash Commands" "npm run test -- pages_slash_commands --project=chrome"
            run_test "E2E: File Attachment" "npm run test -- pages_file_attachment --project=chrome"
            run_test "E2E: Video Upload" "npm run test -- pages_video_upload --project=chrome"
            run_test "E2E: External Image Paste" "npm run test -- pages_external_image_paste --project=chrome"
            run_test "E2E: Paste Markdown" "npm run test -- pages_paste_markdown --project=chrome"
        fi

        # --- Collaboration & Real-time ---
        if should_run_category collaboration; then
            run_test "E2E: Active Editors" "npm run test -- pages_active_editors --project=chrome"
            run_test "E2E: Concurrent Editing" "npm run test -- pages_concurrent_editing --project=chrome"
            run_test "E2E: Real-Time Sync" "npm run test -- pages_realtime_sync --project=chrome"
            run_test "E2E: Real-Time Hierarchy Updates" "npm run test -- pages_realtime_hierarchy --project=chrome"
            run_test "E2E: Real-Time Wiki Creation" "npm run test -- pages_wiki_realtime_creation --project=chrome"
            run_test "E2E: Real-Time Moves (Wiki/Page)" "npm run test -- pages_realtime_moves --project=chrome"
            run_test "E2E: Comments" "npm run test -- pages_comments --project=chrome"
            run_test "E2E: Threads & Threading" "npm run test -- pages_threads --project=chrome"
            run_test "E2E: Inline Comment RHS" "npm run test -- page_inline_comment_rhs --project=chrome"
        fi

        # --- AI Features ---
        if should_run_category ai; then
            run_test "E2E: AI Rewrite" "npm run test -- pages_ai_rewrite --project=chrome"
            run_test "E2E: Image AI" "npm run test -- pages_image_ai --project=chrome"
            run_test "E2E: Translation" "npm run test -- pages_translation --project=chrome"
            run_test "E2E: Summarize" "npm run test -- pages_summarize --project=chrome"
        fi

        # --- Drafts & Version Control ---
        if should_run_category drafts; then
            run_test "E2E: Drafts" "npm run test -- pages_drafts --project=chrome"
            run_test "E2E: Version History" "npm run test -- pages_version_history --project=chrome"
            run_test "E2E: Page Status" "npm run test -- pages_status --project=chrome"
        fi

        # --- Wiki Management ---
        if should_run_category wiki; then
            run_test "E2E: Wiki Management (Rename/Delete)" "npm run test -- pages_wiki_management --project=chrome"
            run_test "E2E: Rename (Content Preservation)" "npm run test -- pages_rename --project=chrome"
            run_test "E2E: Cross-Wiki Operations" "npm run test -- pages_cross_wiki --project=chrome"
        fi

        # --- Permissions & Security ---
        if should_run_category permissions; then
            run_test "E2E: Permissions" "npm run test -- pages_permissions --project=chrome"
            run_test "E2E: Data Integrity & Security" "npm run test -- pages_data_integrity --project=chrome"
        fi

        # --- Integration & Migration ---
        if should_run_category integration; then
            run_test "E2E: Integration Workflows" "npm run test -- pages_integration --project=chrome"
            run_test "E2E: Publish Confluence Content" "npm run test -- pages_publish_confluence_content --project=chrome"
            run_test "E2E: PDF Export" "npm run test -- pages_pdf_export --project=chrome"
            run_test "E2E: Markdown Export" "npm run test -- page_markdown_export --project=chrome"
            run_test "E2E: Markdown Round-Trip" "npm run test -- page_markdown_roundtrip --project=chrome"
        fi

        # --- UI & Display ---
        if should_run_category ui; then
            run_test "E2E: Author Avatar Display" "npm run test -- pages_author_avatar --project=chrome"
            run_test "E2E: Browser Edge Cases" "npm run test -- pages_browser_edge_cases --project=chrome"
            run_test "E2E: Modal Reopen" "npm run test -- pages_modal_reopen --project=chrome"
            run_test "E2E: Page Activity Consolidation" "npm run test -- page_consolidation --project=chrome"
        fi

        # --- Debug & Minimal Tests ---
        if should_run_category debug; then
            run_test "E2E: Navigation - Isolated Debug Tests" "npm run test -- pages_navigation_isolated --project=chrome"
            run_test "E2E: Outline - Minimal (Debug)" "npm run test -- test_outline_minimal --project=chrome"
            run_test "E2E: Outline - Navigation (Debug)" "npm run test -- test_outline_navigation --project=chrome"
        fi

        # --- Wiki Export/Import ---
        if should_run_category export; then
            run_test "E2E: Wiki Export/Import" "npm run test -- wiki_export --project=chrome"
        fi
    else
        echo -e "${YELLOW}⚠ Server not detected on localhost:8065${NC}"
        echo -e "${YELLOW}Skipping E2E tests (requires running server)${NC}"
        echo ""
        echo "To run E2E tests:"
        echo "  1. Start server: cd server && make run"
        echo "  2. Re-run this script"
        echo ""
    fi
fi

if [ "$RUN_MMCTL" = true ]; then
    # Change back to server directory for mmctl tests
    cd "$ROOT_DIR/server" || exit 1

    echo "=========================================="
    echo "MMCTL E2E TESTS (Wiki Export/Import)"
    echo "=========================================="
    echo ""

    echo -e "${YELLOW}Note: mmctl E2E tests require a running Mattermost server with job scheduler${NC}"
    echo -e "${YELLOW}These tests create jobs and wait for completion, which requires active schedulers${NC}"
    echo ""

    # Check if server is running (port 8065)
    if curl -s http://localhost:8065/api/v4/system/ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is running on localhost:8065${NC}"
        echo ""

        # Run permission test (doesn't require job completion)
        run_test "mmctl: WikiExportJobPermissions" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiExportJobPermissions' -timeout 120s"

        # Job-based tests (require job scheduler)
        echo -e "${YELLOW}Running job-based tests (may timeout if scheduler not active)...${NC}"
        run_test "mmctl: WikiExportJob" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiExportJob' -timeout 180s"
        run_test "mmctl: WikiImportJob" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiImportJob' -timeout 180s"
        run_test "mmctl: WikiExportImportComprehensive" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiExportImportComprehensive' -timeout 300s"
        run_test "mmctl: WikiExportWithAttachments" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiExportWithAttachments' -timeout 180s"
        run_test "mmctl: WikiExportMultipleChannels" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiExportMultipleChannels' -timeout 180s"
        run_test "mmctl: WikiVerifyCommand" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiVerifyCommand' -timeout 120s"
        run_test "mmctl: WikiResolveLinksCommand" "go test -v -tags e2e ./cmd/mmctl/commands -run 'TestMmctlE2ESuite/TestWikiResolveLinksCommand' -timeout 120s"
    else
        echo -e "${YELLOW}⚠ Server not detected on localhost:8065${NC}"
        echo -e "${YELLOW}Skipping mmctl E2E tests (requires running server with job scheduler)${NC}"
        echo ""
        echo "To run mmctl E2E tests:"
        echo "  1. Start server with job scheduler: cd server && make run"
        echo "  2. Re-run this script"
        echo ""
    fi
fi

echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}Passed: ${#passed_tests[@]}${NC}"
for test in "${passed_tests[@]}"; do
    # Look up counts from temp file
    counts=$(grep "^$test|" "$TEST_COUNTS_FILE" 2>/dev/null)
    if [ -n "$counts" ]; then
        passed=$(echo "$counts" | cut -d'|' -f2)
        failed=$(echo "$counts" | cut -d'|' -f3)
        echo -e "  ${GREEN}✓${NC} $test - ${passed} PASS ${failed} FAIL"
    else
        echo -e "  ${GREEN}✓${NC} $test"
    fi
done
echo ""

if [ ${#failed_tests[@]} -gt 0 ]; then
    echo -e "${RED}Failed: ${#failed_tests[@]}${NC}"
    for test in "${failed_tests[@]}"; do
        # Look up counts from temp file
        counts=$(grep "^$test|" "$TEST_COUNTS_FILE" 2>/dev/null)
        if [ -n "$counts" ]; then
            passed=$(echo "$counts" | cut -d'|' -f2)
            failed=$(echo "$counts" | cut -d'|' -f3)
            echo -e "  ${RED}✗${NC} $test - ${passed} PASS ${failed} FAIL"
        else
            echo -e "  ${RED}✗${NC} $test"
        fi
    done
    echo ""
    echo "To debug failures, run individual tests:"
    echo ""
    echo "  Backend:"
    echo "    cd server"
    echo "    go test -v ./channels/api4 -run TestWiki"
    echo "    go test -v ./channels/app -run TestPage"
    echo ""
    echo "  Frontend:"
    echo "    cd webapp/channels"
    echo "    npm run test -- src/selectors/pages.test.ts"
    echo ""
    echo "  E2E (Playwright):"
    echo "    cd e2e-tests/playwright"
    echo ""
    echo "    # Core CRUD & Navigation"
    echo "    npm run test -- pages_crud --project=chrome"
    echo "    npm run test -- pages_navigation --project=chrome"
    echo "    npm run test -- pages_anchor_navigation --project=chrome"
    echo "    npm run test -- pages_search --project=chrome"
    echo "    npm run test -- pages_bookmarks --project=chrome"
    echo ""
    echo "    # Hierarchy & Structure"
    echo "    npm run test -- pages_hierarchy --project=chrome"
    echo "    npm run test -- pages_drag_drop --project=chrome"
    echo "    npm run test -- pages_hierarchy_outline --project=chrome"
    echo "    npm run test -- pages_large_hierarchy --project=chrome"
    echo "    npm run test -- pages_duplicate --project=chrome"
    echo ""
    echo "    # Editor & Content"
    echo "    npm run test -- pages_editor --project=chrome"
    echo "    npm run test -- pages_editor_resilience --project=chrome"
    echo "    npm run test -- pages_formatting --project=chrome"
    echo "    npm run test -- pages_callout --project=chrome"
    echo "    npm run test -- pages_emoji --project=chrome"
    echo "    npm run test -- pages_mentions --project=chrome"
    echo "    npm run test -- pages_link_bubble --project=chrome"
    echo "    npm run test -- pages_slash_commands --project=chrome"
    echo "    npm run test -- pages_file_attachment --project=chrome"
    echo "    npm run test -- pages_video_upload --project=chrome"
    echo "    npm run test -- pages_external_image_paste --project=chrome"
    echo "    npm run test -- pages_paste_markdown --project=chrome"
    echo ""
    echo "    # Collaboration & Real-time"
    echo "    npm run test -- pages_active_editors --project=chrome"
    echo "    npm run test -- pages_concurrent_editing --project=chrome"
    echo "    npm run test -- pages_realtime_sync --project=chrome"
    echo "    npm run test -- pages_realtime_hierarchy --project=chrome"
    echo "    npm run test -- pages_wiki_realtime_creation --project=chrome"
    echo "    npm run test -- pages_realtime_moves --project=chrome"
    echo "    npm run test -- pages_comments --project=chrome"
    echo "    npm run test -- pages_threads --project=chrome"
    echo "    npm run test -- page_inline_comment_rhs --project=chrome"
    echo ""
    echo "    # AI Features"
    echo "    npm run test -- pages_ai_rewrite --project=chrome"
    echo "    npm run test -- pages_image_ai --project=chrome"
    echo "    npm run test -- pages_translation --project=chrome"
    echo "    npm run test -- pages_summarize --project=chrome"
    echo ""
    echo "    # Drafts & Version Control"
    echo "    npm run test -- pages_drafts --project=chrome"
    echo "    npm run test -- pages_version_history --project=chrome"
    echo "    npm run test -- pages_status --project=chrome"
    echo ""
    echo "    # Wiki Management"
    echo "    npm run test -- pages_wiki_management --project=chrome"
    echo "    npm run test -- pages_rename --project=chrome"
    echo "    npm run test -- pages_cross_wiki --project=chrome"
    echo ""
    echo "    # Permissions & Security"
    echo "    npm run test -- pages_permissions --project=chrome"
    echo "    npm run test -- pages_data_integrity --project=chrome"
    echo ""
    echo "    # Integration & Migration"
    echo "    npm run test -- pages_integration --project=chrome"
    echo "    npm run test -- pages_publish_confluence_content --project=chrome"
    echo "    npm run test -- pages_pdf_export --project=chrome"
    echo "    npm run test -- page_markdown_export --project=chrome"
    echo "    npm run test -- page_markdown_roundtrip --project=chrome"
    echo ""
    echo "    # UI & Display"
    echo "    npm run test -- pages_author_avatar --project=chrome"
    echo "    npm run test -- pages_browser_edge_cases --project=chrome"
    echo "    npm run test -- pages_modal_reopen --project=chrome"
    echo "    npm run test -- page_consolidation --project=chrome"
    echo ""
    echo "    # Debug & Minimal Tests"
    echo "    npm run test -- pages_navigation_isolated --project=chrome"
    echo "    npm run test -- test_outline_minimal --project=chrome"
    echo "    npm run test -- test_outline_navigation --project=chrome"
    echo ""
    echo "    # Wiki Export/Import"
    echo "    npm run test -- wiki_export --project=chrome"
    echo ""
    rm -f "$TEST_COUNTS_FILE"
    exit 1
else
    echo -e "${GREEN}All ${#passed_tests[@]} tests passed!${NC}"
    echo ""
    rm -f "$TEST_COUNTS_FILE"
    exit 0
fi
