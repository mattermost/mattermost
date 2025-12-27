// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import {openModal} from 'actions/views/modals';

import AboutBuildModal from 'components/about_build_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    siteName?: string;
}

export default function ProductSwitcherAboutMenuItem(props: Props) {
    const dispatch = useDispatch();

    function handleClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.ABOUT,
            dialogType: AboutBuildModal,
        }));
    }

    return (
        <Menu.Item
            leadingElement={<InformationOutlineIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='productSwitcherMenu.about.label'
                    defaultMessage='About {appTitle}'
                    values={{appTitle: props.siteName || 'Mattermost'}}
                />
            }
            onClick={handleClick}
        />
    );
}

