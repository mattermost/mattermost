// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {PlusIcon} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';
import {WikiTypes} from 'mattermost-redux/action_types';
import {getCurrentTeam, getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import TextInputModal from 'components/text_input_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    channelId: string;
};

function WikiCreateButton({channelId}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const teamUrl = useSelector((state: GlobalState) =>
        getCurrentRelativeTeamUrl(state),
    );

    const handleCreateWiki = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_WIKI,
            dialogType: TextInputModal,
            dialogProps: {
                modalId: ModalIdentifiers.CREATE_WIKI,
                title: formatMessage({id: 'wiki_tab.create_modal_title', defaultMessage: 'Create wiki'}),
                placeholder: formatMessage({id: 'wiki_tab.create_modal_placeholder', defaultMessage: 'Enter wiki name'}),
                confirmButtonText: formatMessage({id: 'wiki_tab.create_modal_confirm', defaultMessage: 'Create'}),
                onConfirm: async (title: string) => {
                    const wiki = await Client4.createWiki({
                        channel_id: channelId,
                        title,
                    });

                    if (wiki) {
                        dispatch({
                            type: WikiTypes.RECEIVED_WIKI,
                            data: wiki,
                        });

                        if (currentTeam) {
                            history.push(`${teamUrl}/wiki/${channelId}/${wiki.id}`);
                        }
                    }
                },
                onCancel: () => {},
            },
        }));
    }, [dispatch, formatMessage, channelId, currentTeam, history, teamUrl]);

    return (
        <button
            className='wiki-create-button'
            onClick={handleCreateWiki}
            aria-label={formatMessage({id: 'wiki_tab.create_button_label', defaultMessage: 'Create new wiki'})}
            type='button'
        >
            <PlusIcon size={18}/>
        </button>
    );
}

export default WikiCreateButton;
