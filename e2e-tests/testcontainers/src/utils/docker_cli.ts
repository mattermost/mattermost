// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Safe Docker CLI wrapper.
 *
 * All Docker commands use execFileSync (array-form) to avoid shell interpretation.
 * This eliminates command injection risks from container IDs, image names,
 * environment variables, and other values that may come from external sources
 * (config files, environment variables, .tc.docker.json, etc.).
 */

import {execFileSync, spawnSync} from 'child_process';

const EXEC_OPTIONS: {encoding: 'utf-8'; stdio: ['pipe', 'pipe', 'pipe']} = {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
};

// -- Validation helpers --

const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/;
const NETWORK_ID_RE = /^[a-f0-9]{12,64}$/;

/**
 * Validate a Docker container ID.
 * @throws Error if the ID doesn't match the expected hex format.
 */
export function validateContainerId(id: string): string {
    if (!CONTAINER_ID_RE.test(id)) {
        throw new Error(`Invalid Docker container ID: ${id.substring(0, 80)}`);
    }
    return id;
}

/**
 * Validate a Docker network ID.
 * @throws Error if the ID doesn't match the expected hex format.
 */
export function validateNetworkId(id: string): string {
    if (!NETWORK_ID_RE.test(id)) {
        throw new Error(`Invalid Docker network ID: ${id.substring(0, 80)}`);
    }
    return id;
}

// -- Container inspection --

/**
 * Check if a container is running.
 */
export function isContainerRunning(containerId: string): boolean {
    validateContainerId(containerId);
    try {
        const result = execFileSync('docker', ['inspect', '--format', '{{.State.Running}}', containerId], EXEC_OPTIONS);
        return result.trim() === 'true';
    } catch {
        return false;
    }
}

/**
 * Check if a container exists (regardless of state).
 */
export function containerExists(containerId: string): boolean {
    validateContainerId(containerId);
    try {
        execFileSync('docker', ['inspect', containerId], EXEC_OPTIONS);
        return true;
    } catch {
        return false;
    }
}

/**
 * Inspect a container and return the full JSON.
 */
export function inspectContainer(containerId: string): Record<string, unknown> {
    validateContainerId(containerId);
    const result = execFileSync('docker', ['inspect', containerId], EXEC_OPTIONS);
    return JSON.parse(result)[0];
}

/**
 * Get the container name.
 */
export function getContainerName(containerId: string): string {
    validateContainerId(containerId);
    return execFileSync('docker', ['inspect', '--format', '{{.Name}}', containerId], EXEC_OPTIONS).trim();
}

/**
 * Get the container image.
 */
export function getContainerImage(containerId: string): string {
    validateContainerId(containerId);
    return execFileSync('docker', ['inspect', '--format', '{{.Config.Image}}', containerId], EXEC_OPTIONS).trim();
}

/**
 * Get the mapped host port for a container's internal port.
 */
export function getContainerPort(containerId: string, internalPort: number): number | null {
    validateContainerId(containerId);
    try {
        const result = execFileSync('docker', ['port', containerId, String(internalPort)], EXEC_OPTIONS).trim();
        const match = result.match(/:(\d+)$/m);
        return match ? parseInt(match[1], 10) : null;
    } catch {
        return null;
    }
}

// -- Container lifecycle --

export function stopContainer(containerId: string): void {
    validateContainerId(containerId);
    execFileSync('docker', ['stop', containerId], EXEC_OPTIONS);
}

export function startContainer(containerId: string): void {
    validateContainerId(containerId);
    execFileSync('docker', ['start', containerId], EXEC_OPTIONS);
}

export function restartContainer(containerId: string): void {
    validateContainerId(containerId);
    execFileSync('docker', ['restart', containerId], EXEC_OPTIONS);
}

export function removeContainer(containerId: string): void {
    validateContainerId(containerId);
    execFileSync('docker', ['rm', containerId], EXEC_OPTIONS);
}

// -- Container exec --

/**
 * Execute a command inside a container. Returns stdout.
 */
export function execInContainer(containerId: string, command: string[], env?: Record<string, string>): string {
    validateContainerId(containerId);
    const args = ['exec'];
    if (env) {
        for (const [key, value] of Object.entries(env)) {
            args.push('-e', `${key}=${value}`);
        }
    }
    args.push(containerId, ...command);
    return execFileSync('docker', args, EXEC_OPTIONS).trim();
}

// -- Network --

/**
 * List network IDs matching a label filter.
 */
export function listNetworksByLabel(label: string): string[] {
    try {
        const result = execFileSync(
            'docker',
            ['network', 'ls', '-q', '--filter', `label=${label}`],
            EXEC_OPTIONS,
        ).trim();
        return result
            ? result
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];
    } catch {
        return [];
    }
}

export function removeNetwork(networkId: string): void {
    validateNetworkId(networkId);
    execFileSync('docker', ['network', 'rm', networkId], EXEC_OPTIONS);
}

// -- Container listing --

/**
 * List container IDs matching a label filter (includes stopped containers).
 */
export function listContainersByLabel(label: string): string[] {
    try {
        const result = execFileSync('docker', ['ps', '-aq', '--filter', `label=${label}`], EXEC_OPTIONS).trim();
        return result
            ? result
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];
    } catch {
        return [];
    }
}

// -- Image operations --

/**
 * Check if a Docker image exists locally.
 */
export function imageExistsLocally(image: string): boolean {
    try {
        const result = execFileSync('docker', ['images', '-q', image], EXEC_OPTIONS).trim();
        return result.length > 0;
    } catch {
        return false;
    }
}

/**
 * Get the creation date of a local Docker image.
 */
export function getImageCreatedDate(image: string): Date | null {
    try {
        const result = execFileSync(
            'docker',
            ['image', 'inspect', '--format', '{{.Created}}', image],
            EXEC_OPTIONS,
        ).trim();
        return new Date(result);
    } catch {
        return null;
    }
}

/**
 * Pull a Docker image. Uses spawnSync for potentially long-running pulls.
 */
export function pullImage(image: string, platform?: string): void {
    const args = ['pull'];
    if (platform) {
        args.push('--platform', platform);
    }
    args.push(image);
    const result = spawnSync('docker', args, {stdio: ['pipe', 'pipe', 'pipe']});
    if (result.status !== 0) {
        throw new Error(`docker pull exited with code ${result.status}`);
    }
}

// -- Docker run (for upgrade) --

export interface DockerRunOptions {
    platform?: string;
    network?: string;
    networkAliases?: string[];
    env?: string[];
    portMapping?: string;
    labels?: Record<string, string>;
    image: string;
}

/**
 * Run a new container with the given options. Returns the new container ID.
 */
export function dockerRun(options: DockerRunOptions): string {
    const args = ['run', '-d'];

    if (options.platform) {
        args.push('--platform', options.platform);
    }
    if (options.network) {
        args.push('--network', options.network);
    }
    if (options.networkAliases) {
        for (const alias of options.networkAliases) {
            args.push('--network-alias', alias);
        }
    }
    if (options.env) {
        for (const envVar of options.env) {
            args.push('-e', envVar);
        }
    }
    if (options.portMapping) {
        args.push('-p', options.portMapping);
    }
    if (options.labels) {
        for (const [key, value] of Object.entries(options.labels)) {
            args.push('--label', `${key}=${value}`);
        }
    }
    args.push(options.image);

    return execFileSync('docker', args, EXEC_OPTIONS).trim();
}
