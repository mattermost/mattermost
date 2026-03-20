// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {SourceBranchIcon} from '@mattermost/compass-icons/components';

import Tooltip from 'src/components/widgets/tooltip';
import {ChecklistItem} from 'src/types/playbook';

interface ConditionIndicatorProps {
    checklistItem: ChecklistItem;
    tooltipMessage: string;
}

const ConditionIndicator = ({checklistItem, tooltipMessage}: ConditionIndicatorProps) => {
    if (!checklistItem.condition_id) {
        return null;
    }

    const useErrorColor = checklistItem.condition_action === 'shown_because_modified';
    const tooltipId = `condition-indicator-${checklistItem.id || 'new'}`;
    const iconColor = useErrorColor ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.56)';

    return (
        <Tooltip
            id={tooltipId}
            content={tooltipMessage}
        >
            <IconWrapper data-testid={useErrorColor ? 'condition-indicator-error' : 'condition-indicator'}>
                <SourceBranchIcon
                    size={14}
                    color={iconColor}
                />
            </IconWrapper>
        </Tooltip>
    );
};

const IconWrapper = styled.span`
    margin-right: 6px;
    transform: rotate(90deg);
`;

export default ConditionIndicator;
