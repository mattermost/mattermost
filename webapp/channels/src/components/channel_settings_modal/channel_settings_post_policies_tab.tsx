// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getPostFilterRules, buildRulesWithPostFilterRules} from '@mattermost/types/access_control';
import type {Channel} from '@mattermost/types/channels';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import './channel_settings_post_policies_tab.scss';

type Card = {
    localId: string;
    expression: string;
    initialExpression: string;
    isDraft: boolean;
    error?: string;
    saving?: boolean;
};

type ChannelSettingsPostPoliciesTabProps = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
};

let nextLocalId = 0;
const makeLocalId = () => {
    nextLocalId += 1;
    return `post-policy-draft-${nextLocalId}`;
};

const cardFromRule = (rule: AccessControlPolicyRule): Card => ({
    localId: makeLocalId(),
    expression: rule.expression ?? '',
    initialExpression: rule.expression ?? '',
    isDraft: false,
});

const emptyDraft = (): Card => ({
    localId: makeLocalId(),
    expression: '',
    initialExpression: '',
    isDraft: true,
});

function ChannelSettingsPostPoliciesTab({
    channel,
    setAreThereUnsavedChanges,
}: ChannelSettingsPostPoliciesTabProps) {
    const {formatMessage} = useIntl();
    const actions = useChannelAccessControlActions(channel.id);

    const [policy, setPolicy] = useState<AccessControlPolicy | null>(null);
    const [cards, setCards] = useState<Card[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState<string>('');

    // Load existing channel policy and seed the cards from its post_filter
    // rules. A 404 (no policy yet) is treated as an empty list.
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const result = await actions.getChannelPolicy(channel.id);
                if (cancelled) {
                    return;
                }
                if (result.data) {
                    setPolicy(result.data);
                    setCards(getPostFilterRules(result.data.rules).map(cardFromRule));
                } else {
                    setPolicy(null);
                    setCards([]);
                }
                setLoaded(true);
            } catch (error) {
                if (cancelled) {
                    return;
                }
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes('404') || message.toLowerCase().includes('not found')) {
                    setPolicy(null);
                    setCards([]);
                    setLoaded(true);
                    return;
                }
                setLoadError(message);
                setLoaded(true);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [channel.id, actions]);

    // Surface unsaved-changes state to the parent modal so the tab-switch
    // guard kicks in when any card is dirty.
    useEffect(() => {
        const dirty = cards.some((c) => c.isDraft || c.expression !== c.initialExpression);
        setAreThereUnsavedChanges?.(dirty);
    }, [cards, setAreThereUnsavedChanges]);

    const updateCard = useCallback((localId: string, patch: Partial<Card>) => {
        setCards((prev) => prev.map((c) => (c.localId === localId ? {...c, ...patch} : c)));
    }, []);

    const handleAdd = useCallback(() => {
        setCards((prev) => [...prev, emptyDraft()]);
    }, []);

    // Save / delete operations both go through the same code path: build the
    // full Rules slice (membership + every saved post_filter card) and write
    // it via the existing channel-policy endpoint. The single-policy-per-
    // channel shape means we always send the full rule list back.
    const persistRules = useCallback(async (nextSavedCards: Card[]): Promise<{ok: true; saved: AccessControlPolicy} | {ok: false; error: string}> => {
        const existingRules = policy?.rules ?? [];
        const expressions = nextSavedCards.map((c) => c.expression);
        const nextRules = buildRulesWithPostFilterRules(existingRules, expressions);

        const payload: AccessControlPolicy = {
            id: channel.id,
            name: policy?.name ?? channel.display_name,
            type: policy?.type ?? 'channel',
            active: policy?.active ?? false,
            revision: (policy?.revision ?? 0) + 1,
            created_at: policy?.created_at ?? Date.now(),
            version: policy?.version,
            roles: policy?.roles,
            imports: policy?.imports,
            props: policy?.props,
            rules: nextRules,
        };

        try {
            const result = await actions.saveChannelPolicy(payload);
            if (result.error) {
                return {ok: false, error: result.error.message || formatMessage({id: 'channel_settings.post_policies.save_error', defaultMessage: 'Failed to save post policy'})};
            }
            const saved = result.data ?? payload;
            setPolicy(saved);
            return {ok: true, saved};
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {ok: false, error: message};
        }
    }, [actions, channel.display_name, channel.id, policy, formatMessage]);

    const handleSave = useCallback(async (localId: string) => {
        const target = cards.find((c) => c.localId === localId);
        if (!target) {
            return;
        }
        if (!target.expression.trim()) {
            updateCard(localId, {error: formatMessage({id: 'channel_settings.post_policies.empty_error', defaultMessage: 'Expression cannot be empty.'})});
            return;
        }

        updateCard(localId, {saving: true, error: undefined});

        const nextSavedCards = cards.
            filter((c) => !c.isDraft || c.localId === localId).
            map((c) => (c.localId === localId ? {...c, expression: c.expression.trim()} : c));

        const result = await persistRules(nextSavedCards);
        if (!result.ok) {
            updateCard(localId, {saving: false, error: result.error});
            return;
        }

        setCards((prev) => prev.map((c) => {
            if (c.localId !== localId) {
                return c;
            }
            const trimmed = c.expression.trim();
            return {...c, expression: trimmed, initialExpression: trimmed, isDraft: false, saving: false, error: undefined};
        }));
    }, [cards, persistRules, updateCard, formatMessage]);

    const handleDelete = useCallback(async (localId: string) => {
        const target = cards.find((c) => c.localId === localId);
        if (!target) {
            return;
        }

        // Unsaved draft: drop it without hitting the server.
        if (target.isDraft) {
            setCards((prev) => prev.filter((c) => c.localId !== localId));
            return;
        }

        updateCard(localId, {saving: true, error: undefined});

        const nextSavedCards = cards.filter((c) => c.localId !== localId && !c.isDraft);
        const result = await persistRules(nextSavedCards);
        if (!result.ok) {
            updateCard(localId, {saving: false, error: result.error});
            return;
        }

        setCards((prev) => prev.filter((c) => c.localId !== localId));
    }, [cards, persistRules, updateCard]);

    if (!loaded) {
        return (
            <div className='ChannelSettingsModal__postPoliciesTab'>
                <p className='ChannelSettingsModal__postPoliciesLoading'>
                    {formatMessage({id: 'channel_settings.post_policies.loading', defaultMessage: 'Loading post policies…'})}
                </p>
            </div>
        );
    }

    return (
        <div className='ChannelSettingsModal__postPoliciesTab'>
            <div className='ChannelSettingsModal__postPoliciesHeader'>
                <h3 className='ChannelSettingsModal__postPoliciesTitle'>
                    {formatMessage({id: 'channel_settings.post_policies.title', defaultMessage: 'Post Policies'})}
                </h3>
                <p className='ChannelSettingsModal__postPoliciesSubtitle'>
                    {formatMessage({id: 'channel_settings.post_policies.subtitle', defaultMessage: 'Write CEL expressions that decide which posts each viewer can read. Combine post and user attributes — for example: post.attributes.secretlevel == "L1" && user.attributes.rank == "R1".'})}
                </p>
            </div>

            {loadError && (
                <div className='ChannelSettingsModal__postPoliciesLoadError'>
                    {loadError}
                </div>
            )}

            {cards.length === 0 && !loadError && (
                <p
                    className='ChannelSettingsModal__postPoliciesEmpty'
                    data-testid='post-policies-empty'
                >
                    {formatMessage({id: 'channel_settings.post_policies.empty', defaultMessage: 'No post policies yet. Add one to start filtering posts in this channel.'})}
                </p>
            )}

            <ul className='ChannelSettingsModal__postPoliciesList'>
                {cards.map((card, idx) => (
                    <li
                        key={card.localId}
                        className='ChannelSettingsModal__postPoliciesCard'
                        data-testid={`post-policy-card-${idx}`}
                    >
                        <label
                            className='ChannelSettingsModal__postPoliciesCardLabel'
                            htmlFor={`post-policy-expression-${card.localId}`}
                        >
                            {formatMessage({id: 'channel_settings.post_policies.expression_label', defaultMessage: 'CEL expression'})}
                        </label>
                        <textarea
                            id={`post-policy-expression-${card.localId}`}
                            data-testid={`post-policy-expression-${idx}`}
                            className='ChannelSettingsModal__postPoliciesTextarea'
                            value={card.expression}
                            placeholder='post.attributes.secretlevel == "L1" && user.attributes.rank == "R1"'
                            spellCheck={false}
                            rows={3}
                            onChange={(e) => updateCard(card.localId, {expression: e.target.value, error: undefined})}
                            disabled={card.saving}
                        />
                        {card.error && (
                            <p
                                className='ChannelSettingsModal__postPoliciesCardError'
                                role='alert'
                                data-testid={`post-policy-error-${idx}`}
                            >
                                {card.error}
                            </p>
                        )}
                        <div className='ChannelSettingsModal__postPoliciesCardActions'>
                            <button
                                type='button'
                                className='btn btn-tertiary btn-sm'
                                data-testid={`post-policy-delete-${idx}`}
                                onClick={() => handleDelete(card.localId)}
                                disabled={card.saving}
                            >
                                {formatMessage({id: 'channel_settings.post_policies.delete', defaultMessage: 'Delete'})}
                            </button>
                            <button
                                type='button'
                                className='btn btn-primary btn-sm'
                                data-testid={`post-policy-save-${idx}`}
                                onClick={() => handleSave(card.localId)}
                                disabled={card.saving || (!card.isDraft && card.expression.trim() === card.initialExpression.trim())}
                            >
                                {card.saving ? formatMessage({id: 'channel_settings.post_policies.saving', defaultMessage: 'Saving…'}) : formatMessage({id: 'channel_settings.post_policies.save', defaultMessage: 'Save'})}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            <button
                type='button'
                className='btn btn-tertiary ChannelSettingsModal__postPoliciesAdd'
                data-testid='post-policies-add'
                onClick={handleAdd}
            >
                {formatMessage({id: 'channel_settings.post_policies.add', defaultMessage: '+ Add policy'})}
            </button>
        </div>
    );
}

export default ChannelSettingsPostPoliciesTab;
