// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {LimitSummary} from 'components/common/hooks/useGetHighestThresholdCloudLimit';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {FileSizes} from 'utils/file_utils';
import {LimitTypes} from 'utils/limits';

import useWords from './useWords';

interface Props {
    highestLimit: LimitSummary | false;
    isAdminUser: boolean;
}

const emptyText = 'EMPTY TEXT';

function TestEl(props: Props) {
    const words = useWords(props.highestLimit, props.isAdminUser, '');
    if (!words) {
        return <span>{emptyText}</span>;
    }
    return (
        <ul>
            <li>{words.title}</li>
            <li>{words.description}</li>
            <li>{words.status}</li>
        </ul>
    );
}

interface Test {
    label: string;
    expects: {
        empty?: boolean;
        title?: string | RegExp;
        description?: string | RegExp;
        status?: string | RegExp;
    };
    props: Props;
}

const asAdmin = (highestLimit: LimitSummary | false): Props => ({isAdminUser: true, highestLimit});
const asUser = (highestLimit: LimitSummary | false): Props => ({isAdminUser: false, highestLimit});
const mkLimit = (id: LimitSummary['id'], usage: LimitSummary['usage'], limit: LimitSummary['limit']): LimitSummary => ({id, usage, limit});

const oneGb = FileSizes.Gigabyte;

describe('useWords', () => {
    const tests: Test[] = [
        {
            label: 'returns nothing if there is not a highest limit',
            props: {
                highestLimit: false,
                isAdminUser: false,
            },
            expects: {
                empty: true,
            },
        },
        {
            label: 'shows message history warn',
            props: asAdmin(mkLimit(LimitTypes.messageHistory, 5000, 10000)),
            expects: {
                title: 'Total messages',
                description: /closer.*10,000.*message limit/,
                status: '5K',
            },
        },
        {
            label: 'shows message history critical',
            props: asAdmin(mkLimit(LimitTypes.messageHistory, 8000, 10000)),
            expects: {
                title: 'Total messages',
                description: /close to hitting.*10,000.*message/,
                status: '8K',
            },
        },
        {
            label: 'shows message history reached',
            props: asAdmin(mkLimit(LimitTypes.messageHistory, 10000, 10000)),
            expects: {
                title: 'Total messages',
                description: /reached.*message history.*only.*last.*10K.*messages/,
                status: '10K',
            },
        },
        {
            label: 'shows message history exceeded',
            props: asAdmin(mkLimit(LimitTypes.messageHistory, 11000, 10000)),
            expects: {
                title: 'Total messages',
                description: /over.*message history.*only.*last.*10K.*messages/,
                status: '11K',
            },
        },
        {
            label: 'shows file storage warn',
            props: asAdmin(mkLimit(LimitTypes.fileStorage, 0.5 * FileSizes.Gigabyte, oneGb)),
            expects: {
                title: 'File storage limit',
                description: /closer.*1GB.*limit/,
                status: '0.5GB',
            },
        },
        {
            label: 'shows file storage critical',
            props: asAdmin(mkLimit(LimitTypes.fileStorage, 0.8 * FileSizes.Gigabyte, oneGb)),
            expects: {
                title: 'File storage limit',
                description: /closer.*1GB.*limit/,
                status: '0.8GB',
            },
        },
        {
            label: 'shows file storage reached',
            props: asAdmin(mkLimit(LimitTypes.fileStorage, FileSizes.Gigabyte, oneGb)),
            expects: {
                title: 'File storage limit',
                description: /reached.*1GB.*limit/,
                status: '1GB',
            },
        },
        {
            label: 'shows file storage exceeded',
            props: asAdmin(mkLimit(LimitTypes.fileStorage, 1.1 * FileSizes.Gigabyte, oneGb)),
            expects: {
                title: 'File storage limit',
                description: /over.*1GB.*limit/,
                status: '1.1GB',
            },
        },
        {
            label: 'admin prompted to upgrade',
            props: asAdmin(mkLimit(LimitTypes.messageHistory, 6000, 10000)),
            expects: {
                description: 'View upgrade options.',
            },
        },
        {
            label: 'end user prompted to view plans',
            props: asUser(mkLimit(LimitTypes.messageHistory, 6000, 10000)),
            expects: {
                description: 'View plans',
            },
        },
        {
            label: 'end user prompted to notify admin when over limit',
            props: asUser(mkLimit(LimitTypes.messageHistory, 11000, 10000)),
            expects: {
                description: 'Notify admin',
            },
        },
    ];

    const initialState = {
        entities: {
            general: {
                license: {
                    Cloud: 'true',
                },
            },
        },
    };
    tests.forEach((t: Test) => {
        test(t.label, () => {
            renderWithContext(
                <TestEl {...t.props}/>,
                initialState,
            );
            if (t.expects.empty) {
                screen.getByText(emptyText);
            }

            if (t.expects.title) {
                screen.getByText(t.expects.title);
            }

            if (t.expects.description) {
                screen.getByText(t.expects.description);
            }

            if (t.expects.status) {
                screen.getByText(t.expects.status);
            }
        });
    });
});
