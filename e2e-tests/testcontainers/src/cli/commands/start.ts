// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {Command} from 'commander';
import {Chalk} from 'chalk';

import {MattermostTestEnvironment, ServerMode} from '../../environment';
import {discoverAndLoadConfig, DEFAULT_OUTPUT_DIR} from '../../config/config';
import {
    writeEnvFile,
    writeServerConfig,
    writeDockerInfo,
    writeKeycloakCertificate,
    writeOpenLdapSetup,
    writeKeycloakSetup,
} from '../../utils/print';
import {setOutputDir} from '../../utils/log';
import {prepareOutputDirectory, applyCliOverrides, buildServerEnv} from '../utils';
import type {StartOptions} from '../types';

const chalk = new Chalk();

/**
 * Register the start command on the program.
 */
export function registerStartCommand(program: Command): Command {
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
        .option('--entry', 'Use Mattermost Entry tier (enterprise/fips only, ignores MM_LICENSE)')
        .option(
            '--admin [username]',
            'Create admin user (default username: sysadmin, email: <username>@sample.mattermost.com)',
        )
        .option('--admin-password <password>', 'Admin user password')
        .option(
            '-o, --output-dir <dir>',
            'Output directory for logs/, .env.tc, and .tc.server.json',
            DEFAULT_OUTPUT_DIR,
        )
        .action(async (command, options: StartOptions) => {
            // Handle "mm-tc start help"
            if (command === 'help') {
                startCommand.help();
                return;
            }

            await executeStartCommand(options);
        });

    return startCommand;
}

/**
 * Execute the start command logic.
 */
async function executeStartCommand(options: StartOptions): Promise<void> {
    try {
        // Load and resolve config (applies: defaults → config file → env vars)
        const resolvedConfig = await discoverAndLoadConfig({configFile: options.config});

        // Check if containers already exist from a previous session
        const checkOutputDir = options.outputDir || resolvedConfig.outputDir || DEFAULT_OUTPUT_DIR;
        const existingDockerInfoPath = path.join(checkOutputDir, '.tc.docker.json');
        if (fs.existsSync(existingDockerInfoPath)) {
            const {execSync} = await import('child_process');

            // Read docker info and check container status
            const dockerInfoRaw = fs.readFileSync(existingDockerInfoPath, 'utf-8');
            const dockerInfo = JSON.parse(dockerInfoRaw);
            const containers = Object.entries(dockerInfo.containers || {});

            if (containers.length > 0) {
                // Check how many containers are running
                let runningCount = 0;
                let stoppedCount = 0;
                const containerStatuses: Array<{name: string; running: boolean}> = [];

                for (const [name, info] of containers) {
                    const containerInfo = info as {id: string};
                    try {
                        const isRunning =
                            execSync(`docker inspect --format '{{.State.Running}}' ${containerInfo.id}`, {
                                encoding: 'utf-8',
                                stdio: ['pipe', 'pipe', 'pipe'],
                            }).trim() === 'true';

                        containerStatuses.push({name, running: isRunning});
                        if (isRunning) {
                            runningCount++;
                        } else {
                            stoppedCount++;
                        }
                    } catch {
                        // Container doesn't exist anymore
                        stoppedCount++;
                        containerStatuses.push({name, running: false});
                    }
                }

                if (runningCount > 0) {
                    // Build set of running container names
                    const runningContainers = new Set(containerStatuses.filter((s) => s.running).map((s) => s.name));

                    console.log(chalk.green(`\nContainers from previous session (${runningCount} running):\n`));
                    console.log(chalk.cyan('Connection Information:'));
                    console.log(chalk.cyan('======================='));

                    // Display connection info only for running containers
                    const c = dockerInfo.containers as Record<string, Record<string, unknown>>;
                    if (runningContainers.has('mattermost') && c.mattermost?.url) {
                        console.log(`Mattermost:      ${chalk.yellow(c.mattermost.url)}`);
                    }
                    if (runningContainers.has('postgres') && c.postgres?.connectionString) {
                        console.log(`PostgreSQL:      ${chalk.yellow(c.postgres.connectionString)}`);
                    }
                    if (runningContainers.has('inbucket') && c.inbucket?.host && c.inbucket?.webPort) {
                        console.log(
                            `Inbucket:        ${chalk.yellow(`http://${c.inbucket.host}:${c.inbucket.webPort}`)}`,
                        );
                    }
                    if (runningContainers.has('openldap') && c.openldap?.host && c.openldap?.port) {
                        console.log(`OpenLDAP:        ${chalk.yellow(`ldap://${c.openldap.host}:${c.openldap.port}`)}`);
                    }
                    if (runningContainers.has('minio') && c.minio?.endpoint) {
                        console.log(`MinIO API:       ${chalk.yellow(c.minio.endpoint)}`);
                        if (c.minio?.consoleUrl) {
                            console.log(`MinIO Console:   ${chalk.yellow(c.minio.consoleUrl)}`);
                        }
                    }
                    if (runningContainers.has('elasticsearch') && c.elasticsearch?.url) {
                        console.log(`Elasticsearch:   ${chalk.yellow(c.elasticsearch.url)}`);
                    }
                    if (runningContainers.has('opensearch') && c.opensearch?.url) {
                        console.log(`OpenSearch:      ${chalk.yellow(c.opensearch.url)}`);
                    }
                    if (runningContainers.has('keycloak') && c.keycloak?.adminUrl) {
                        console.log(`Keycloak:        ${chalk.yellow(c.keycloak.adminUrl)}`);
                    }
                    if (runningContainers.has('redis') && c.redis?.url) {
                        console.log(`Redis:           ${chalk.yellow(c.redis.url)}`);
                    }
                    if (runningContainers.has('dejavu') && c.dejavu?.url) {
                        console.log(`Dejavu:          ${chalk.yellow(c.dejavu.url)}`);
                    }
                    if (runningContainers.has('prometheus') && c.prometheus?.url) {
                        console.log(`Prometheus:      ${chalk.yellow(c.prometheus.url)}`);
                    }
                    if (runningContainers.has('grafana') && c.grafana?.url) {
                        console.log(`Grafana:         ${chalk.yellow(c.grafana.url)}`);
                    }
                    if (runningContainers.has('loki') && c.loki?.url) {
                        console.log(`Loki:            ${chalk.yellow(c.loki.url)}`);
                    }
                    if (runningContainers.has('promtail') && c.promtail?.url) {
                        console.log(`Promtail:        ${chalk.yellow(c.promtail.url)}`);
                    }

                    console.log(chalk.gray('\nCommands:'));
                    console.log(chalk.gray('  mm-tc restart    # Restart all containers'));
                    console.log(chalk.gray('  mm-tc upgrade    # Upgrade mattermost to new tag'));
                    console.log(chalk.gray('  mm-tc rm         # Remove containers and start fresh'));
                    process.exit(0);
                } else if (stoppedCount > 0) {
                    console.log(chalk.yellow(`\nStopped containers from previous session:`));
                    for (const {name} of containerStatuses) {
                        console.log(`  ${name}: ${chalk.gray('stopped')}`);
                    }
                    console.log(chalk.gray('\nCommands:'));
                    console.log(chalk.gray('  mm-tc restart    # Restart all containers'));
                    console.log(chalk.gray('  mm-tc rm         # Remove containers and start fresh'));
                    process.exit(0);
                }
            }
        }

        // Apply CLI overrides (highest priority)
        const config = applyCliOverrides(resolvedConfig, options);

        // Prepare output directory (deletes existing and creates fresh)
        const outputDir = prepareOutputDirectory(config.outputDir);
        setOutputDir(outputDir);
        console.log(chalk.gray(`Output directory: ${outputDir}`));

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
            console.log(`Mattermost:      ${chalk.yellow(info.subpath.url)} ${chalk.gray('(nginx with subpaths)')}`);
            console.log(`  Server 1:      ${chalk.yellow(info.subpath.server1Url)}`);
            console.log(chalk.gray(`    Direct: ${info.subpath.server1DirectUrl}`));
            console.log(`  Server 2:      ${chalk.yellow(info.subpath.server2Url)}`);
            console.log(chalk.gray(`    Direct: ${info.subpath.server2DirectUrl}`));
        } else if (info.haCluster) {
            console.log(`Mattermost HA:   ${chalk.yellow(info.haCluster.url)} ${chalk.gray('(nginx load balancer)')}`);
            console.log(chalk.gray(`  Cluster: ${info.haCluster.clusterName}`));
            for (const node of info.haCluster.nodes) {
                console.log(chalk.gray(`  ${node.nodeName}: ${node.url}`));
            }
        } else if (info.mattermost) {
            console.log(`Mattermost:      ${chalk.yellow(info.mattermost.url)}`);
        }

        console.log(`PostgreSQL:      ${chalk.yellow(info.postgres.connectionString)}`);

        if (info.inbucket) {
            console.log(`Inbucket:        ${chalk.yellow(`http://${info.inbucket.host}:${info.inbucket.webPort}`)}`);
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
            console.log(`Loki API:        ${chalk.yellow(info.loki.url)} ${chalk.gray('(use Grafana to view logs)')}`);
        }

        if (info.promtail) {
            console.log(`Promtail API:    ${chalk.yellow(info.promtail.url)} ${chalk.gray('(metrics only)')}`);
        }

        // Write config files to run directory
        const envPath = writeEnvFile(info, outputDir, {depsOnly: options.depsOnly});
        console.log(chalk.green(`\n✓ Environment variables written to ${envPath}`));

        const containerMetadata = env.getContainerMetadata();
        const dockerInfoPath = writeDockerInfo(info, containerMetadata, outputDir);
        console.log(chalk.green(`✓ Docker container info written to ${dockerInfoPath}`));

        // Write setup documentation for enabled dependencies
        if (info.openldap) {
            const ldapSetupPath = writeOpenLdapSetup(info, outputDir);
            if (ldapSetupPath) {
                console.log(chalk.green(`✓ OpenLDAP setup documentation written to ${ldapSetupPath}`));
            }
        }

        if (info.keycloak) {
            const keycloakSetupPath = writeKeycloakSetup(info, outputDir);
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
            const certPath = writeKeycloakCertificate(outputDir);
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
                        console.log(chalk.gray(`  Configure manually via System Console. Certificate: ${certPath}`));
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
                    const configPath = writeServerConfig(serverConfigJson, outputDir);
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

        console.log(chalk.gray('\nContainers are running. Use `mm-tc stop` to stop or `mm-tc rm` to remove.'));
    } catch (error) {
        console.error(chalk.red('Failed to start environment:'), error);
        process.exit(1);
    }
}
