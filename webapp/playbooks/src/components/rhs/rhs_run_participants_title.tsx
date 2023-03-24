import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import {OVERLAY_DELAY} from 'src/constants';
import {HeaderSubtitle, HeaderVerticalDivider} from 'src/components/backstage/playbook_runs/playbook_run/rhs';

import {RHSTitleButton, RHSTitleContainer, RHSTitleText} from './rhs_title_common';

interface Props {
    onBackClick: () => void
    runName: string
}

const RHSRunParticipantsTitle = (props: Props) => {
    const {formatMessage} = useIntl();

    const tooltip = (
        <Tooltip id={'view-run-overview'}>
            {formatMessage({defaultMessage: 'Manage run participants list'})}
        </Tooltip>
    );

    return (
        <RHSTitleContainer>
            <RHSTitleButton
                onClick={props.onBackClick}
                data-testid='back-button'
            >
                <LeftChevron/>
            </RHSTitleButton>

            <OverlayTrigger
                placement={'top'}
                delay={OVERLAY_DELAY}
                overlay={tooltip}
            >
                <RHSTitleText>
                    {formatMessage({defaultMessage: 'Run participants'})}
                </RHSTitleText>
            </OverlayTrigger>
            <HeaderVerticalDivider/>
            {<HeaderSubtitle data-testid='rhs-subtitle'>{props.runName}</HeaderSubtitle>}
        </RHSTitleContainer>
    );
};

export default RHSRunParticipantsTitle;
