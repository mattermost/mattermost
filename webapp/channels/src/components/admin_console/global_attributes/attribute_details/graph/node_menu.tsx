// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {
    ChevronRightIcon,
    SitemapIcon,
    SourceBranchIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

export type NodeMenuProps = {
    optionName: string;
    nameDraft: string;
    trimmedName: string;
    renameIsDuplicate: boolean;
    parentCount: number;
    childCount: number;
    disabled: boolean;
    onNameDraftChange: (value: string) => void;
    onCommitRename: () => void;
    onRevertDraft: () => void;
    onOpenParents: () => void;
    onOpenChildren: () => void;
    onDelete: () => void;
};

export function NodeMenu({
    optionName,
    nameDraft,
    trimmedName,
    renameIsDuplicate,
    parentCount,
    childCount,
    disabled,
    onNameDraftChange,
    onCommitRename,
    onRevertDraft,
    onOpenParents,
    onOpenChildren,
    onDelete,
}: NodeMenuProps) {
    const {formatMessage} = useIntl();
    const skipBlurCommitRef = useRef(false);

    return (
        <>
            {disabled ? (
                <div
                    className='attribute-graph-parents-pane__name'
                    data-testid='attributeGraphParentsPane__name'
                >
                    {optionName}
                </div>
            ) : (
                <div className='attribute-graph-parents-pane__name-field'>
                    <Input
                        name='attributeGraphParentsPane__nameInput'
                        type='text'
                        useLegend={false}
                        value={nameDraft}
                        aria-label={formatMessage(messages.valueName)}
                        onChange={(event) => {
                            skipBlurCommitRef.current = false;
                            onNameDraftChange(event.target.value);
                        }}
                        onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                skipBlurCommitRef.current = true;
                                onRevertDraft();
                                return;
                            }
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                skipBlurCommitRef.current = true;
                                onCommitRename();
                            }
                        }}
                        onKeyUp={(event) => event.stopPropagation()}
                        onBlur={() => {
                            if (skipBlurCommitRef.current) {
                                skipBlurCommitRef.current = false;
                                return;
                            }
                            onCommitRename();
                        }}
                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                        hasError={renameIsDuplicate}
                        customMessage={renameIsDuplicate ?
                            {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmedName})} :
                            null}
                        data-testid='attributeGraphParentsPane__nameInput'
                        autoFocus={true}
                    />
                </div>
            )}
            <Menu.Item
                id='attributeGraphParentsPane__openParents'
                data-testid='attributeGraphParentsPane__openParents'
                disableCloseOnSelect={true}
                onClick={onOpenParents}
                leadingElement={
                    <SitemapIcon
                        size={16}
                        aria-hidden={true}
                    />
                }
                labels={<span><FormattedMessage {...messages.parents}/></span>}
                trailingElements={(
                    <>
                        <span className='attribute-graph-parents-pane__nav-value'>
                            {parentCount === 0 ? (
                                <FormattedMessage {...messages.topLevel}/>
                            ) : (
                                <FormattedMessage
                                    {...messages.parentCount}
                                    values={{n: parentCount}}
                                />
                            )}
                        </span>
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            />
            <Menu.Item
                id='attributeGraphParentsPane__openChildren'
                data-testid='attributeGraphParentsPane__openChildren'
                disableCloseOnSelect={true}
                onClick={onOpenChildren}
                leadingElement={
                    <SourceBranchIcon
                        size={16}
                        aria-hidden={true}
                    />
                }
                labels={<span><FormattedMessage {...messages.children}/></span>}
                trailingElements={(
                    <>
                        <span className='attribute-graph-parents-pane__nav-value'>
                            {childCount === 0 ? (
                                <FormattedMessage {...messages.none}/>
                            ) : (
                                childCount
                            )}
                        </span>
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            />
            <Menu.Separator/>
            <Menu.Item
                isDestructive={true}
                disabled={disabled}
                disableCloseOnSelect={true}
                onClick={onDelete}
                leadingElement={
                    <TrashCanOutlineIcon
                        size={16}
                        aria-hidden={true}
                    />
                }
                labels={<span><FormattedMessage {...messages.deleteThisValue}/></span>}
            />
        </>
    );
}

const messages = defineMessages({
    parents: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.parents',
        defaultMessage: 'Parents',
    },
    children: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.children',
        defaultMessage: 'Children',
    },
    topLevel: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.top_level',
        defaultMessage: 'Top level',
    },
    none: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.none',
        defaultMessage: 'None',
    },
    parentCount: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.parent_count',
        defaultMessage: '{n, plural, one {# parent} other {# parents}}',
    },
    valueName: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.value_name',
        defaultMessage: 'Value name',
    },
    duplicateName: {
        id: 'admin.global_attributes.attribute_details.options.graph.duplicate_name',
        defaultMessage: '"{name}" already exists in this field.',
    },
    deleteThisValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.delete_this_value',
        defaultMessage: 'Delete this value',
    },
});
