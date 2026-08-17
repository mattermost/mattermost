// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */
/* eslint-disable formatjs/no-literal-string-in-jsx -- component library dev playground */

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import type {IntlShape} from 'react-intl';
import {useIntl} from 'react-intl';

import {type MmBlock} from '@mattermost/types/mm_blocks';

import {BlockRenderer} from 'components/block_renderer';
import {translateAdaptiveCards} from 'components/block_renderer/translation/adaptive_cards';
import {translateAttachments} from 'components/block_renderer/translation/attachments';
import {translateBlockKit} from 'components/block_renderer/translation/block_kit';
import {translateMMBlocks} from 'components/block_renderer/translation/mm_block';
import PostContext from 'components/post_view/post_context';

import {type BlockPath, serializeMmBlocks} from './mm_blocks_editor_utils';
import MmBlocksHierarchyEditor from './mm_blocks_hierarchy_editor';

import './component_library.scss';

type InputMode = 'mm_blocks' | 'attachments' | 'block_kit' | 'adaptive_cards';

const INPUT_MODE_OPTIONS: Array<{id: InputMode; label: string}> = [
    {id: 'mm_blocks', label: 'MM blocks (canonical mm_blocks)'},
    {id: 'attachments', label: 'Attachments (props.attachments)'},
    {id: 'block_kit', label: 'Block Kit (props.blocks)'},
    {id: 'adaptive_cards', label: 'Adaptive Cards (props.cards)'},
];

const INITIAL_DRAFTS: Record<InputMode, string> = {
    mm_blocks: `[
  {
    "type": "text",
    "text": "Hello **from** mm blocks"
  },
  {
    "type": "button",
    "text": "Sample action",
    "style": "primary",
    "action_id": "component_library_demo"
  }
]`,
    attachments: `[
  {
    "color": "#36a64f",
    "pretext": "Optional pretext",
    "title": "Attachment title",
    "title_link": "https://example.com",
    "text": "Body *markdown* text"
  }
]`,
    block_kit: `[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Hello* from Block Kit"
    }
  },
  {
    "type": "divider"
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": { "type": "plain_text", "text": "OK" },
        "action_id": "block_kit_demo"
      }
    ]
  }
]`,
    adaptive_cards: `[
  {
    "type": "AdaptiveCard",
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.5",
    "body": [
      {
        "type": "TextBlock",
        "text": "Hello from an Adaptive Card",
        "wrap": true
      }
    ]
  }
]`,
};

const COMPONENT_LIBRARY_POST_ID = 'component_library_mm_blocks';
const SLOW_ACTION_DELAY_MS = 5000;

type Props = {
    backgroundClass: string;
};

type ParseResult = {ok: true; blocks: MmBlock[]} | {ok: false; error: string};

function tryParseJson(text: string): {ok: true; value: unknown} | {ok: false; error: string} {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return {ok: false, error: 'Enter JSON for the selected format.'};
    }
    try {
        return {ok: true, value: JSON.parse(text)};
    } catch (e) {
        return {ok: false, error: e instanceof Error ? e.message : 'Invalid JSON.'};
    }
}

function normalizeAdaptiveCardsPayload(parsed: unknown): unknown[] | null {
    if (Array.isArray(parsed)) {
        return parsed;
    }
    if (typeof parsed === 'object' && parsed !== null && (parsed as Record<string, unknown>).type === 'AdaptiveCard') {
        return [parsed];
    }
    return null;
}

function parsePayload(text: string, mode: InputMode, intl: IntlShape): ParseResult {
    const json = tryParseJson(text);
    if (!json.ok) {
        return json;
    }
    const parsed = json.value;

    if (mode === 'mm_blocks') {
        if (!Array.isArray(parsed)) {
            return {ok: false, error: 'Top-level JSON value must be an array of mm blocks.'};
        }
        return {ok: true, blocks: translateMMBlocks(parsed)};
    }

    if (mode === 'attachments') {
        if (!Array.isArray(parsed)) {
            return {ok: false, error: 'Expected a JSON array of attachment objects (same as props.attachments).'};
        }
        return {ok: true, blocks: translateAttachments(parsed, intl)};
    }

    if (mode === 'block_kit') {
        if (!Array.isArray(parsed)) {
            return {ok: false, error: 'Expected a JSON array of Block Kit blocks (same as props.blocks).'};
        }
        return {ok: true, blocks: translateBlockKit(parsed)};
    }

    if (mode === 'adaptive_cards') {
        const cards = normalizeAdaptiveCardsPayload(parsed);
        if (cards === null) {
            return {
                ok: false,
                error: 'Expected a JSON array of Adaptive Card objects, or one object with type "AdaptiveCard" (same as props.cards).',
            };
        }
        return {ok: true, blocks: translateAdaptiveCards(cards)};
    }

    throw new Error(`Unsupported payload format: ${String(mode)}`);
}

const MmBlocksComponentLibrary = ({
    backgroundClass,
}: Props) => {
    const intl = useIntl();
    const [inputMode, setInputMode] = useState<InputMode>('mm_blocks');
    const [drafts, setDrafts] = useState<Record<InputMode, string>>(() => ({...INITIAL_DRAFTS}));
    const [selectedBlockPath, setSelectedBlockPath] = useState<BlockPath | null>(null);
    const [simulateSlowAction, setSimulateSlowAction] = useState(false);

    const jsonText = drafts[inputMode];

    const parsed = useMemo(() => parsePayload(jsonText, inputMode, intl), [jsonText, inputMode]);

    const showMmBlocksEditor = inputMode === 'mm_blocks' && parsed.ok;

    const onChangeMode = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setInputMode(e.target.value as InputMode);
        setSelectedBlockPath(null);
    }, []);

    const onChangeJson = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setDrafts((d) => ({...d, [inputMode]: value}));
        if (inputMode === 'mm_blocks') {
            setSelectedBlockPath(null);
        }
    }, [inputMode]);

    const onHierarchyBlocksChange = useCallback((blocks: MmBlock[]) => {
        setDrafts((d) => ({...d, mm_blocks: serializeMmBlocks(blocks)}));
    }, []);

    const onToggleSimulateSlowAction = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSimulateSlowAction(e.target.checked);
    }, []);

    const onAction = useCallback(async (actionId: string, selectedOption?: string, query?: Record<string, string>, attachmentCookie?: string) => {
        if (simulateSlowAction) {
            await new Promise<void>((resolve) => {
                window.setTimeout(resolve, SLOW_ACTION_DELAY_MS);
            });
        }
        const parts = [
            `action_id: ${actionId}`,
            selectedOption !== undefined && selectedOption !== '' ? `value: ${selectedOption}` : null,
            attachmentCookie !== undefined && attachmentCookie !== '' ? `cookie: ${attachmentCookie.slice(0, 48)}…` : null,
            query && Object.keys(query).length > 0 ? `query: ${JSON.stringify(query)}` : null,
        ].filter(Boolean);
        window.alert(parts.join('\n'));
    }, [simulateSlowAction]);

    const modeOptions = useMemo(
        () =>
            INPUT_MODE_OPTIONS.map((opt) => (
                <option
                    key={opt.id}
                    value={opt.id}
                >
                    {opt.label}
                </option>
            )),
        [],
    );

    const emptyTranslation =
        parsed.ok &&
        parsed.blocks.length === 0 &&
        inputMode !== 'mm_blocks';

    return (
        <>
            <label className='clInput'>
                {'Payload format: '}
                <select
                    value={inputMode}
                    onChange={onChangeMode}
                    aria-label='Interactive message payload format'
                >
                    {modeOptions}
                </select>
            </label>
            <div className={showMmBlocksEditor ? 'clMmBlocksEditorLayout' : undefined}>
                <label className={classNames('clInput', showMmBlocksEditor && 'clMmBlocksEditorLayout__json')}>
                    {'JSON: '}
                    <textarea
                        className='clJsonEditor'
                        spellCheck={false}
                        value={jsonText}
                        onChange={onChangeJson}
                        rows={16}
                        aria-label='Interactive message JSON'
                    />
                </label>
                {showMmBlocksEditor && (
                    <MmBlocksHierarchyEditor
                        blocks={parsed.blocks}
                        selectedPath={selectedBlockPath}
                        onSelectPath={setSelectedBlockPath}
                        onChangeBlocks={onHierarchyBlocksChange}
                    />
                )}
            </div>
            {!parsed.ok && (
                <div
                    className='clJsonError'
                    role='alert'
                >
                    {parsed.error}
                </div>
            )}
            {emptyTranslation && (
                <div
                    className='clJsonHint'
                    role='status'
                >
                    {'Translation produced no blocks. Check that the JSON matches the selected format and contains supported elements.'}
                </div>
            )}
            <label className='clInput'>
                {'Simulate slow action: '}
                <input
                    type='checkbox'
                    checked={simulateSlowAction}
                    onChange={onToggleSimulateSlowAction}
                />
                {` (${SLOW_ACTION_DELAY_MS / 1000}s delay before the action alert)`}
            </label>
            <div className={classNames('clWrapper', backgroundClass)}>
                {parsed.ok && (
                    <PostContext.Provider value={{handlePopupOpened: null}}>
                        <BlockRenderer
                            blocks={parsed.blocks}
                            postId={COMPONENT_LIBRARY_POST_ID}
                            onAction={onAction}
                        />
                    </PostContext.Provider>
                )}
            </div>
        </>
    );
};

export default MmBlocksComponentLibrary;
