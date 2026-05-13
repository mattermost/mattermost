// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    FloatingPortal,
    offset as floatingOffset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useId,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {UserPropertyField} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import './session_attribute_editor.scss';

type SessionAttributeEditorButtonProps = {
    userId: string;
    displayName: string;
    fields: UserPropertyField[];
    currentOverrides: Record<string, string>;

    /** Persist the overrides upstream. Returning a Promise is supported
     *  so the editor stays open until the upstream commit settles —
     *  prevents the popover from disappearing on click before the
     *  caller's state update flushes. */
    onApply: (userId: string, overrides: Record<string, string>) => void | Promise<void>;
};

/**
 * Pencil-icon button that opens the per-row session-attribute editor
 * popover. The form is rendered dynamically from the session-attribute
 * property group: select-typed fields with options become dropdowns,
 * everything else becomes a text input. Applying writes back into the
 * row's session_overrides map and the next Re-run picks them up.
 *
 * The form is intentionally flat (no internal validation or async
 * submission): overrides are best-effort hints to the simulator. The
 * server validates expressions against the actual values at evaluation
 * time, so an invalid override surfaces as a deny rather than a form
 * error.
 */
export default function SessionAttributeEditorButton({userId, displayName, fields, currentOverrides, onApply}: SessionAttributeEditorButtonProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);

    // Stable per-instance id for the form's heading. The popover
    // `aria-labelledby` points to it, removing the duplicate
    // aria-label on both the trigger and the panel — assistive tech
    // now reads the heading text rather than re-announcing the
    // pencil button's label twice. Floating UI's useId guarantees
    // uniqueness across simultaneously-open editors (one per row).
    const titleId = useId();

    const {refs, floatingStyles, context} = useFloating({
        open,
        onOpenChange: setOpen,
        strategy: 'fixed',
        placement: 'bottom-end',
        whileElementsMounted: autoUpdate,
        middleware: [
            floatingOffset(6),
            flip({padding: 8}),
            shift({padding: 8}),
        ],
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context, {toggle: true}),
        useDismiss(context, {outsidePress: true, escapeKey: true}),
        useRole(context, {role: 'dialog'}),
    ]);

    const handleCancel = useCallback(() => {
        setOpen(false);
    }, []);

    const handleApply = useCallback(async (overrides: Record<string, string>) => {
        // Await keeps the popover open until the upstream commit
        // finishes — if a future caller swaps the local-state update
        // for an async API request, the editor won't disappear mid-
        // flight.
        await onApply(userId, overrides);
        setOpen(false);
    }, [onApply, userId]);

    return (
        <>
            <button
                ref={refs.setReference}
                type='button'
                className='SimulateAccessModal__rowConfigure'
                data-testid={`simulate-access-row-edit-${userId}`}
                aria-label={formatMessage({id: 'admin.access_control.simulate_access.row.edit', defaultMessage: 'Edit session attribute values'})}
                {...getReferenceProps()}
            >
                <i className='icon icon-pencil-outline'/>
            </button>
            {open ? (
                <FloatingPortal>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                        initialFocus={0}
                        returnFocus={true}
                    >
                        <div
                            ref={refs.setFloating}
                            className='SimulateAccessModal__editorPanel'
                            data-testid='simulate-access-row-editor'
                            aria-labelledby={titleId}
                            style={floatingStyles}
                            {...getFloatingProps()}
                        >
                            <SessionAttributeEditorForm
                                titleId={titleId}
                                displayName={displayName}
                                fields={fields}
                                initialOverrides={currentOverrides}
                                onCancel={handleCancel}
                                onApply={handleApply}
                            />
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            ) : null}
        </>
    );
}

type SessionAttributeEditorFormProps = {

    /** DOM id assigned to the form's title element so the surrounding
     *  popover can reference it via `aria-labelledby` instead of
     *  duplicating the trigger's aria-label. */
    titleId: string;
    displayName: string;
    fields: UserPropertyField[];
    initialOverrides: Record<string, string>;
    onCancel: () => void;
    onApply: (overrides: Record<string, string>) => void | Promise<void>;
};

/**
 * The form inside the pencil-icon popover. Rendered dynamically from
 * the session-attribute property group; selects for fields with
 * options, text inputs otherwise. Apply commits the (possibly empty)
 * overrides back to the parent row; Cancel discards.
 */
function SessionAttributeEditorForm({titleId, displayName, fields, initialOverrides, onCancel, onApply}: SessionAttributeEditorFormProps): JSX.Element {
    const [values, setValues] = useState<Record<string, string>>(initialOverrides);

    const handleSet = useCallback((name: string, value: string) => {
        setValues((prev) => {
            const next = {...prev};
            if (value === '') {
                delete next[name];
            } else {
                next[name] = value;
            }
            return next;
        });
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await onApply(values);
    }, [onApply, values]);

    return (
        <form
            className='SimulateAccessModal__editorForm'
            onSubmit={handleSubmit}
        >
            <div
                id={titleId}
                className='SimulateAccessModal__editorTitle'
            >
                <FormattedMessage
                    id='admin.access_control.simulate_access.editor.title'
                    defaultMessage='Edit session attribute values for {displayName}'
                    values={{displayName}}
                />
            </div>
            <div className='SimulateAccessModal__editorDescription'>
                <FormattedMessage
                    id='admin.access_control.simulate_access.editor.description'
                    defaultMessage='Override the values used in this simulation. The change applies only to this run.'
                />
            </div>
            {fields.length === 0 ? (
                <div className='SimulateAccessModal__editorEmpty'>
                    <FormattedMessage
                        id='admin.access_control.simulate_access.editor.empty'
                        defaultMessage='No session attributes are configured yet.'
                    />
                </div>
            ) : (
                <div className='SimulateAccessModal__editorGrid'>
                    {fields.map((field) => (
                        <SessionAttributeFieldControl
                            key={field.id}
                            field={field}
                            value={values[field.name] ?? ''}
                            onChange={(v) => handleSet(field.name, v)}
                        />
                    ))}
                </div>
            )}
            <div className='SimulateAccessModal__editorActions'>
                <Button
                    emphasis='tertiary'
                    onClick={onCancel}
                >
                    <FormattedMessage
                        id='admin.access_control.simulate_access.editor.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
                <Button
                    type='submit'
                >
                    <FormattedMessage
                        id='admin.access_control.simulate_access.editor.apply'
                        defaultMessage='Apply'
                    />
                </Button>
            </div>
        </form>
    );
}

type SessionAttributeFieldControlProps = {
    field: UserPropertyField;
    value: string;
    onChange: (value: string) => void;
};

/**
 * One form field inside SessionAttributeEditorForm. Branches on the
 * field's `supportsOptions` shape: select for option-backed fields,
 * plain text input otherwise.
 */
function SessionAttributeFieldControl({field, value, onChange}: SessionAttributeFieldControlProps): JSX.Element {
    const options = field.attrs?.options ?? [];

    if (supportsOptions(field) && options.length > 0) {
        return (
            <label className='SimulateAccessModal__editorField'>
                <span className='SimulateAccessModal__editorFieldLabel'>{field.name}</span>
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className='SimulateAccessModal__editorFieldSelect'
                >
                    <option value=''>{'—'}</option>
                    {options.map((opt) => (
                        <option
                            key={opt.id}
                            value={opt.name}
                        >
                            {opt.name}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    return (
        <label className='SimulateAccessModal__editorField'>
            <span className='SimulateAccessModal__editorFieldLabel'>{field.name}</span>
            <input
                type='text'
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className='SimulateAccessModal__editorFieldInput'
            />
        </label>
    );
}
