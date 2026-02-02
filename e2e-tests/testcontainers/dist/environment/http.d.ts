export interface HttpResponse {
    success: boolean;
    body?: string;
    token?: string;
    error?: string;
}
/**
 * Make an HTTP POST request.
 * @param host Hostname
 * @param port Port number
 * @param path URL path
 * @param body Request body
 * @param headers Request headers
 * @returns Result object with success status, response body, token (from header), and optional error
 */
export declare function httpPost(host: string, port: number, path: string, body: string, headers?: Record<string, string>): Promise<HttpResponse>;
/**
 * Make an HTTP GET request.
 */
export declare function httpGet(host: string, port: number, path: string, headers?: Record<string, string>): Promise<HttpResponse>;
/**
 * Make an HTTP PUT request.
 */
export declare function httpPut(host: string, port: number, path: string, body: string, headers?: Record<string, string>): Promise<HttpResponse>;
