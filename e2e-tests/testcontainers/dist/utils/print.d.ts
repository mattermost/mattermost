import { DependencyConnectionInfo, ContainerMetadataMap } from '../config/types';
/**
 * Build environment variables for the Mattermost server from connection info.
 * These can be used to start a local server pointing to testcontainers dependencies.
 */
export declare function buildServerEnvVars(info: DependencyConnectionInfo): Record<string, string>;
/**
 * Print environment variables for the Mattermost server in a format that can be sourced.
 * @param info Service connection information
 * @param logger Optional custom logger function (defaults to console.log)
 */
export declare function printServerEnvVars(info: DependencyConnectionInfo, logger?: (msg: string) => void): void;
/**
 * Print connection info for all dependencies in the test environment.
 * @param info Service connection information
 * @param logger Optional custom logger function (defaults to console.log)
 */
export declare function printConnectionInfo(info: DependencyConnectionInfo, logger?: (msg: string) => void): void;
/**
 * Write environment variables to a file that can be sourced by shell.
 * Includes section comments for each dependency.
 * @param info Service connection information
 * @param outputDir Directory to write the file to
 * @param options Options for file generation
 * @param options.depsOnly Whether running in deps-only mode (adds MM_NO_DOCKER)
 * @param options.filename Filename (default: .env.tc)
 * @returns The full path to the written file
 */
export declare function writeEnvFile(info: DependencyConnectionInfo, outputDir: string, options?: {
    depsOnly?: boolean;
    filename?: string;
}): string;
/**
 * Write server configuration to a JSON file.
 * @param config Server configuration object (from mmctl config show)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: .tc.server.config.json)
 * @returns The full path to the written file
 */
export declare function writeServerConfig(config: Record<string, unknown>, outputDir: string, filename?: string): string;
/**
 * Build Docker container information from connection info and metadata.
 * @param info Service connection information
 * @param metadata Container metadata (ID, name, labels)
 * @returns Object with container details for each service
 */
export declare function buildDockerInfo(info: DependencyConnectionInfo, metadata?: ContainerMetadataMap): Record<string, unknown>;
/**
 * Write Docker container information to a JSON file.
 * @param info Service connection information
 * @param metadata Container metadata (ID, name, labels)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: .tc.docker.json)
 * @returns The full path to the written file
 */
export declare function writeDockerInfo(info: DependencyConnectionInfo, metadata: ContainerMetadataMap | undefined, outputDir: string, filename?: string): string;
export declare const KEYCLOAK_SAML_CERTIFICATE = "-----BEGIN CERTIFICATE-----\nMIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0MB4XDTI0MDIyMTIwNDA0OFoXDTM0MDIyMTIwNDIyOFowFTETMBEGA1UEAwwKbWF0dGVybW9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOnsgNexkO5tbKkFXN+SdMUuLHbqdjZ9/JSnKrYPHLarf8801YDDzV8wI9jjdCCgq+xtKFKWlwU2rGpjPbefDLV1m7CSu0Iq+hNxDiBdX3wkEIK98piDpx+xYGL0aAbXn3nAlqFOWQJLKLM1I65ZmK31YZeVj4Kn01W4WfsvKHoxPjLPwPTug4HB6vaQXqEpzYYYHyuJKvIYNuVwo0WQdaPRXb0poZoYzOnoB6tOFrim6B7/chqtZeXQc7h6/FejBsV59aO5uATI0aAJw1twzjCNIiOeJLB2jlLuIMR3/Yaqr8IRpRXzcRPETpisWNilhV07ZBW0YL9ZwuU4sHWy+iMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW4I1egm+czdnnZxTtth3cjCmLg/UsalUDKSfFOLAlnbe6TtVhP4DpAl+OaQO4+kdEKemLENPmh4ddaHUjSSbbCQZo8B7IjByEe7x3kQdj2ucQpA4bh0vGZ11pVhk5HfkGqAO+UVNQsyLpTmWXQ8SEbxcw6mlTM4SjuybqaGOva1LBscI158Uq5FOVT6TJaxCt3dQkBH0tK+vhRtIM13pNZ/+SFgecn16AuVdBfjjqXynefrSihQ20BZ3NTyjs/N5J2qvSwQ95JARZrlhfiS++L81u2N/0WWni9cXmHsdTLxRrDZjz2CXBNeFOBRio74klSx8tMK27/2lxMsEC7R+DA==\n-----END CERTIFICATE-----";
/**
 * Write Keycloak SAML certificate to the output directory.
 * This certificate can be uploaded to Mattermost via System Console or API.
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: saml-idp.crt)
 * @returns The full path to the written file
 */
export declare function writeKeycloakCertificate(outputDir: string, filename?: string): string;
/**
 * Write OpenLDAP setup documentation to the output directory.
 * @param info Service connection information (must include openldap)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: openldap_setup.md)
 * @returns The full path to the written file, or null if openldap not configured
 */
export declare function writeOpenLdapSetup(info: DependencyConnectionInfo, outputDir: string, filename?: string): string | null;
/**
 * Write Keycloak setup documentation to the output directory.
 * @param info Service connection information (must include keycloak)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: keycloak_setup.md)
 * @returns The full path to the written file, or null if keycloak not configured
 */
export declare function writeKeycloakSetup(info: DependencyConnectionInfo, outputDir: string, filename?: string): string | null;
