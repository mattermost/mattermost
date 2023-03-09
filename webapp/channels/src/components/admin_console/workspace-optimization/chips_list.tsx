// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Chip from 'components/common/chip/chip';

import {ItemStatus} from './dashboard.data';

import './dashboard.scss';

export type ChipsInfoType = Record<ItemStatus.INFO | ItemStatus.WARNING | ItemStatus.ERROR, number>;

type ChipsListProps = {
    chipsData: ChipsInfoType;
    hideCountZeroChips: boolean;
};

const ChipsList = ({
    chipsData,
    hideCountZeroChips,
}: ChipsListProps): JSX.Element | null => {
    const chipsList = Object.entries(chipsData).map(([chipKey, count]) => {
        if (hideCountZeroChips && count === 0) {
            return false;
        }
        let chipLegend;
        switch (chipKey) {
        case ItemStatus.INFO:
            chipLegend = (
                <FormattedMessage
                    id={'admin.reporting.workspace_optimization.chip_suggestions'}
                    defaultMessage={'Suggestions: {count}'}
                    values={{count}}
                />
            );
            break;
        case ItemStatus.WARNING:
            chipLegend = (
                <FormattedMessage
                    id={'admin.reporting.workspace_optimization.chip_warnings'}
                    defaultMessage={'Warnings: {count}'}
                    values={{count}}
                />
            );
            break;
        case ItemStatus.ERROR:
        default:
            chipLegend = (
                <FormattedMessage
                    id={'admin.reporting.workspace_optimization.chip_problems'}
                    defaultMessage={'Problems: {count}'}
                    values={{count}}
                />
            );
            break;
        }

        return (
            <Chip
                key={chipKey}
                additionalMarkup={chipLegend}
                className={chipKey}
            />
        );
    });

    if (chipsList.length === 0) {
        return null;
    }

    return (
        <>
            {chipsList}
        </>
    );
};

export default ChipsList;
