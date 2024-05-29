// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ipaddr from 'ipaddr.js';

import type {AllowedIPRange} from '@mattermost/types/config';

export function isIPAddressInRanges(ipAddress: string, allowedIPRanges: AllowedIPRange[]): boolean {
    const usersAddr = ipaddr.parse(ipAddress);

    for (const allowedIPRange of allowedIPRanges) {
        const cidrBlock = allowedIPRange.cidr_block;
        const [addr, mask] = ipaddr.parseCIDR(cidrBlock);

        if (usersAddr.kind() !== addr.kind()) {
            // We can only compare ipv4 to ipv4 and ipv6 to ipv6, cannot compare ipv4 to ipv6
            continue;
        }

        if (usersAddr.match([addr, mask])) {
            return true;
        }
    }

    return false;
}

export function validateCIDR(cidr: string) {
    try {
        ipaddr.parseCIDR(cidr);
    } catch (e) {
        return false;
    }

    return true;
}
