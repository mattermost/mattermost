// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';

import {useAllowPrivatePlaybooks} from 'src/hooks';
import Tooltip from 'src/components/widgets/tooltip';

type Props = {
    public: boolean
    setPlaybookPublic: (pub: boolean) => void
    disableOtherOption: boolean
}

const HorizontalContainer = styled.div`
	display: flex;
	height: 70px;
`;

const BigButton = styled.button`
	display: flex;
	flex-basis: 0;
	flex-grow: 1;
	align-items: center;
    padding: 16px 12px;
    border: var(--border-default);
    border-radius: var(--radius-s);
	margin: 4px;
    background: var(--center-channel-bg);
    box-shadow: var(--elevation-1);

    &:hover {
        border: var(--border-dark);
        box-shadow: var(--elevation-2);
    }

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        opacity: 0.6;
    }
`;

const StackedText = styled.div`
	flex-grow: 1;
	text-align: left;
`;

const GiantIcon = styled.i<{active?: boolean}>`
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    margin-right: 12px;
    background: ${(props) => (props.active ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
	color: ${(props) => (props.active ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};
    font-size: 28px;
	line-height: 28px;

    &::before {
        margin: 0;
    }
`;

const CheckIcon = styled.i`
	color: var(--button-bg);
	font-size: 24px;
	line-height: 24px;
`;

const BigText = styled.div`
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
`;

const SmallText = styled.div`
	color: rgba(var(--center-channel-color-rgb), 0.56);
	font-size: 12px;
	line-height: 16px;
`;

const PositionedKeyVariantCircleIcon = styled(KeyVariantCircleIcon)`
    margin-left: 8px;
    color: var(--online-indicator);
    vertical-align: sub;
`;

const PublicPrivateSelector = (props: Props) => {
    const {formatMessage} = useIntl();

    const handleButtonClick = props.setPlaybookPublic;

    const publicButtonDisabled = !props.public && props.disableOtherOption;
    const privateButtonDisabled = props.public && props.disableOtherOption;

    return (
        <HorizontalContainer>
            <BigButton
                onClick={(e) => {
                    e.preventDefault();
                    handleButtonClick(true);
                }}
                disabled={publicButtonDisabled}
                title={publicButtonDisabled ? formatMessage({defaultMessage: 'You do not have permissions'}) : formatMessage({defaultMessage: 'Public'})}
            >
                <GiantIcon
                    active={props.public}
                    className={'icon-globe'}
                />
                <StackedText>
                    <BigText>{formatMessage({defaultMessage: 'Public playbook'})}</BigText>
                    <SmallText>{formatMessage({defaultMessage: 'Anyone on the team can view'})}</SmallText>
                </StackedText>
                {props.public &&
                <CheckIcon
                    className={'icon-check-circle'}
                />
                }
            </BigButton>
            <PrivateButton
                public={props.public}
                publicButtonDisabled={publicButtonDisabled}
                privateButtonDisabled={privateButtonDisabled}
                onClick={(e) => {
                    e.preventDefault();
                    handleButtonClick(false);
                }}
            />
        </HorizontalContainer>
    );
};

const PrivateButton = (props: {public: boolean, publicButtonDisabled: boolean, privateButtonDisabled: boolean, onClick: (e: any) => void}) => {
    const {formatMessage} = useIntl();
    const privatePlaybooksAllowed = useAllowPrivatePlaybooks();

    const button = (
        <BigButton
            onClick={props.onClick}
            disabled={!privatePlaybooksAllowed || props.privateButtonDisabled}
            title={props.publicButtonDisabled ? formatMessage({defaultMessage: 'You do not have permissions'}) : formatMessage({defaultMessage: 'Private'})}
        >
            <GiantIcon
                active={!props.public}
                className={'icon-lock-outline'}
            />
            <StackedText>
                <BigText>
                    {formatMessage({defaultMessage: 'Private playbook'})}
                    {!privatePlaybooksAllowed &&
                    <PositionedKeyVariantCircleIcon/>
                    }
                </BigText>
                <SmallText>{formatMessage({defaultMessage: 'Only invited members'})}</SmallText>
            </StackedText>
            {!props.public &&
            <CheckIcon
                className={'icon-check-circle'}
            />
            }
        </BigButton>
    );

    if (privatePlaybooksAllowed) {
        return button;
    }

    return (
        <Tooltip
            id={'private-playbooks-upgrade-badge'}
            content={formatMessage({defaultMessage: 'Private playbooks are only available in Mattermost Enterprise'})}
        >
            {button}
        </Tooltip>
    );
};

export default PublicPrivateSelector;
