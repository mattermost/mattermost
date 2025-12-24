# Mattermost Web Vitals

Automated testing with [Lighthouse](https://developer.chrome.com/docs/lighthouse/) to measure Core Web Vitals and ensure the web application meets performance standards.

## Features

- **Multi-page testing**: Login, Channels, Admin Console
- **Statistical analysis**: Multiple runs with median, stdDev, percentiles
- **Baseline comparison**: Track performance regressions over time
- **Web Vitals thresholds**: Google's Core Web Vitals pass/fail criteria
- **Server info tracking**: Version, build number, build hash in baselines
- **Desktop emulation**: 1350x940 viewport, no throttling for localhost

## Quick Start

### Option 1: Against Existing Server

```bash
# Install dependencies
npm install

# Run on login page (default)
npm run lh

# Run on all pages
npm run lh:all

# Create baseline (10 runs for statistical accuracy)
npm run baseline
```

### Option 2: Using Docker (Recommended for CI)

From the `e2e-tests` directory:

```bash
# Start Mattermost server with Docker (no test containers)
TEST=none make

# Run Lighthouse tests (creates admin user, runs tests, saves baseline)
make run-lh

# Stop server when done
make stop-server
```

## Usage

### Basic Commands

```bash
# Single page tests
npm run lh:login      # Login page
npm run lh:channels   # Channels page (requires auth)
npm run lh:admin      # Admin console (requires auth)
npm run lh:all        # All pages

# With options
npm run lh -- --runs=5              # 5 iterations with stats
npm run lh -- --setup-auth          # Create auth session first
npm run lh -- --url=http://localhost:8065/custom --auth
```

### Creating Baselines

```bash
# Default: 10 runs on all pages
npm run baseline

# Custom baseline
npm run lh -- --all --runs=10 --baseline
```

## Baseline System

### How Baselines Work

The baseline system enables statistical comparison of performance metrics across different test runs. It uses multiple iterations to account for natural variance in performance measurements.

### Creating a Baseline

When you run with `--baseline` flag:

1. **Multiple runs**: Lighthouse runs N times (default: 10) on each page
2. **Statistical analysis**: For each metric, calculates:
    - **Median**: The middle value (more stable than mean)
    - **Standard deviation (stdDev)**: Measure of variance
    - **Coefficient of variation (CV)**: stdDev/mean as percentage
    - **Min/Max**: Range of observed values
    - **Bounds**: Statistical bounds (median ± 2×stdDev)
3. **Metadata capture**: Records machine info (CPU, RAM, OS) and server info (version, build hash)
4. **File output**: Saves to `baseline/latest_perf.json` and `baseline/<version>_perf.json`

```bash
# Create baseline with 10 runs (recommended for accuracy)
npm run lh -- --all --runs=10 --baseline

# Baseline is saved to:
# - baseline/latest_perf.json (used for comparisons)
# - baseline/11.3.0_perf.json (versioned backup)
```

### Comparing Against Baseline

When you run tests without `--baseline`, results are automatically compared against `baseline/latest_perf.json`:

1. **Load baseline**: Reads the latest baseline file
2. **Calculate distance**: For each metric, computes how many standard deviations the current value differs from baseline median
3. **Apply thresholds**: Uses both statistical bounds AND Google's Web Vitals thresholds

```bash
# Run tests and compare against baseline
npm run lh:all

# Output shows comparison:
#   LCP: 0.85s (baseline: 0.80s [0.76-0.84]) 🟡 ↑ +0.05s (+6.3%)
#        ^current  ^median   ^bounds        ^status ^delta
```

### Comparison Algorithm

The comparison uses a two-factor evaluation:

**Statistical Analysis (based on stdDev distance):**

| Distance from Baseline | Status     |
| ---------------------- | ---------- |
| < -2 stdDev (better)   | improved   |
| -2 to +2 stdDev        | acceptable |
| +2 to +3 stdDev        | warning    |
| +3 to +4 stdDev        | regressed  |

**Web Vitals Thresholds (absolute limits):**

- If a metric exceeds Google's "Poor" threshold → failed
- If a metric exceeds "Needs Improvement" threshold → warning

The final status is the worse of the two evaluations.

### Best Practices

1. **Create baselines on consistent hardware**: Same machine, same conditions
2. **Use sufficient runs**: 10+ runs for stable baselines (reduces noise)
3. **Update baselines intentionally**: After confirmed improvements or expected changes
4. **Version your baselines**: The tool automatically saves versioned copies
5. **Compare on similar conditions**: Development vs development, CI vs CI

### Docker-based Testing

The Makefile provides a convenient way to run lighthouse tests against a fresh Mattermost server:

```bash
cd e2e-tests

# Full workflow
TEST=none make       # Start server without test containers
make run-lh          # Run lighthouse tests
make stop-server     # Clean up

# Custom configuration via environment variables
LIGHTHOUSE_RUNS=10 LIGHTHOUSE_PAGES="--login" make run-lh
```

The `run-lh` target:

1. Creates an admin user via mmctl
2. Creates a default team and adds the admin user
3. Configures server settings
4. Uploads license (if `MM_LICENSE` is set)
5. Runs Lighthouse tests with baseline generation
6. Saves results and baselines

## Environment Variables

| Variable            | Default                          | Description                            |
| ------------------- | -------------------------------- | -------------------------------------- |
| `MM_BASE_URL`       | `http://localhost:8065`          | Mattermost server URL                  |
| `MM_ADMIN_USERNAME` | `sysadmin`                       | Admin username for auth                |
| `MM_ADMIN_PASSWORD` | `Sys@dmin-sample1`               | Admin password for auth                |
| `MM_ADMIN_EMAIL`    | `sysadmin@sample.mattermost.com` | Admin email                            |
| `MM_LICENSE`        | -                                | License string (for CI)                |
| `DOCKER_IMAGE_TAG`  | -                                | Docker image tag for baseline tracking |
| `MM_DOCKER_IMAGE`   | -                                | Alternative Docker image env var       |
| `LIGHTHOUSE_RUNS`   | `10` (workflow) / `5` (script)   | Number of runs per page                |
| `LIGHTHOUSE_PAGES`  | `--all`                          | Pages to test                          |

## Baseline Format

The baseline JSON (version from package.json) includes:

- **Machine info**: Platform, CPU, RAM, Node version
- **Server info**: Version, build number, build date, hashes
- **Statistical metrics**: median, stdDev, CV, min, max, bounds

### Status Indicators

| Emoji | Status     | Meaning                                            |
| ----- | ---------- | -------------------------------------------------- |
| 🟢    | improved   | > 2 stdDev better than baseline                    |
| 🟡    | acceptable | Within ± 2 stdDev (normal variation)               |
| 🟠    | warning    | 2-3 stdDev worse OR Web Vitals "Needs Improvement" |
| 🔴    | regressed  | > 3 stdDev worse than baseline                     |
| ❌    | failed     | Web Vitals "Poor" threshold exceeded               |

See [Web Vitals Grading System](#web-vitals-grading-system) for threshold values.

## Output Files

```
lighthouse/
├── baseline/
│   ├── latest_perf.json      # Current baseline (used for comparison)
│   └── <version>_perf.json   # Versioned backup (e.g., 11.3.0_perf.json)
├── results/                  # Lighthouse HTML/JSON reports (gitignored)
├── storage_state/            # Auth session files (gitignored)
└── src/                      # Source code
```

## CI Integration

### GitHub Actions Pipeline

The repository includes a GitHub Actions workflow (`.github/workflows/lighthouse.yml`) that:

- **Triggers automatically** after E2E Smoketests complete successfully
- **Manual dispatch** available with custom commit SHA, server image, and run count
- Spins up a Mattermost server via Docker
- Runs Lighthouse tests on all pages (login, channels, admin_console)
- Sets commit status and uploads results as artifacts

### Pipeline Pass/Fail Criteria

The CI pipeline uses **Web Vitals grading** to determine pass/fail status:

| Overall Grade | Pipeline Status | Condition                                           |
| ------------- | --------------- | --------------------------------------------------- |
| **PASS**      | Success         | All pages have all metrics in "Good" range          |
| **WARN**      | Success         | Some metrics in "Needs Improvement" but none "Poor" |
| **FAIL**      | Failure         | Any metric on any page exceeds "Poor" threshold     |

**Key points:**

- A single metric exceeding Google's "Poor" threshold causes the pipeline to **FAIL**
- "Needs Improvement" metrics result in **WARN** but the pipeline still passes
- The commit status shows which pages have issues and their specific metrics

**Example output:**

```
Overall Web Vitals: [PASS]
   login: WARN
      - LCP: 2.80s (needs improvement, threshold: 2.5s)
   channels: PASS
   admin_console: WARN
      - SI: 4.20s (needs improvement, threshold: 3.4s)
```

### Web Vitals Grading System

Each page is graded based on Google's Core Web Vitals thresholds:

| Metric                             | Good    | Needs Improvement | Poor    |
| ---------------------------------- | ------- | ----------------- | ------- |
| **LCP** (Largest Contentful Paint) | < 2.5s  | 2.5s - 4.0s       | > 4.0s  |
| **FCP** (First Contentful Paint)   | < 1.8s  | 1.8s - 3.0s       | > 3.0s  |
| **TBT** (Total Blocking Time)      | < 200ms | 200ms - 600ms     | > 600ms |
| **CLS** (Cumulative Layout Shift)  | < 0.1   | 0.1 - 0.25        | > 0.25  |
| **SI** (Speed Index)               | < 3.4s  | 3.4s - 5.8s       | > 5.8s  |
| **TTI** (Time to Interactive)      | < 3.8s  | 3.8s - 7.3s       | > 7.3s  |

**Page grading logic:**

- **PASS**: All 6 metrics are in "Good" range
- **WARN**: At least one metric is "Needs Improvement", but none are "Poor"
- **FAIL**: At least one metric is in "Poor" range

**Overall grading logic:**

- **PASS**: All pages are PASS or WARN (no failures)
- **FAIL**: Any page is FAIL

### Baseline Comparison (Optional)

The baseline system is **separate from the CI pass/fail criteria**. While Web Vitals grading determines pipeline success, baseline comparison provides additional insights for tracking performance trends over time.

**When to use baselines:**

1. **Regression detection**: Compare current results against known-good performance
2. **Release validation**: Verify new versions don't degrade performance
3. **Environment comparison**: Compare different server configurations
4. **Trend analysis**: Track performance changes across commits

**How baseline comparison works:**

```bash
# Create a baseline (saves to baseline/latest_perf.json)
npm run lh -- --all --runs=10 --baseline

# Future runs automatically compare against baseline
npm run lh:all

# Output shows both Web Vitals grade AND baseline comparison:
#   [PASS] LCP: 0.85s (baseline: 0.80s [0.76-0.84]), ↑ +0.05s (+6.3%)
```

**Baseline comparison status indicators:**

| Status     | Meaning                         | Action                            |
| ---------- | ------------------------------- | --------------------------------- |
| improved   | > 2 stdDev better than baseline | Performance improved              |
| acceptable | Within ± 2 stdDev               | Normal variation                  |
| warning    | 2-3 stdDev worse                | Investigate potential regression  |
| regressed  | > 3 stdDev worse                | Likely regression, review changes |

**Note:** Baseline comparison does NOT affect CI pipeline pass/fail. Only Web Vitals "Poor" thresholds cause pipeline failures. The baseline system is purely informational for tracking performance trends.

### Manual CI Setup

For custom CI pipelines:

```bash
cd e2e-tests

# Set environment variables
export SERVER_IMAGE="mattermostdevelopment/mattermost-enterprise-edition:master"
export MM_LICENSE="your-license-string"
export LIGHTHOUSE_RUNS=10
export LIGHTHOUSE_PAGES="--all"

# Run the full workflow
TEST=none make
make run-lh
make stop-server

# Check exit code: 0 = PASS/WARN, 1 = FAIL
echo "Exit code: $?"
```

Results will be in:

- `lighthouse/results/grades.json` - Pass/fail summary for CI status
- `lighthouse/results/*_results.json` - Detailed metrics per page
- `lighthouse/results/*.html` - Lighthouse HTML reports
- `lighthouse/baseline/latest_perf.json` - Baseline for comparison (if created)
