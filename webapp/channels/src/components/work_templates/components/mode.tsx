// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {Preferences, Touched} from 'utils/constants';

import usePreference from 'components/common/hooks/usePreference';
import useTooltip from 'components/common/hooks/useTooltip';
import {useMeasurePunchouts} from '@mattermost/components';
import Tabs from 'components/modal_tabs';
import {CloseIcon} from '@mattermost/compass-icons/components';

import {ModalState} from '../types';
import Badge from './badge';
import ClickShield from './click_shield';

interface Props {
    mode: ModalState;
    setMode: (mode: ModalState) => void;
}

const INDEX_ABOVE_OTHER_TEMPLATE_MODAL_CONTENT = 4;
function Mode(props: Props) {
    const [originalMode] = useState(props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu);
    const currentMode = props.mode === ModalState.ChannelOnly ? ModalState.ChannelOnly : ModalState.Menu;
    const intl = useIntl();
    const templatesNew = usePreference(Preferences.TOUCHED, Touched.ADD_CHANNEL_TEMPLATE_MODE)[0] !== 'true';
    const [knowsTemplatesExistString, setKnowsTemplatesExist] = usePreference(Preferences.TOUCHED, Touched.KNOWS_TEMPLATES_EXIST);
    const knowsTemplatesExist = knowsTemplatesExistString === 'true';
    const punchout = useMeasurePunchouts(['work-templates-mode-tip-body'], []);
    const {
        reference,
        getReferenceProps,
        tooltip,
    } = useTooltip({
        open: !knowsTemplatesExist,
        message: (
            <TipBody id="work-templates-mode-tip-body" onClick={(e: React.MouseEvent) => {e.stopPropagation();}}>
                <TipHeader>
                    <div>
                        {intl.formatMessage({id: 'work_templates.mode.tourtip_title', defaultMessage: 'Try one of our templates'})}
                    </div>
                    <TipDismiss
                        onClick={(e) => {
                            // otherwise, even if its in a portal,
                            // the click will be propagated
                            // up to the templates tab and change view
                            // but we do not want that
                            e?.stopPropagation();
                            setKnowsTemplatesExist('true');
                        }}
                    >
                        <CloseIcon
                            size={18}
                            color='rgba(var(--button-color-rgb), 0.9)'
                        />
                    </TipDismiss>
                </TipHeader>
                <div>
                    {intl.formatMessage({id: 'work_templates.mode.tourtip_what', defaultMessage: 'Our templates cover a variety of use cases and include critical tools.'})}
                </div>
            </TipBody>
        ),
        offset: {mainAxis: 18, crossAxis: templatesNew ? -20 : 10},
        zIndex: INDEX_ABOVE_OTHER_TEMPLATE_MODAL_CONTENT,
        placement: 'bottom-start',
        allowedPlacements: ['bottom-start'],
        strategy: 'absolute',
        primaryActionStyle: true,
    });

    if (props.mode !== ModalState.ChannelOnly && props.mode !== ModalState.Menu) {
        return null;
    }

    return (
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
                            <div >
                                <span
                                    style={{position: 'relative'}}
                                    ref={knowsTemplatesExist ? undefined : reference}
                                    {...(knowsTemplatesExist ? {} : getReferenceProps())}
                                >
                                    {intl.formatMessage({
                                        id: 'work_templates.mode.templates',
                                        defaultMessage: 'Templates',
                                    })}
                                </span>
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
                                    <ClickShield
                                        punchout={punchout} 
                                        onClick={(e: React.MouseEvent) => {
                                            // otherwise, even if its in a portal,
                                            // the click will be propagated
                                            // up to the templates tab and change view
                                            // but we do not want that
                                            e.stopPropagation();
                                            setKnowsTemplatesExist('true');
                                        }}
                                        inRoot={true}
                                   />
                                )}
                                {!knowsTemplatesExist && tooltip}

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
    );
}

const TipBody = styled.div`
    font-weight: 400;
    text-align: left;
    line-height: 20px;
`;
const TipHeader = styled.div`
    display: flex;
    font-weight: 600;
    font-size: 14px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
`;

const StyledMode = styled(Mode)`
`;
const BadgeSpacer = styled.span`
  padding-left: 6px;
`;
const TipDismiss = styled.span`
    cursor: pointer;
`;
export default StyledMode;
