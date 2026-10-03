// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {HEALTH_FINDING_TABS} from 'mattermost-redux/utils/health_utils';
import type {HealthFindingTab} from 'mattermost-redux/utils/health_utils';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import {severityMessages, stateMessages, ToneIcon} from './severity';

const {KeyCodes} = Constants;

export function tabId(prefix: string, tab: HealthFindingTab) {
    return `${prefix}-tab-${tab}`;
}

const TabLabel = ({tab}: {tab: HealthFindingTab}) => {
    if (tab === 'open') {
        return (
            <FormattedMessage
                id='admin.health_dashboard.tab.open'
                defaultMessage='Open'
            />
        );
    }
    if (tab === 'resolved' || tab === 'unknown') {
        return <FormattedMessage {...stateMessages[tab]}/>;
    }
    return <FormattedMessage {...severityMessages[tab]}/>;
};

type Props = {
    idPrefix: string;
    panelId: string;
    active: HealthFindingTab;
    counts: Record<HealthFindingTab, number>;
    onChange: (tab: HealthFindingTab) => void;
};

const FindingTabs = ({idPrefix, panelId, active, counts, onChange}: Props) => {
    const {formatMessage} = useIntl();
    const buttons = useRef<Partial<Record<HealthFindingTab, HTMLButtonElement | null>>>({});

    const select = (tab: HealthFindingTab) => {
        onChange(tab);
        buttons.current[tab]?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const index = HEALTH_FINDING_TABS.indexOf(active);
        const last = HEALTH_FINDING_TABS.length - 1;

        let next: number;
        if (isKeyPressed(e, KeyCodes.RIGHT)) {
            next = index === last ? 0 : index + 1;
        } else if (isKeyPressed(e, KeyCodes.LEFT)) {
            next = index === 0 ? last : index - 1;
        } else if (isKeyPressed(e, KeyCodes.HOME)) {
            next = 0;
        } else if (isKeyPressed(e, KeyCodes.END)) {
            next = last;
        } else {
            return;
        }

        e.preventDefault();
        select(HEALTH_FINDING_TABS[next]);
    };

    return (
        <div
            role='tablist'
            className='HealthDashboard__tabs'
            aria-label={formatMessage({id: 'admin.health_dashboard.tabs.label', defaultMessage: 'Filter findings'})}
        >
            {HEALTH_FINDING_TABS.map((tab) => {
                const selected = tab === active;
                return (
                    <button
                        key={tab}
                        ref={(element) => {
                            buttons.current[tab] = element;
                        }}
                        id={tabId(idPrefix, tab)}
                        type='button'
                        role='tab'
                        aria-selected={selected}
                        aria-controls={panelId}
                        tabIndex={selected ? 0 : -1}
                        className={classNames('HealthDashboard__tab', `HealthDashboard__tab--${tab}`, {'HealthDashboard__tab--active': selected})}
                        onClick={() => onChange(tab)}
                        onKeyDown={handleKeyDown}
                    >
                        {tab !== 'open' && <ToneIcon tone={tab}/>}
                        <TabLabel tab={tab}/>
                        <span className='HealthDashboard__tabCount'>{counts[tab]}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default FindingTabs;
