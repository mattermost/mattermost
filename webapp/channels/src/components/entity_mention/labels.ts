// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const labels: Record<string, string> = {
    'mm.vuln': 'Vulnerability',
    'mm.ip': 'IP address',
    'mm.attack': 'ATT&CK',
};

export function entityLabel(typeId: string) {
    return labels[typeId] || typeId;
}
