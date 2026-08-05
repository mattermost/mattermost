// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function buildQueryString(parameters: Record<string, any>): string {
    const keys = Object.keys(parameters);
    if (keys.length === 0) {
        return '';
    }

    const queryParams = Object.entries(parameters).
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        filter(([_, value]) => value !== undefined).
        map(([key, value]) => `${key}=${encodeURIComponent(value)}`).
        join('&');

    return queryParams.length > 0 ? `?${queryParams}` : '';
}

// extractFilenameFromContentDisposition returns the filename advertised by a Content-Disposition
// response header, falling back to the given name when the header is missing or unparsable.
export function extractFilenameFromContentDisposition(header: string | null | undefined, fallback: string): string {
    if (!header) {
        return fallback;
    }

    // RFC 6266 prefers the RFC 5987 extended parameter when a header carries both.
    const extended = (/filename\*\s*=\s*([^;]*)/i).exec(header);
    if (extended) {
        const decoded = decodeExtendedFilename(extended[1].trim());
        if (decoded) {
            return decoded;
        }
    }

    // A quoted value may legitimately contain the ";" parameter separator, so consume it as a
    // unit. An unquoted value ends at the next ";" or at the end of the header; without that
    // bound a trailing parameter such as "; size=1" would be read as part of the filename.
    const quoted = (/filename\s*=\s*"((?:\\.|[^"])*)"/i).exec(header) ??
        (/filename\s*=\s*'((?:\\.|[^'])*)'/i).exec(header);
    if (quoted) {
        return quoted[1].replace(/\\(.)/g, '$1').trim() || fallback;
    }

    const unquoted = (/filename\s*=\s*([^;]*)/i).exec(header);
    if (unquoted) {
        return unquoted[1].trim() || fallback;
    }

    return fallback;
}

// decodeExtendedFilename decodes an RFC 5987 "charset'language'percent-encoded-value" parameter.
// It returns an empty string when the value is malformed or percent-decoding fails, so callers
// fall through to the plain "filename" parameter rather than surfacing a partial value.
function decodeExtendedFilename(value: string): string {
    const parts = (/^[\w-]+'[\w-]*'(.*)$/).exec(value);
    if (!parts) {
        return '';
    }

    try {
        return decodeURIComponent(parts[1]).trim();
    } catch {
        return '';
    }
}
