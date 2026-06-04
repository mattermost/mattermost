// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getPostFilterRules, buildRulesWithPostFilterRules} from '@mattermost/types/access_control';
import type {Channel} from '@mattermost/types/channels';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import CELEditor from 'components/admin_console/access_control/editors/cel_editor/editor';
import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import './channel_settings_post_policies_tab.scss';

// A post policy rule must reference both namespaces — the post side
// decides applicability ("does this rule apply to this post?") and the
// user side decides the predicate ("should this user see it?"). A rule
// missing either side is semantically broken (matches everything on one
// axis), so we block save with this regex-based check before hitting
// the server-side CEL validator.
const POST_ATTR_RE = /\bpost\.attributes\.\w+/;
const USER_ATTR_RE = /\buser\.attributes\.\w+/;

type AttributeOption = {
    attribute: string;
    values: string[];
};

const optionNames = (options?: PropertyFieldOption[]): string[] => {
    if (!options) {
        return [];
    }
    return options.map((o) => o.name).filter((n): n is string => Boolean(n));
};

const toPostAttribute = (f: PropertyField): AttributeOption => {
    const options = (f.attrs?.options as PropertyFieldOption[] | undefined);
    return {
        attribute: f.name,
        // For select/multiselect, surface the user-visible option names
        // (mirrors Slice 11's server-side option-ID -> name resolution
        // so what authors complete is what the evaluator compares).
        values: f.type === 'select' || f.type === 'multiselect' ? optionNames(options) : [],
    };
};

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
    const [userAttributes, setUserAttributes] = useState<AttributeOption[]>([]);
    const [postAttributes, setPostAttributes] = useState<AttributeOption[]>([]);

    // Load existing channel policy and seed the cards from its post_filter
    // rules. A 404 (no policy yet) is treated as an empty list. CPA fields
    // (for `user.attributes.*` autocomplete) and channel-scoped post
    // property fields (for `post.attributes.*` autocomplete) are fetched
    // in parallel; failures here are non-fatal — the editor still works
    // without completion, the user just types names by hand.
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const policyPromise = (async () => {
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
                } catch (error) {
                    if (cancelled) {
                        return;
                    }
                    const message = error instanceof Error ? error.message : String(error);
                    if (message.includes('404') || message.toLowerCase().includes('not found')) {
                        setPolicy(null);
                        setCards([]);
                        return;
                    }
                    setLoadError(message);
                }
            })();

            const userAttrsPromise = actions.getAccessControlFields('', 100).
                then((result) => {
                    if (cancelled || !result.data) {
                        return;
                    }
                    setUserAttributes(result.data.map((f) => ({
                        attribute: f.name,
                        // CPA value-completion is intentionally empty (matches the
                        // admin-console behaviour) — surfacing every possible value
                        // creates noise and we don't have a per-channel allow list.
                        values: [],
                    })));
                }).
                catch(() => undefined);

            const postFieldsPromise = Client4.getPropertyFields(
                'channel_post_properties',
                'post',
                'channel',
                channel.id,
                {perPage: 100},
            ).
                then((fields: PropertyField[]) => {
                    if (cancelled) {
                        return;
                    }
                    setPostAttributes(fields.map(toPostAttribute));
                }).
                catch(() => undefined);

            await Promise.all([policyPromise, userAttrsPromise, postFieldsPromise]);
            if (!cancelled) {
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
    //
    // Two gotchas this effect has to navigate:
    //
    //   1. EMPTY draft (user clicked "+ Add policy" but hasn't typed) has
    //      nothing to save and must not gate the modal close — otherwise
    //      the X button needs two clicks (one to set hasBeenWarned, one
    //      to actually close). Treat a draft as dirty only once it has
    //      content.
    //   2. Spurious post-load flip. When the load resolves, CELEditor's
    //      monaco-mount path mirrors the freshly-loaded value back through
    //      onChange (the model's onDidChangeContent fires when monaco
    //      re-syncs to the new prop value, and may normalise whitespace /
    //      line endings). That briefly makes c.expression !== c.initialExpression
    //      even though the user hasn't touched anything. We defend against
    //      it by (a) not surfacing dirty until `loaded` is true, and (b)
    //      trimming both sides of the saved-card comparison so a stray
    //      trailing newline doesn't count as a diff.
    useEffect(() => {
        if (!loaded) {
            return;
        }
        const dirty = cards.some((c) => {
            if (c.isDraft) {
                return c.expression.trim() !== '';
            }
            return c.expression.trim() !== c.initialExpression.trim();
        });
        setAreThereUnsavedChanges?.(dirty);
    }, [cards, loaded, setAreThereUnsavedChanges]);

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
        const trimmed = target.expression.trim();
        if (!trimmed) {
            updateCard(localId, {error: formatMessage({id: 'channel_settings.post_policies.empty_error', defaultMessage: 'Expression cannot be empty.'})});
            return;
        }
        // Both sides required: a rule without a post attribute matches
        // every post, and a rule without a user attribute matches every
        // user — either case makes the rule meaningless. Surface this
        // before hitting the server (the server's CEL validator only
        // checks parseability, not this semantic constraint).
        if (!POST_ATTR_RE.test(trimmed) || !USER_ATTR_RE.test(trimmed)) {
            updateCard(localId, {
                error: formatMessage({
                    id: 'channel_settings.post_policies.both_sides_required_error',
                    defaultMessage: 'A post policy must reference at least one post.attributes.<field> and one user.attributes.<field>.',
                }),
            });
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
                        <div
                            id={`post-policy-expression-${card.localId}`}
                            data-testid={`post-policy-expression-${idx}`}
                            className='ChannelSettingsModal__postPoliciesEditor'
                        >
                            <CELEditor
                                value={card.expression}
                                onChange={(value) => updateCard(card.localId, {expression: value, error: undefined})}
                                placeholder={'post.attributes.secretlevel == "L1" && user.attributes.rank == "R1"'}
                                channelId={channel.id}
                                disabled={card.saving}
                                userAttributes={userAttributes}
                                postAttributes={postAttributes}
                                showTestButton={false}
                            />
                        </div>
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
