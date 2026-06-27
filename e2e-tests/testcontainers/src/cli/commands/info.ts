// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Command} from 'commander';
import {Chalk} from 'chalk';

const chalk = new Chalk();

/**
 * Register the info command on the program.
 */
export function registerInfoCommand(program: Command): void {
    program
        .command('info')
        .description('Display available dependencies and configuration options')
        .action(() => {
            console.log(chalk.cyan('Available Dependencies:'));
            console.log(chalk.cyan('======================='));
            console.log('  postgres      - PostgreSQL database (required)');
            console.log('  inbucket      - Email testing server');
            console.log('  openldap      - LDAP authentication server');
            console.log('  minio         - S3-compatible object storage');
            console.log('  elasticsearch - Search engine');
            console.log('  opensearch    - OpenSearch engine');
            console.log('  keycloak      - Identity provider (SAML/OIDC)');
            console.log('  redis         - Cache server');
            console.log('  dejavu        - Elasticsearch UI');
            console.log('  prometheus    - Metrics server');
            console.log('  grafana       - Visualization dashboards');
            console.log('  loki          - Log aggregation');
            console.log('  promtail      - Log shipping agent');

            console.log(chalk.cyan('\nConfiguration Priority (highest to lowest):'));
            console.log(chalk.cyan('============================================'));
            console.log('  1. CLI flags (e.g., -e, -t, --ha)');
            console.log('  2. Environment variables (e.g., TC_EDITION, MM_SERVICEENVIRONMENT)');
            console.log(
                '  3. Config file (mattermost-testcontainers.config.mjs or mattermost-testcontainers.config.jsonc)',
            );
            console.log('  4. Built-in defaults');

            console.log(chalk.cyan('\nEnvironment Variables:'));
            console.log(chalk.cyan('======================'));
            console.log('  TC_EDITION             - Server edition (enterprise, fips, team)');
            console.log('  TC_SERVER_TAG          - Server image tag (e.g., master, release-11.4)');
            console.log('  TC_SERVER_IMAGE        - Full server image (overrides edition/tag)');
            console.log('  TC_DEPENDENCIES        - Dependencies (comma-separated)');
            console.log('  TC_OUTPUT_DIR          - Output directory');
            console.log('  TC_HA                  - HA mode (true/false)');
            console.log('  TC_SUBPATH             - Subpath mode (true/false)');
            console.log('  TC_ENTRY               - Entry tier mode (true/false) - enterprise/fips only');
            console.log('  TC_ADMIN_USERNAME      - Admin username (email: <username>@sample.mattermost.com)');
            console.log('  TC_ADMIN_PASSWORD      - Admin password');
            console.log('  TC_IMAGE_MAX_AGE_HOURS - Max age before pulling fresh image');
            console.log('  MM_SERVICEENVIRONMENT  - Service environment (test, production, dev)');
            console.log('  MM_LICENSE             - Enterprise license (base64 encoded)');
            console.log('  TC_<SERVICE>_IMAGE     - Override service image (e.g., TC_POSTGRES_IMAGE)');

            console.log(chalk.cyan('\nConfig File (mattermost-testcontainers.config.mjs):'));
            console.log(chalk.cyan('==============================='));
            console.log("  import {defineConfig} from '@mattermost/testcontainers';");
            console.log('');
            console.log('  export default defineConfig({');
            console.log('    server: {');
            console.log('      edition: "enterprise",');
            console.log('      entry: false,  // true for Mattermost Entry tier');
            console.log('      tag: "master",');
            console.log('      serviceEnvironment: "test",');
            console.log('      imageMaxAgeHours: 24,');
            console.log('      ha: false,');
            console.log('      subpath: false,');
            console.log('      env: { MM_FEATUREFLAGS_TESTFEATURE: "true" },');
            console.log('      config: { ServiceSettings: { EnableOpenServer: false } },');
            console.log('    },');
            console.log('    dependencies: ["postgres", "inbucket", "minio"],');
            console.log('    outputDir: ".tc.out",');
            console.log('    admin: {');
            console.log('      username: "sysadmin",  // email: sysadmin@sample.mattermost.com');
            console.log('      password: "Sys@dmin-sample1",');
            console.log('    },');
            console.log('  });');

            console.log(chalk.cyan('\nConfig File (mattermost-testcontainers.config.jsonc):'));
            console.log(chalk.cyan('=================================='));
            console.log('  {');
            console.log('    // Mattermost server configuration');
            console.log('    "server": {');
            console.log('      "edition": "enterprise",  // "enterprise", "fips", or "team"');
            console.log('      "tag": "master",          // e.g., "master", "release-11.4"');
            console.log('      "serviceEnvironment": "test",');
            console.log('      "imageMaxAgeHours": 24,');
            console.log('      "ha": false,');
            console.log('      "subpath": false,');
            console.log('      "env": { "MM_FEATUREFLAGS_TESTFEATURE": "true" },');
            console.log('      "config": { "ServiceSettings": { "EnableOpenServer": false } }');
            console.log('    },');
            console.log('    "dependencies": ["postgres", "inbucket", "minio"],');
            console.log('    "outputDir": ".tc.out",');
            console.log('    "admin": {');
            console.log('      "username": "sysadmin",  // email: sysadmin@sample.mattermost.com');
            console.log('      "password": "Sys@dmin-sample1"');
            console.log('    }');
            console.log('  }');

            console.log(chalk.cyan('\nOutput Directory Structure:'));
            console.log(chalk.cyan('==========================='));
            console.log('  <outputDir>/                  - Output directory (default: .tc.out)');
            console.log('    logs/                       - Container logs directory');
            console.log('      <service>.log             - Individual container logs');
            console.log('    .env.tc                     - Environment variables for local server');
            console.log('    .tc.docker.json             - Docker container metadata');
            console.log('    .tc.server.config.json      - Server configuration (container mode)');
            console.log('    openldap_setup.md           - OpenLDAP setup docs (if enabled)');
            console.log('    keycloak_setup.md           - Keycloak setup docs (if enabled)');
            console.log('    saml-idp.crt                - Keycloak SAML certificate (if enabled)');

            console.log(chalk.cyan('\nExamples:'));
            console.log(chalk.cyan('========='));
            console.log(
                '  npx @mattermost/testcontainers start                           # Start with defaults (enterprise)',
            );
            console.log('  npx @mattermost/testcontainers start -D minio,elasticsearch    # Add dependencies');
            console.log('  npx @mattermost/testcontainers start -t release-11.4           # Specific tag');
            console.log('  npx @mattermost/testcontainers start -e team                   # Team edition');
            console.log('  npx @mattermost/testcontainers start -e fips                   # FIPS edition');
            console.log('  npx @mattermost/testcontainers start --ha                      # HA cluster');
            console.log('  npx @mattermost/testcontainers start --subpath                 # Subpath mode');
            console.log(
                '  npx @mattermost/testcontainers start --entry                   # Entry tier (ignores MM_LICENSE)',
            );
            console.log('  npx @mattermost/testcontainers start --admin                   # Create admin user');
            console.log('  npx @mattermost/testcontainers start --deps-only               # Dependencies only');
            console.log('  npx @mattermost/testcontainers start -S production             # Production env');
            console.log('  npx @mattermost/testcontainers start -E KEY=value              # Pass env var');
            console.log('  npx @mattermost/testcontainers restart                         # Restart all containers');
            console.log('  npx @mattermost/testcontainers upgrade -t release-11.5         # Upgrade to new tag');
            console.log('  npx @mattermost/testcontainers stop                            # Stop all containers');
            console.log('  npx @mattermost/testcontainers rm                              # Remove session containers');
            console.log('  npx @mattermost/testcontainers rm-all                          # Remove ALL testcontainers');
        });
}
