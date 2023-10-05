import { AllowedIPRange } from '@mattermost/types/config';
import { isIPAddressInRanges } from './ip_filtering_utils';

describe('isIPAddressInRanges', () => {
    const allowedIPRanges = [
        {
            CIDRBlock: '192.168.0.0/24',
            Description: 'Test Filter',
        },
        {
            CIDRBlock: '10.1.0.0/16',
            Description: 'Test Filter 2',
        },
        {
            CIDRBlock: '172.16.0.0/12',
            Description: 'Test Filter 3',
        },
    ] as AllowedIPRange[];

    test('returns true if the IP address is within an allowed IP range', () => {
        expect(isIPAddressInRanges('192.168.0.1', allowedIPRanges)).toBe(true);
        expect(isIPAddressInRanges('10.1.0.1', allowedIPRanges)).toBe(true);
        expect(isIPAddressInRanges('172.16.0.1', allowedIPRanges)).toBe(true);
        expect(isIPAddressInRanges('172.31.255.255', allowedIPRanges)).toBe(true);
    });

    test('returns false if the IP address is not within an allowed IP range', () => {
        expect(isIPAddressInRanges('192.168.1.1', allowedIPRanges)).toBe(false);
        expect(isIPAddressInRanges('172.15.255.255', allowedIPRanges)).toBe(false);
        expect(isIPAddressInRanges('172.32.0.1', allowedIPRanges)).toBe(false);
        expect(isIPAddressInRanges('10.0.55.8', allowedIPRanges)).toBe(false);
    });
});