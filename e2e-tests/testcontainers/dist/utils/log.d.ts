/**
 * Get the output directory path.
 * Priority: setOutputDir() > TC_OUTPUT_DIR env var > default (.tc.out in cwd)
 */
export declare function getOutputDir(): string;
/**
 * Set the output directory path.
 * @param dir Directory path for testcontainers output
 */
export declare function setOutputDir(dir: string): void;
/**
 * Get the log directory path (always <outputDir>/logs).
 */
export declare function getLogDir(): string;
/**
 * @deprecated Use setOutputDir instead. This function is kept for backwards compatibility.
 */
export declare function setLogDir(dir: string): void;
/**
 * Create a log consumer that writes to a file.
 * @param containerName Name of the container (used for the log file name)
 * @returns A log consumer function for testcontainers
 */
export declare function createFileLogConsumer(containerName: string): (stream: NodeJS.ReadableStream) => void;
