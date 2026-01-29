#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {Command} from 'commander';
import {Chalk} from 'chalk';
import * as dotenv from 'dotenv';

// Create chalk instance at runtime to ensure proper color detection
// (default export is evaluated at bundle time which may be non-TTY)
const chalk = new Chalk();

import {MattermostTestEnvironment, ServerMode} from './environment';
import {
    MATTERMOST_EDITION_IMAGES,
    discoverAndLoadConfig,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_ADMIN,
    type ResolvedTestcontainersConfig,
    type MattermostEdition,
    type ServiceEnvironment,
} from './config/config';
import {
    writeEnvFile,
    writeServerConfig,
    writeDockerInfo,
    writeKeycloakCertificate,
    writeOpenLdapSetup,
    writeKeycloakSetup,
} from './utils/print';
import {setOutputDir} from './utils/log';

/**
 * Create a timestamped run directory for output files.
 * Structure: <baseOutputDir>/run-<timestamp-epoch>/
 * Also creates 'latest' symlink pointing to the new directory.
 *
 * Directory naming uses 'run-' prefix so 'latest' sorts first alphabetically.
 *
 * @param baseOutputDir Base output directory from config
 * @returns Path to the timestamped run directory
 */
function createRunDirectory(baseOutputDir: string): string {
    // Ensure base output directory exists
    if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir, {recursive: true});
    }

    // Create timestamped subdirectory with 'run-' prefix
    // This ensures 'latest' sorts first (l < r alphabetically)
    const timestamp = Date.now();
    const runDirName = `run-${timestamp}`;
    const runDir = path.join(baseOutputDir, runDirName);
    fs.mkdirSync(runDir, {recursive: true});

    // Create/update 'latest' symlink
    const latestLink = path.join(baseOutputDir, 'latest');
    try {
        // Remove existing symlink if it exists
        if (fs.existsSync(latestLink)) {
            fs.unlinkSync(latestLink);
        }
        // Create relative symlink to the timestamped directory
        fs.symlinkSync(runDirName, latestLink);
    } catch {
        // Symlink creation may fail on some systems (e.g., Windows without admin)
        // This is non-critical, so we just log a warning
        console.log(chalk.gray(`Note: Could not create 'latest' symlink`));
    }

    return runDir;
}

// Load environment variables
dotenv.config();

const program = new Command();

program.name('mm-tc').description('CLI for managing Mattermost test containers').version('0.1.0');

/**
 * Apply CLI options on top of resolved config.
 * CLI options have the highest priority in the configuration hierarchy:
 * 1. CLI flags (highest)
 * 2. Environment variables
 * 3. Config file
 * 4. Built-in defaults (lowest)
 */
function applyCliOverrides(
    config: ResolvedTestcontainersConfig,
    options: {
        edition?: string;
        tag?: string;
        serviceEnv?: string;
        deps?: string;
        outputDir?: string;
        ha?: boolean;
        subpath?: boolean;
        admin?: boolean | string;
        adminPassword?: string;
        env?: string[];
        envFile?: string;
    },
): ResolvedTestcontainersConfig {
    const result = {
        ...config,
        server: {...config.server},
        images: {...config.images},
        admin: config.admin ? {...config.admin} : undefined,
    };

    // Server edition (CLI flag)
    if (options.edition) {
        const edition = options.edition.toLowerCase();
        if (edition === 'enterprise' || edition === 'fips' || edition === 'team') {
            result.server.edition = edition as MattermostEdition;
        }
    }

    // Server tag (CLI flag)
    if (options.tag) {
        result.server.tag = options.tag;
    }

    // Service environment (CLI flag)
    if (options.serviceEnv) {
        const env = options.serviceEnv.toLowerCase();
        if (env === 'test' || env === 'production' || env === 'dev') {
            result.server.serviceEnvironment = env as ServiceEnvironment;
        }
    }

    // Additional dependencies (CLI flag adds to existing)
    if (options.deps) {
        const additionalDeps = options.deps.split(',').map((s) => s.trim());
        result.dependencies = [...new Set([...result.dependencies, ...additionalDeps])];
    }

    // Output directory (CLI flag)
    if (options.outputDir) {
        result.outputDir = options.outputDir;
    }

    // HA mode (CLI flag)
    if (options.ha !== undefined) {
        result.server.ha = options.ha;
    }

    // Subpath mode (CLI flag)
    if (options.subpath !== undefined) {
        result.server.subpath = options.subpath;
    }

    // Admin user (CLI flag)
    if (options.admin !== undefined) {
        const username = typeof options.admin === 'string' ? options.admin : DEFAULT_ADMIN.username;
        result.admin = {
            username,
            password: options.adminPassword || result.admin?.password || DEFAULT_ADMIN.password,
            email: `${username}@sample.mattermost.com`,
        };
    }

    // Rebuild server image after applying overrides
    result.server.image = `${MATTERMOST_EDITION_IMAGES[result.server.edition]}:${result.server.tag}`;

    return result;
}

/**
 * Build server environment variables from config, env file, and CLI options.
 * Priority (highest to lowest): CLI -E options > --env-file > config file server.env
 */
function buildServerEnv(
    config: ResolvedTestcontainersConfig,
    options: {env?: string[]; envFile?: string; serviceEnv?: string; depsOnly?: boolean},
): Record<string, string> {
    const serverEnv: Record<string, string> = {};

    // Layer 1: Config file server.env (lowest priority)
    if (config.server.env) {
        Object.assign(serverEnv, config.server.env);
    }

    // Layer 2: Env file (if provided)
    if (options.envFile) {
        if (!fs.existsSync(options.envFile)) {
            throw new Error(`Env file not found: ${options.envFile}`);
        }
        const envFileContent = fs.readFileSync(options.envFile, 'utf-8');
        const parsed = dotenv.parse(envFileContent);
        Object.assign(serverEnv, parsed);
    }

    // Layer 3: CLI -E options (highest priority)
    if (options.env) {
        for (const envVar of options.env) {
            const eqIndex = envVar.indexOf('=');
            if (eqIndex === -1) {
                throw new Error(`Invalid environment variable format: ${envVar}. Expected KEY=value`);
            }
            const key = envVar.substring(0, eqIndex);
            const value = envVar.substring(eqIndex + 1);
            serverEnv[key] = value;
        }
    }

    // Apply service environment with proper priority:
    // CLI -S option > CLI -E option > --env-file > config file > default based on mode
    if (options.serviceEnv) {
        serverEnv.MM_SERVICEENVIRONMENT = options.serviceEnv;
    } else if (!serverEnv.MM_SERVICEENVIRONMENT && config.server.serviceEnvironment) {
        serverEnv.MM_SERVICEENVIRONMENT = config.server.serviceEnvironment;
    } else if (!serverEnv.MM_SERVICEENVIRONMENT) {
        // Default based on mode: 'dev' for deps-only (local development), 'test' for container mode
        serverEnv.MM_SERVICEENVIRONMENT = options.depsOnly ? 'dev' : 'test';
    }

    return serverEnv;
}

const startCommand = program
    .command('start')
    .description('Start the Mattermost test environment')
    .argument('[command]', 'Use "help" to show help')
    .option(
        '-c, --config <path>',
        'Path to config file. Accepts .mjs or .jsonc extensions. Auto-discovers mm-tc.config.mjs or mm-tc.config.jsonc',
    )
    .option('-e, --edition <edition>', 'Mattermost server edition: enterprise (default), fips, team')
    .option('-t, --tag <tag>', 'Mattermost server image tag (e.g., master, release-11.4)')
    .option('-S, --service-env <env>', 'Service environment: test, production, dev (sets MM_SERVICEENVIRONMENT)')
    .option(
        '-E, --env <KEY=value>',
        'Environment variable to pass to Mattermost server, can be specified multiple times',
        (value: string, previous: string[]) => previous.concat([value]),
        [] as string[],
    )
    .option('--env-file <path>', 'Path to env file to load variables for Mattermost server')
    .option(
        '-D, --deps <deps>',
        'Additional dependencies to enable: openldap, keycloak, minio, elasticsearch, opensearch, redis, dejavu, prometheus, grafana, loki, promtail',
    )
    .option('--deps-only', 'Start dependencies only (no Mattermost container)')
    .option('--ha', 'Run in high-availability mode (3-node cluster with nginx load balancer)')
    .option('--subpath', 'Run two Mattermost servers behind nginx with subpaths (/mattermost1, /mattermost2)')
    .option(
        '--admin [username]',
        'Create admin user (default username: sysadmin, email: <username>@sample.mattermost.com)',
    )
    .option('--admin-password <password>', 'Admin user password')
    .option('-o, --output-dir <dir>', 'Output directory for logs/, .env.tc, and .tc.server.json', DEFAULT_OUTPUT_DIR)
    .option('-d, --detach', 'Start containers and exit (run in background)')
    .action(async (command, options) => {
        // Handle "mm-tc start help"
        if (command === 'help') {
            startCommand.help();
            return;
        }

        try {
            // Load and resolve config (applies: defaults → config file → env vars)
            const resolvedConfig = await discoverAndLoadConfig({configFile: options.config});

            // Apply CLI overrides (highest priority)
            const config = applyCliOverrides(resolvedConfig, options);

            // Create timestamped run directory for this session
            // Structure: <outputDir>/<timestamp>/logs/, .env.tc, .tc.docker.json, etc.
            const runDir = createRunDirectory(config.outputDir);
            setOutputDir(runDir);
            console.log(chalk.gray(`Output directory: ${runDir}`));

            // Validate --deps-only cannot be used with --ha or --subpath
            if (options.depsOnly && (config.server.ha || config.server.subpath)) {
                console.error(chalk.red('--deps-only cannot be used with --ha or --subpath'));
                process.exit(1);
            }

            // Build server environment variables
            const serverEnv = buildServerEnv(config, {
                env: options.env,
                envFile: options.envFile,
                serviceEnv: options.serviceEnv,
                depsOnly: options.depsOnly,
            });

            // Log startup message
            const serviceEnvDisplay = serverEnv.MM_SERVICEENVIRONMENT;
            if (options.depsOnly) {
                console.log(chalk.blue(`Starting Mattermost dependencies (service env: ${serviceEnvDisplay})`));
                console.log(chalk.gray('Run the server separately to connect to these services.'));
            } else if (config.server.subpath && config.server.ha) {
                console.log(
                    chalk.blue(
                        `Starting Mattermost subpath + HA mode (2 servers x 3 nodes each, service env: ${serviceEnvDisplay})`,
                    ),
                );
            } else if (config.server.subpath) {
                console.log(
                    chalk.blue(
                        `Starting Mattermost subpath mode (2 servers at /mattermost1 and /mattermost2, service env: ${serviceEnvDisplay})`,
                    ),
                );
            } else if (config.server.ha) {
                console.log(
                    chalk.blue(
                        `Starting Mattermost HA cluster (3 nodes, cluster: mm_test_cluster, service env: ${serviceEnvDisplay})`,
                    ),
                );
            } else {
                console.log(chalk.blue(`Starting Mattermost test environment (service env: ${serviceEnvDisplay})`));
            }

            // Merge built serverEnv into config.server.env (CLI overrides take precedence)
            config.server.env = {
                ...config.server.env,
                ...serverEnv,
            };

            // Determine server mode: 'local' for deps-only, 'container' otherwise
            const serverMode: ServerMode = options.depsOnly ? 'local' : 'container';

            const env = new MattermostTestEnvironment(config, serverMode);
            await env.start();

            const info = env.getConnectionInfo();

            console.log(chalk.green('\n✓ Environment started successfully!\n'));
            console.log(chalk.cyan('Connection Information:'));
            console.log(chalk.cyan('======================='));

            // Display subpath, HA cluster, or single node info
            if (info.subpath) {
                console.log(
                    `Mattermost:      ${chalk.yellow(info.subpath.url)} ${chalk.gray('(nginx with subpaths)')}`,
                );
                console.log(`  Server 1:      ${chalk.yellow(info.subpath.server1Url)}`);
                console.log(chalk.gray(`    Direct: ${info.subpath.server1DirectUrl}`));
                console.log(`  Server 2:      ${chalk.yellow(info.subpath.server2Url)}`);
                console.log(chalk.gray(`    Direct: ${info.subpath.server2DirectUrl}`));
            } else if (info.haCluster) {
                console.log(
                    `Mattermost HA:   ${chalk.yellow(info.haCluster.url)} ${chalk.gray('(nginx load balancer)')}`,
                );
                console.log(chalk.gray(`  Cluster: ${info.haCluster.clusterName}`));
                for (const node of info.haCluster.nodes) {
                    console.log(chalk.gray(`  ${node.nodeName}: ${node.url}`));
                }
            } else if (info.mattermost) {
                console.log(`Mattermost:      ${chalk.yellow(info.mattermost.url)}`);
            }

            console.log(`PostgreSQL:      ${chalk.yellow(info.postgres.connectionString)}`);

            if (info.inbucket) {
                console.log(
                    `Inbucket:        ${chalk.yellow(`http://${info.inbucket.host}:${info.inbucket.webPort}`)}`,
                );
            }

            if (info.openldap) {
                console.log(`OpenLDAP:        ${chalk.yellow(`ldap://${info.openldap.host}:${info.openldap.port}`)}`);
            }

            if (info.minio) {
                console.log(`MinIO API:       ${chalk.yellow(info.minio.endpoint)}`);
                console.log(`MinIO Console:   ${chalk.yellow(info.minio.consoleUrl)}`);
            }

            if (info.elasticsearch) {
                console.log(`Elasticsearch:   ${chalk.yellow(info.elasticsearch.url)}`);
            }

            if (info.opensearch) {
                console.log(`OpenSearch:      ${chalk.yellow(info.opensearch.url)}`);
            }

            if (info.keycloak) {
                console.log(`Keycloak:        ${chalk.yellow(info.keycloak.adminUrl)}`);
            }

            if (info.redis) {
                console.log(`Redis:           ${chalk.yellow(info.redis.url)}`);
            }

            if (info.dejavu) {
                console.log(`Dejavu:          ${chalk.yellow(info.dejavu.url)}`);
            }

            if (info.prometheus) {
                console.log(`Prometheus:      ${chalk.yellow(info.prometheus.url)}`);
            }

            if (info.grafana) {
                console.log(`Grafana:         ${chalk.yellow(info.grafana.url)}`);
            }

            if (info.loki) {
                console.log(
                    `Loki API:        ${chalk.yellow(info.loki.url)} ${chalk.gray('(use Grafana to view logs)')}`,
                );
            }

            if (info.promtail) {
                console.log(`Promtail API:    ${chalk.yellow(info.promtail.url)} ${chalk.gray('(metrics only)')}`);
            }

            // Write config files to run directory
            const envPath = writeEnvFile(info, runDir, {depsOnly: options.depsOnly});
            console.log(chalk.green(`\n✓ Environment variables written to ${envPath}`));

            const containerMetadata = env.getContainerMetadata();
            const dockerInfoPath = writeDockerInfo(info, containerMetadata, runDir);
            console.log(chalk.green(`✓ Docker container info written to ${dockerInfoPath}`));

            // Write setup documentation for enabled dependencies
            if (info.openldap) {
                const ldapSetupPath = writeOpenLdapSetup(info, runDir);
                if (ldapSetupPath) {
                    console.log(chalk.green(`✓ OpenLDAP setup documentation written to ${ldapSetupPath}`));
                }
            }

            if (info.keycloak) {
                const keycloakSetupPath = writeKeycloakSetup(info, runDir);
                if (keycloakSetupPath) {
                    console.log(chalk.green(`✓ Keycloak setup documentation written to ${keycloakSetupPath}`));
                }
            }

            // Create admin user if requested (container mode only)
            if (!options.depsOnly && config.admin && info.mattermost) {
                const adminResult = await env.createAdminUser();
                if (adminResult.success) {
                    console.log(
                        chalk.green(
                            `✓ Admin user: ${adminResult.username} / ${adminResult.password} (${adminResult.email})`,
                        ),
                    );
                } else {
                    console.log(chalk.yellow(`⚠ Could not create admin user: ${adminResult.error}`));
                }
            }

            // Write Keycloak SAML certificate if keycloak is enabled
            if (info.keycloak) {
                const certPath = writeKeycloakCertificate(runDir);
                console.log(chalk.green(`✓ Keycloak SAML certificate written to ${certPath}`));

                // Print Keycloak test user credentials
                console.log(chalk.gray('  Keycloak admin: admin / admin'));
                console.log(chalk.gray('  Keycloak test users:'));
                console.log(chalk.gray('    - user-1 / Password1! (user-1@sample.mattermost.com)'));
                console.log(chalk.gray('    - user-2 / Password1! (user-2@sample.mattermost.com)'));

                // Configure SAML in Mattermost (container mode only)
                if (!options.depsOnly && info.mattermost) {
                    try {
                        const uploadResult = await env.uploadSamlIdpCertificate();
                        if (uploadResult.success) {
                            console.log(chalk.green('✓ SAML configured and enabled with Keycloak'));
                        } else {
                            console.log(chalk.yellow(`⚠ Could not configure SAML: ${uploadResult.error}`));
                            console.log(
                                chalk.gray(`  Configure manually via System Console. Certificate: ${certPath}`),
                            );
                        }
                    } catch {
                        console.log(chalk.yellow('⚠ Could not configure SAML'));
                        console.log(chalk.gray(`  Configure manually via System Console. Certificate: ${certPath}`));
                    }
                }
            }

            // Write server config for container mode (get actual config from server via mmctl)
            if (!options.depsOnly && info.mattermost) {
                try {
                    const mmctl = env.getMmctl();
                    const result = await mmctl.exec('config show --json');
                    if (result.exitCode === 0) {
                        const serverConfigJson = JSON.parse(result.stdout);
                        const configPath = writeServerConfig(serverConfigJson, runDir);
                        console.log(chalk.green(`✓ Server configuration written to ${configPath}`));
                    } else {
                        console.log(chalk.yellow('⚠ Could not get server config via mmctl'));
                    }
                } catch {
                    console.log(chalk.yellow('⚠ Could not get server config via mmctl'));
                }
            }

            if (options.depsOnly) {
                console.log(chalk.gray(`  Usage: source ${envPath} && make run-server`));
            }

            // Detach mode: exit after starting
            if (options.detach) {
                console.log(chalk.gray('\nContainers are running in background. Use `mm-tc stop` to stop them.'));
            } else {
                // Default: run in foreground until Ctrl+C
                console.log(chalk.gray('\nPress Ctrl+C to stop the environment'));

                let isShuttingDown = false;
                process.on('SIGINT', async () => {
                    if (isShuttingDown) return;
                    isShuttingDown = true;

                    console.log(chalk.blue('\n\nStopping environment...'));
                    try {
                        await env.stop();
                        console.log(chalk.green('Environment stopped.'));
                    } catch {
                        // Containers may already be stopped
                        console.log(
                            chalk.yellow(
                                'Environment cleanup completed (some containers may have already been stopped).',
                            ),
                        );
                    }
                    process.exit(0);
                });

                // Keep the process alive using setInterval
                // This prevents Node from exiting while waiting for Ctrl+C
                setInterval(() => {}, 1000 * 60 * 60); // 1 hour interval
                await new Promise(() => {}); // Never resolves
            }
        } catch (error) {
            console.error(chalk.red('Failed to start environment:'), error);
            process.exit(1);
        }
    });

const stopCommand = program
    .command('stop')
    .description('Stop and remove all testcontainers')
    .argument('[command]', 'Use "help" to show help')
    .action(async (command) => {
        // Handle "mm-tc stop help"
        if (command === 'help') {
            stopCommand.help();
            return;
        }

        try {
            console.log(chalk.blue('Stopping testcontainers...'));

            // Use docker to find and stop containers with testcontainers labels
            const {execSync} = await import('child_process');

            // Find containers with testcontainers label
            try {
                const containers = execSync('docker ps -q --filter "label=org.testcontainers=true"', {
                    encoding: 'utf-8',
                }).trim();

                if (containers) {
                    console.log(chalk.gray('Stopping containers...'));
                    execSync(`docker stop ${containers.split('\n').join(' ')}`, {stdio: 'inherit'});
                    console.log(chalk.gray('Removing containers...'));
                    execSync(`docker rm ${containers.split('\n').join(' ')}`, {stdio: 'inherit'});
                }
            } catch {
                // No containers found or docker not available
            }

            // Find and remove testcontainers networks
            try {
                const networks = execSync('docker network ls -q --filter "label=org.testcontainers=true"', {
                    encoding: 'utf-8',
                }).trim();

                if (networks) {
                    console.log(chalk.gray('Removing networks...'));
                    for (const network of networks.split('\n')) {
                        try {
                            execSync(`docker network rm ${network}`, {stdio: 'inherit'});
                        } catch {
                            // Network might be in use
                        }
                    }
                }
            } catch {
                // No networks found
            }

            console.log(chalk.green('✓ Testcontainers stopped'));
        } catch (error) {
            console.error(chalk.red('Failed to stop testcontainers:'), error);
            process.exit(1);
        }
    });

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
        console.log('  3. Config file (mm-tc.config.mjs or mm-tc.config.jsonc)');
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
        console.log('  TC_ADMIN_USERNAME      - Admin username (email: <username>@sample.mattermost.com)');
        console.log('  TC_ADMIN_PASSWORD      - Admin password');
        console.log('  TC_IMAGE_MAX_AGE_HOURS - Max age before pulling fresh image');
        console.log('  MM_SERVICEENVIRONMENT  - Service environment (test, production, dev)');
        console.log('  MM_LICENSE             - Enterprise license (base64 encoded)');
        console.log('  TC_<SERVICE>_IMAGE     - Override service image (e.g., TC_POSTGRES_IMAGE)');

        console.log(chalk.cyan('\nConfig File (mm-tc.config.mjs):'));
        console.log(chalk.cyan('==============================='));
        console.log("  import {defineConfig} from '@mattermost/testcontainers';");
        console.log('');
        console.log('  export default defineConfig({');
        console.log('    server: {');
        console.log('      edition: "enterprise",');
        console.log('      tag: "master",');
        console.log('      serviceEnvironment: "test",');
        console.log('      imageMaxAgeHours: 24,');
        console.log('      ha: false,');
        console.log('      subpath: false,');
        console.log('      env: { MM_FEATUREFLAGS_SOMETHING: "true" },');
        console.log('      config: { ServiceSettings: { EnableOpenServer: false } },');
        console.log('    },');
        console.log('    dependencies: ["postgres", "inbucket", "minio"],');
        console.log('    outputDir: ".tc.out",');
        console.log('    admin: {');
        console.log('      username: "sysadmin",  // email: sysadmin@sample.mattermost.com');
        console.log('      password: "Sys@dmin-sample1",');
        console.log('    },');
        console.log('  });');

        console.log(chalk.cyan('\nConfig File (mm-tc.config.jsonc):'));
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
        console.log('      "env": { "MM_FEATUREFLAGS_SOMETHING": "true" },');
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
        console.log('  <outputDir>/                    - Base output directory (default: .tc.out)');
        console.log('    latest -> run-<timestamp>     - Symlink to most recent run');
        console.log('    run-<timestamp>/              - Timestamped run directory (epoch ms)');
        console.log('      logs/                       - Container logs directory');
        console.log('        <service>.log             - Individual container logs');
        console.log('      .env.tc                     - Environment variables for local server');
        console.log('      .tc.docker.json             - Docker container metadata');
        console.log('      .tc.server.config.json      - Server configuration (container mode)');
        console.log('      openldap_setup.md           - OpenLDAP setup docs (if enabled)');
        console.log('      keycloak_setup.md           - Keycloak setup docs (if enabled)');
        console.log('      saml-idp.crt                - Keycloak SAML certificate (if enabled)');

        console.log(chalk.cyan('\nExamples:'));
        console.log(chalk.cyan('========='));
        console.log('  mm-tc start                           # Start with defaults (enterprise)');
        console.log('  mm-tc start -D minio,elasticsearch    # Add dependencies');
        console.log('  mm-tc start -t release-11.4           # Specific tag');
        console.log('  mm-tc start -e team                   # Team edition');
        console.log('  mm-tc start -e fips                   # FIPS edition');
        console.log('  mm-tc start --ha                      # HA cluster');
        console.log('  mm-tc start --subpath                 # Subpath mode');
        console.log('  mm-tc start --admin                   # Create admin user');
        console.log('  mm-tc start --deps-only               # Dependencies only');
        console.log('  mm-tc start -S production             # Production env');
        console.log('  mm-tc start -E KEY=value              # Pass env var');
        console.log('  mm-tc stop                            # Stop all containers');
    });

program.parse();
