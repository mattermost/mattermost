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
	flex-direction: horizontal;
	height: 70px;
`;

const BigButton = styled.button`
	padding: 16px;
	border: 1px solid rgba(var(--button-bg-rgb), 0.08);
	background: var(--center-channel-bg);
	box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
	border-radius: 4px;
	flex-grow: 1;
	flex-basis: 0;
	margin: 4px;

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        opacity: 0.6;
    }

	display: flex;
	flex-direction: horizontal;
	align-items: center;
`;

const StackedText = styled.div`
	flex-grow: 1;
	text-align: left;
`;

const GiantIcon = styled.i<{active?: boolean}>`
	font-size: 36px;
	line-height: 42px;
	color: ${(props) => (props.active ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

const CheckIcon = styled.i`
	font-size: 24px;
	line-height: 24px;
	color: var(--button-bg);
`;

const BigText = styled.div`
	font-size: 14px;
	line-height: 20px;
	font-weight: 600;
`;

const SmallText = styled.div`
	font-size: 12px;
	line-height: 16px;
	color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const PositionedKeyVariantCircleIcon = styled(KeyVariantCircleIcon)`
    margin-left: 8px;
    vertical-align: sub;
    color: var(--online-indicator);
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
