// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect} from 'react';
import {useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';

import {Draft} from 'selectors/drafts';

import NoResultsIndicator from 'components/no_results_indicator';
import Header from 'components/widgets/header';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import type {UserProfile, UserStatus} from '@mattermost/types/users';

import DraftRow from './draft_row';
import DraftsIllustration from './drafts_illustration';

import './drafts.scss';

type Props = {
    drafts: Draft[];
    user: UserProfile;
    displayName: string;
    status: UserStatus['status'];
    localDraftsAreEnabled: boolean;
    draftRemotes: Record<string, boolean>;
}

function Drafts({
    displayName,
    drafts,
    draftRemotes,
    status,
    user,
    localDraftsAreEnabled,
}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, []);

    if (!localDraftsAreEnabled) {
        return null;
    }

    return (
        <div
            id='app-content'
            className='Drafts app__content'
        >
            <Header
                level={2}
                className='Drafts__header'
                heading={formatMessage({
                    id: 'drafts.heading',
                    defaultMessage: 'Drafts',
                })}
                subtitle={formatMessage({
                    id: 'drafts.subtitle',
                    defaultMessage: 'Any messages you\'ve started will show here',
                })}
            />
            <div className='Drafts__main'>
                {drafts.map((d) => (
                    <DraftRow
                        key={d.key}
                        displayName={displayName}
                        draft={d}
                        isRemote={draftRemotes?.[d.key]}
                        user={user}
                        status={status}
                    />
                ))}
                {drafts.length === 0 && (
                    <NoResultsIndicator
                        expanded={true}
                        iconGraphic={DraftsIllustration}
                        title={formatMessage({
                            id: 'drafts.empty.title',
                            defaultMessage: 'No drafts at the moment',
                        })}
                        subtitle={formatMessage({
                            id: 'drafts.empty.subtitle',
                            defaultMessage: 'Any messages you’ve started will show here.',
                        })}
                    />
                )}
            </div>
        </div>
    );
}

export default memo(Drafts);
