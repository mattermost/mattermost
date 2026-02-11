# @mattermost/testcontainers

CLI and library for spinning up Mattermost test environments using Docker containers. Handles automatic port allocation, networking, health checks, and dependency orchestration so you can focus on testing.

## Requirements

- **Docker** running locally
- **Node.js** 24+

## Install

```bash
npm install @mattermost/testcontainers
```

Or run directly with npx:

```bash
npx @mattermost/testcontainers start
```

## Quick Start

Start a Mattermost server with PostgreSQL and Inbucket (email):

```bash
mattermost-testcontainers start
```

This starts three containers on a shared Docker network, waits for health checks, configures default test settings via mmctl, and prints connection info:

```
Connection Information:
=======================
Mattermost:      http://localhost:34025
PostgreSQL:      postgres://mmuser:mostest@localhost:34015/mattermost_test?sslmode=disable
Inbucket:        http://localhost:34016
```

Stop everything:

```bash
mattermost-testcontainers stop
```

## CLI Commands

### `start`

Start the test environment.

```bash
mattermost-testcontainers start [options]
```

| Option                    | Description                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-e, --edition <edition>` | Server edition: `enterprise` (default), `fips`, `team`                                                                                                                   |
| `-t, --tag <tag>`         | Image tag (e.g., `master`, `release-11.4`)                                                                                                                               |
| `-D, --deps <deps>`       | Additional dependencies, comma-separated: `openldap`, `keycloak`, `minio`, `elasticsearch`, `opensearch`, `redis`, `dejavu`, `prometheus`, `grafana`, `loki`, `promtail` |
| `--deps-only`             | Start dependencies only (no Mattermost server)                                                                                                                           |
| `--ha`                    | High-availability mode (3-node cluster with nginx)                                                                                                                       |
| `--subpath`               | Subpath mode (two servers at `/mattermost1` and `/mattermost2`)                                                                                                          |
| `--entry`                 | Mattermost Entry tier                                                                                                                                                    |
| `--esr`                   | Use the current ESR (Extended Support Release) version (see [`src/config/esr.ts`](src/config/esr.ts))                                                                    |
| `--admin [username]`      | Create admin user (default: `sysadmin`)                                                                                                                                  |
| `--admin-password <pw>`   | Admin password (default: `Sys@dmin-sample1`)                                                                                                                             |
| `-E, --env <KEY=value>`   | Environment variable for Mattermost (repeatable)                                                                                                                         |
| `--env-file <path>`       | Env file for Mattermost server variables                                                                                                                                 |
| `-S, --service-env <env>` | Service environment: `test` (default), `production`, `dev`                                                                                                               |
| `-c, --config <path>`     | Path to config file                                                                                                                                                      |
| `-o, --output-dir <dir>`  | Output directory (default: `.tc.out`)                                                                                                                                    |

### `stop`

Stop all containers from the current session.

```bash
mattermost-testcontainers stop
```

### `restart`

Restart all containers. Stops Mattermost first, restarts dependencies, waits for readiness, then starts Mattermost.

```bash
mattermost-testcontainers restart
```

### `rm`

Stop and remove containers from the current session.

```bash
mattermost-testcontainers rm [-y]
```

### `rm-all`

Remove **all** testcontainers resources (finds containers and networks with the `org.testcontainers=true` Docker label).

```bash
mattermost-testcontainers rm-all [-y]
```

### `upgrade`

Upgrade Mattermost to a new image tag in-place (preserves network, ports, environment).

```bash
mattermost-testcontainers upgrade -t release-11.5
```

### `info`

Display available dependencies, configuration options, and examples.

```bash
mattermost-testcontainers info
```

## CLI Examples

### Basic Server

```bash
# Default enterprise edition, master tag
mattermost-testcontainers start

# Specific version
mattermost-testcontainers start -t release-11.4

# Team edition
mattermost-testcontainers start -e team -t release-11.4

# ESR version (currently 10.11)
mattermost-testcontainers start --esr

# With admin user
mattermost-testcontainers start --admin sysadmin --admin-password 'Sys@dmin-sample1'
```

### With Additional Dependencies

```bash
# Add LDAP
mattermost-testcontainers start -D openldap

# Add S3 storage and search
mattermost-testcontainers start -D minio,elasticsearch

# Full stack (requires MM_LICENSE)
mattermost-testcontainers start -D openldap,minio,elasticsearch,redis,keycloak

# Monitoring stack
mattermost-testcontainers start -D prometheus,grafana,loki,promtail
```

### HA Mode (3-Node Cluster)

Requires `MM_LICENSE` environment variable.

```bash
export MM_LICENSE="your-license-string"

# HA cluster with nginx load balancer
mattermost-testcontainers start --ha

# HA with dependencies
mattermost-testcontainers start --ha -D minio,elasticsearch,redis
```

Output:

```
Mattermost HA:   http://localhost:34025 (nginx load balancer)
  Cluster: mm_test_cluster
  leader: http://localhost:34026
  follower: http://localhost:34027
  follower2: http://localhost:34028
```

### Subpath Mode (Two Servers Behind Nginx)

Two independent servers behind a single nginx reverse proxy. Server 1 (`/mattermost1`) is fully configurable. Server 2 (`/mattermost2`) is a bare, unconfigured instance with its own database.

```bash
# Basic subpath
mattermost-testcontainers start --subpath

# Subpath with admin on server1 only
mattermost-testcontainers start --subpath --admin

# Subpath with HA server1 (requires MM_LICENSE)
mattermost-testcontainers start --subpath --ha

# Subpath with dependencies on server1
mattermost-testcontainers start --subpath -D minio,openldap
```

Output:

```
Mattermost:      http://localhost:34063 (nginx with subpaths)
  Server 1:      http://localhost:34063/mattermost1
    Direct: http://localhost:34064
  Server 2:      http://localhost:34063/mattermost2 (bare)
    Direct: http://localhost:34067
```

### Dependencies Only (Local Development)

Start only the dependencies and run Mattermost locally:

```bash
mattermost-testcontainers start --deps-only

# Source the generated env file, then run your local server
source .tc.out/.env.tc
make run-server
```

### Environment Variables and Feature Flags

```bash
# Set feature flags
mattermost-testcontainers start -E MM_FEATUREFLAGS_MOVETHREADSENABLED=true

# Multiple env vars
mattermost-testcontainers start \
  -E MM_SERVICESETTINGS_ENABLEOPENSERVER=false \
  -E MM_TEAMSETTINGS_MAXUSERSPERTEAM=50

# From env file
mattermost-testcontainers start --env-file ./test.env
```

## Configuration File

Create `mattermost-testcontainers.config.mjs` in your project root:

```javascript
import {defineConfig} from '@mattermost/testcontainers';

export default defineConfig({
    server: {
        edition: 'enterprise',
        tag: 'release-11.4',
        ha: false,
        subpath: false,
        env: {
            MM_FEATUREFLAGS_MOVETHREADSENABLED: 'true',
        },
        config: {
            ServiceSettings: {
                EnableOpenServer: false,
            },
            TeamSettings: {
                MaxUsersPerTeam: 50,
            },
        },
    },
    dependencies: ['postgres', 'inbucket', 'openldap', 'minio'],
    admin: {
        username: 'sysadmin',
        password: 'Sys@dmin-sample1',
    },
});
```

JSONC format is also supported as `mattermost-testcontainers.config.jsonc`.

### Configuration Priority

Settings are resolved from multiple sources. When the same setting is defined in more than one source, the highest-priority source wins.

| Priority    | Source                | Example                                                  |
| ----------- | --------------------- | -------------------------------------------------------- |
| 1 (highest) | CLI flags             | `--edition team`, `-t release-11.4`, `-D openldap,minio` |
| 2           | Environment variables | `TC_EDITION=team`, `TC_SERVER_TAG=release-11.4`          |
| 3           | Config file           | `mattermost-testcontainers.config.mjs` or `.jsonc`       |
| 4 (lowest)  | Built-in defaults     | enterprise edition, `master` tag, postgres + inbucket    |

For example, if your config file sets `server.tag: 'release-11.4'` but you run with `-t master`, the CLI flag wins and the `master` tag is used.

**Special cases:**

- `MM_LICENSE` must come from an environment variable — it cannot be set in the config file (rejected to prevent accidental commits).
- `TC_SERVER_IMAGE` overrides the computed edition + tag image entirely (e.g., `TC_SERVER_IMAGE=myregistry/custom:latest`).
- `-D` / `TC_DEPENDENCIES` **adds to** dependencies from the config file rather than replacing them.

### Configuration Reference

| Key                         | Type       | Default                    | Description                               |
| --------------------------- | ---------- | -------------------------- | ----------------------------------------- |
| `server.edition`            | `string`   | `'enterprise'`             | `enterprise`, `fips`, or `team`           |
| `server.tag`                | `string`   | `'master'`                 | Docker image tag                          |
| `server.ha`                 | `boolean`  | `false`                    | Enable HA mode                            |
| `server.subpath`            | `boolean`  | `false`                    | Enable subpath mode                       |
| `server.entry`              | `boolean`  | `false`                    | Enable Entry tier                         |
| `server.serviceEnvironment` | `string`   | `'test'`                   | `test`, `production`, or `dev`            |
| `server.imageMaxAgeHours`   | `number`   | `24`                       | Max hours before re-pulling `:master` tag |
| `server.env`                | `object`   | `{}`                       | Mattermost `MM_*` environment variables   |
| `server.config`             | `object`   | `{}`                       | Server config patches (applied via mmctl) |
| `dependencies`              | `string[]` | `['postgres', 'inbucket']` | Enabled dependencies                      |
| `images`                    | `object`   | `{}`                       | Override default container images         |
| `outputDir`                 | `string`   | `'.tc.out'`                | Output directory                          |
| `admin.username`            | `string`   | —                          | Admin username to create                  |
| `admin.password`            | `string`   | `'Sys@dmin-sample1'`       | Admin password                            |

### Default Images

Default container images for all services are defined in [`src/config/default_images.ts`](src/config/default_images.ts). These match the versions used by the upstream Mattermost docker-compose test configuration. See the file for the full list of images and their versions.

### Image Overrides

Override default images in the config file:

```javascript
export default defineConfig({
    images: {
        postgres: 'postgres:16',
        mattermost: 'mattermostdevelopment/mattermost-enterprise-edition:release-11.5',
    },
});
```

Or via environment variables: `TC_POSTGRES_IMAGE`, `TC_MINIO_IMAGE`, `TC_SERVER_IMAGE`, etc.

## Using in Tests

### Approach 1: Embedded (Playwright)

Import `MattermostTestEnvironment` in your global setup. The environment starts before tests and stops after. Gated by an environment variable so it's opt-in.

**`global-setup.ts`** (actual pattern used by `e2e-tests/playwright`):

```typescript
import {discoverAndLoadConfig, MattermostTestEnvironment} from '@mattermost/testcontainers';

let environment: MattermostTestEnvironment | null = null;

export default async function globalSetup() {
    // Only start containers when PW_TC=true
    if (process.env.PW_TC === 'true') {
        const config = await discoverAndLoadConfig();
        environment = new MattermostTestEnvironment(config);
        await environment.start();

        // Set base URL for Playwright
        process.env.PW_BASE_URL = environment.getServerUrl();
    }

    // ... other setup (admin user creation, etc.)

    // Return teardown function — Playwright calls this after all tests
    return async function globalTeardown() {
        if (environment) {
            await environment.stop();
            environment = null;
        }
    };
}
```

**`playwright.config.ts`**:

```typescript
import {defineConfig} from '@playwright/test';

export default defineConfig({
    globalSetup: './global-setup.ts',
    use: {
        baseURL: process.env.PW_BASE_URL || 'http://localhost:8065',
    },
});
```

**Run with testcontainers**:

```bash
PW_TC=true npx playwright test
```

### Approach 2: Separate Script (Cypress, etc.)

Start the environment as a separate process before running tests. The CLI writes connection info to `.tc.out/` which your tests can read.

**`package.json`**:

```json
{
    "scripts": {
        "test:setup": "mattermost-testcontainers start --admin",
        "test:teardown": "mattermost-testcontainers stop",
        "test:run": "cypress run",
        "test": "npm run test:setup && npm run test:run; npm run test:teardown"
    }
}
```

**Read connection info in Cypress** (`cypress.config.ts`):

```typescript
import {defineConfig} from 'cypress';
import * as fs from 'fs';

// Read container info written by the CLI
const dockerInfo = JSON.parse(fs.readFileSync('.tc.out/.tc.docker.json', 'utf-8'));
const mmContainer = dockerInfo.containers.mattermost || dockerInfo.containers['mattermost-server1'];
const serverUrl = mmContainer?.url || 'http://localhost:8065';

export default defineConfig({
    e2e: {
        baseUrl: serverUrl,
    },
    env: {
        // Pass connection info to tests
        INBUCKET_URL: dockerInfo.containers.inbucket
            ? `http://${dockerInfo.containers.inbucket.host}:${dockerInfo.containers.inbucket.webPort}`
            : undefined,
    },
});
```

**Or source the env file**:

```bash
# Start environment
mattermost-testcontainers start --admin

# Source environment variables
source .tc.out/.env.tc

# Run tests with env vars available
cypress run
```

### Approach 3: Programmatic (Node.js Test Scripts)

Use the library API for full control in custom test scripts:

```typescript
import {MattermostTestEnvironment, discoverAndLoadConfig} from '@mattermost/testcontainers';

async function main() {
    const config = await discoverAndLoadConfig({
        overrides: {
            dependencies: ['postgres', 'inbucket', 'openldap'],
            admin: {username: 'sysadmin'},
        },
    });

    const env = new MattermostTestEnvironment(config);
    await env.start();

    const serverUrl = env.getServerUrl();
    console.log(`Server running at ${serverUrl}`);

    // Access specific service info
    const pgInfo = env.getPostgresInfo();
    console.log(`PostgreSQL: ${pgInfo.connectionString}`);

    // Run mmctl commands
    const mmctl = env.getMmctl();
    await mmctl.exec('user create --email test@test.com --username testuser --password Test123! --system-admin');

    // ... run your tests ...

    await env.stop();
}

main().catch(console.error);
```

## Environment Variables

| Variable                 | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `MM_LICENSE`             | Enterprise license (required for `--ha` and `redis`)     |
| `TC_EDITION`             | Server edition                                           |
| `TC_SERVER_TAG`          | Server image tag                                         |
| `TC_SERVER_IMAGE`        | Full server image (overrides edition + tag)              |
| `TC_DEPENDENCIES`        | Dependencies (comma-separated)                           |
| `TC_HA`                  | Enable HA mode (`true`/`false`)                          |
| `TC_SUBPATH`             | Enable subpath mode (`true`/`false`)                     |
| `TC_ENTRY`               | Enable Entry tier (`true`/`false`)                       |
| `TC_ADMIN_USERNAME`      | Admin username                                           |
| `TC_ADMIN_PASSWORD`      | Admin password                                           |
| `TC_OUTPUT_DIR`          | Output directory                                         |
| `TC_IMAGE_MAX_AGE_HOURS` | Max hours before re-pulling `:master` images             |
| `TC_<SERVICE>_IMAGE`     | Override image for a service (e.g., `TC_POSTGRES_IMAGE`) |

## Supported Dependencies

| Dependency      | Description                                                     | Default Image                                          |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `postgres`      | PostgreSQL database (always included)                           | `postgres:14`                                          |
| `inbucket`      | Email testing (SMTP + web UI)                                   | `inbucket/inbucket:stable`                             |
| `openldap`      | LDAP authentication                                             | `osixia/openldap:1.4.0`                                |
| `keycloak`      | SAML/OIDC identity provider                                     | `quay.io/keycloak/keycloak:23.0.7`                     |
| `minio`         | S3-compatible object storage                                    | `minio/minio:RELEASE.2024-06-22T05-26-45Z`             |
| `elasticsearch` | Search engine                                                   | `mattermostdevelopment/mattermost-elasticsearch:8.9.0` |
| `opensearch`    | Search engine (alternative)                                     | `mattermostdevelopment/mattermost-opensearch:2.7.0`    |
| `redis`         | Cache (requires `MM_LICENSE`)                                   | `redis:7.4.0`                                          |
| `dejavu`        | Elasticsearch web UI (requires `elasticsearch` or `opensearch`) | `appbaseio/dejavu:3.4.2`                               |
| `prometheus`    | Metrics collection                                              | `prom/prometheus:v2.46.0`                              |
| `grafana`       | Dashboards (requires `prometheus` or `loki`)                    | `grafana/grafana:10.4.2`                               |
| `loki`          | Log aggregation (requires `promtail`)                           | `grafana/loki:3.0.0`                                   |
| `promtail`      | Log shipping (requires `loki`)                                  | `grafana/promtail:3.0.0`                               |

## Output Directory

After `start`, the output directory (default `.tc.out/`) contains:

```
.tc.out/
  .env.tc                    # Sourceable environment variables
  .tc.docker.json            # Container metadata (IDs, ports, images)
  .tc.server.config.json     # Server configuration dump
  logs/
    postgres.log
    inbucket.log
    mattermost.log
    ...
```

## Default Credentials

| Service                | Username                        | Password           |
| ---------------------- | ------------------------------- | ------------------ |
| PostgreSQL             | `mmuser`                        | `mostest`          |
| Admin (when `--admin`) | `sysadmin`                      | `Sys@dmin-sample1` |
| Keycloak admin         | `admin`                         | `admin`            |
| Keycloak test users    | `user-1`, `user-2`              | `Password1!`       |
| OpenLDAP admin         | `cn=admin,dc=mm,dc=test,dc=com` | `mostest`          |
| OpenLDAP test users    | `test.one`, `test.two`          | `Password1`        |
| MinIO                  | `minioaccesskey`                | `miniosecretkey`   |

## Security Considerations

This CLI is designed for **controlled environments** — developer machines and CI pipelines. It is not intended for production use.

### Hardcoded Test Credentials

All service credentials listed above are hardcoded defaults intended for local testing only. They match the upstream Mattermost docker-compose test configuration. These credentials are:

- Written to `.tc.out/.env.tc` and `.tc.out/.tc.docker.json` in plaintext
- Printed to console output (admin credentials when `--admin` is used)
- Visible in CI logs if captured

**Do not use these credentials in any production or staging environment.** Add `.tc.out/` to your `.gitignore` to prevent accidental commits of output files.

### Enterprise License

`MM_LICENSE` must be provided via environment variable (not config files) to prevent accidental leakage in committed configuration. The CLI explicitly rejects `MM_LICENSE` in config file `server.env` sections.

### Docker Commands

All Docker CLI invocations use `execFileSync` (array-form arguments) to prevent shell injection. Container IDs read from `.tc.docker.json` are validated against `^[a-f0-9]{12,64}$` before use. Output directory paths are validated to prevent path traversal before any recursive deletion.

### Network Exposure

Containers bind to `0.0.0.0` (default testcontainers behavior) with dynamically allocated ports. On shared networks, services may be accessible to other machines. This is standard for local Docker development but should be considered in shared CI environments.

## License

See [LICENSE.txt](https://github.com/mattermost/mattermost/blob/master/LICENSE.txt) in the project root for details.
