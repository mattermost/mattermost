// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AllowedIPRange} from '@mattermost/types/config';

/**
* Checks if an IP address is within a list of allowed IP ranges.
* @param ipAddress The IP address to check.
* @param allowedIPRanges The list of allowed IP ranges.
* @returns True if the IP address is within an allowed IP range, false otherwise.
*/
export function isIPAddressInRanges(ipAddress: string, allowedIPRanges: AllowedIPRange[]): boolean {
    // Check if the IP address is IPv4 or IPv6
    const isIPv4 = ipAddress.includes('.');
    const isIPv6 = ipAddress.includes(':');

    if (!isIPv4 && !isIPv6) {
        return false;
    }

    // Convert the IP address to a number
    const ipAddressNumber = isIPv4 ?
        ipAddress.split('.').reduce((acc, val) => (acc << 8) + parseInt(val, 10), 0) :
        ipAddress.split(':').reduce((acc, val) => (acc << 16) + parseInt(val, 16), 0);

    // Check if the IP address is encapsulated by any of the allowed IP ranges
    for (const allowedIPRange of allowedIPRanges) {
        // Split the CIDR block and subnet mask from the allowed IP range
        const [cidrBlock, subnetMask] = allowedIPRange.cidr_block.split('/');

        // Convert the CIDR block to a number
        const cidrBlockNumber = isIPv4 ?
            cidrBlock.split('.').reduce((acc, val) => (acc << 8) + parseInt(val, 10), 0) :
            cidrBlock.split(':').reduce((acc, val) => (acc << 16) + parseInt(val, 16), 0);

        // Convert the subnet mask to a number
        const subnetMaskNumber = parseInt(subnetMask, 10);

        try {
            // Calculate the subnet mask bits
            const subnetMaskBits = isIPv4 ?
                (1 << 32 - subnetMaskNumber) - 1 :
                (1 << 128 - subnetMaskNumber) - 1;

            // Invert the subnet mask bits to get the subnet mask number inverted
            const subnetMaskNumberInverted = ~subnetMaskBits;

            // Check if the IP address is within the current allowed IP range
            if ((ipAddressNumber & subnetMaskNumberInverted) === (cidrBlockNumber & subnetMaskNumberInverted)) {
                return true;
            }
        } catch (e) {
            return false;
        }
    }

    return false;
}
