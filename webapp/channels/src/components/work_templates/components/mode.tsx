// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {Preferences, Touched} from 'utils/constants';

import usePreference from 'components/common/hooks/usePreference';
import Tabs from 'components/modal_tabs';
import SingleTip from 'components/common/single_tip';

import {ModalState} from '../types';
import Badge from './badge';

interface TourtipProps {
    children: React.ReactNode | React.ReactNode[];
    show: boolean;
    dismiss: (e?: React.MouseEvent) => void;
    contentRef: React.MutableRefObject<HTMLElement | null>;
}
function Tourtip(props: TourtipProps) {
    return (
        <SingleTip
            placement={'bottom'}
            offset={[0,0]}
            tippyBlueStyle={true}
            hideBackdrop={true}
            show={props.show}
            handleDismiss={props.dismiss}
            contentRef={props.contentRef}
        >
            {props.children}
        </SingleTip>
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
    const [knowsTemplatesExistString, setKnowsTemplatesExist] = usePreference(Preferences.TOUCHED, Touched.KNOWS_TEMPLATES_EXIST);
    const knowsTemplatesExist = knowsTemplatesExistString === 'true'
    const templatesTabRef = useRef(null);

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
                            <div ref={templatesTabRef}>
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
                                {!knowsTemplatesExist && (
                                    <Tourtip
                                        contentRef={templatesTabRef}
                                        show={!knowsTemplatesExist}
                                        dismiss={(e) => {
                                            e?.stopPropagation();
                                            setKnowsTemplatesExist('true');
                                        }}
                                    >
                                        {intl.formatMessage({id: 'work_templates.mode.tourtip_title', defaultMessage: 'Try one of our templates'})}
                                        {intl.formatMessage({id: 'work_templates.mode.tourtip_what', defaultMessage: 'Our templates cover a variety of use cases and include critical tools.'})}
                                    </Tourtip>
                                )}
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
