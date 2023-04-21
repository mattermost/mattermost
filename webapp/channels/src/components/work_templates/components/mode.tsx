// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {Preferences, Touched} from 'utils/constants';

import usePreference from 'components/common/hooks/usePreference';
import Tabs from 'components/modal_tabs';

import {ModalState} from '../types';
import Badge from './badge';

// need click shielding
function Tourtip() {
    const intl = useIntl();

    return (
        <div>
            {intl.formatMessage({id: 'work_templates.mode.tourtip_title', defaultMessage: 'Try one of our templates'})}
            {intl.formatMessage({id: 'work_templates.mode.tourtip_what', defaultMessage: 'Our templates cover a variety of use cases and include critical tools.'})}
        </div>
    );
}

interface Props {
    mode: ModalState;
    setMode: (mode: ModalState) => void;
}
function Mode(props: Props) {
    const [originalMode] = useState(props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu);
    const currentMode = props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu;
    const intl = useIntl();
    const templatesNew = usePreference(Preferences.TOUCHED, Touched.ADD_CHANNEL_TEMPLATE_MODE)[0] !== 'true';
    if (props.mode !== ModalState.ChannelOnly && props.mode !== ModalState.Menu) {
        return null;
    }
    return (<div>
        <div>
            <Tabs
                tabs={[
                    {
                        content: intl.formatMessage({
                            id: 'work_templates.mode.new',
                            defaultMessage: 'New',
                        }),
                        onClick: () => props.setMode(ModalState.ChannelOnly),
                        key: ModalState.ChannelOnly,
                        testId: 'mode-channel',
                    },
                    {
                        content: (
                            <div>
                                {intl.formatMessage({
                                    id: 'work_templates.mode.templates',
                                    defaultMessage: 'Templates',
                                })}
                                {templatesNew && (
                                    <>
                                        <BadgeSpacer/>
                                        <Badge>
                                            {intl.formatMessage({
                                                id: 'work_templates.mode.templates_new',
                                                defaultMessage: 'New',
                                            })}
                                        </Badge>
                                    </>
                                )
                                }
                                <Tourtip/>
                            </div>
                        ),
                        onClick: () => props.setMode(ModalState.Menu),
                        testId: 'mode-work-template',
                        key: ModalState.Menu,
                    },
                ]}
                startKey={originalMode}
                selected={currentMode}
            />
        </div>
    </div>);
}

const StyledMode = styled(Mode)`
`;
const BadgeSpacer = styled.span`
  padding-left: 6px;
`;
export default StyledMode;
