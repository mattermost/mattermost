/**
 * Check if a Docker image exists locally.
 *
 * @param image The image name (e.g., 'postgres:14')
 * @returns true if the image exists locally, false otherwise
 */
export declare function imageExistsLocally(image: string): boolean;
/**
 * Pull a Docker image if it doesn't exist locally.
 *
 * @param image The image name to pull
 * @param onPullStart Callback when pull starts
 * @returns true if the image was pulled, false if it already existed
 */
export declare function pullImageIfNeeded(image: string, onPullStart?: () => void): Promise<boolean>;
