// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';

import type {CustomSvg} from './icon_libraries/custom_svgs';
import {
    validateSvg,
    sanitizeSvg,
    normalizeSvgColors,
    encodeSvgToBase64,
    decodeSvgFromBase64,
    extractSvgViewBox,
} from './icon_libraries/custom_svgs';

import './custom_svg_modal.scss';

type Props = {
    show: boolean;
    onClose: () => void;
    onSave: (data: {name: string; svg: string; normalizeColor: boolean}) => void;
    editingSvg?: CustomSvg;
}

export default function CustomSvgModal({
    show,
    onClose,
    onSave,
    editingSvg,
}: Props) {
    const {formatMessage} = useIntl();
    const [name, setName] = useState('');
    const [svgInput, setSvgInput] = useState('');
    const [normalizeColor, setNormalizeColor] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewSvg, setPreviewSvg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset form when modal opens/closes or editingSvg changes
    useEffect(() => {
        if (show) {
            if (editingSvg) {
                setName(editingSvg.name);
                setSvgInput(decodeSvgFromBase64(editingSvg.svg));
                setNormalizeColor(editingSvg.normalizeColor);
                setPreviewSvg(decodeSvgFromBase64(editingSvg.svg));
            } else {
                setName('');
                setSvgInput('');
                setNormalizeColor(true);
                setPreviewSvg(null);
            }
            setError(null);
        }
    }, [show, editingSvg]);

    // Update preview when SVG input changes
    const handleSvgChange = useCallback((value: string) => {
        setSvgInput(value);
        setError(null);

        if (!value.trim()) {
            setPreviewSvg(null);
            return;
        }

        const validation = validateSvg(value);
        if (!validation.valid) {
            setError(validation.error || 'Invalid SVG');
            setPreviewSvg(null);
            return;
        }

        setPreviewSvg(sanitizeSvg(value));
    }, []);

    // Handle file upload
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
            setError('Please upload an SVG file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                handleSvgChange(content);

                // Auto-set name from filename if name is empty
                if (!name) {
                    const baseName = file.name.replace(/\.svg$/i, '');
                    setName(baseName);
                }
            }
        };
        reader.onerror = () => {
            setError('Failed to read file');
        };
        reader.readAsText(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [handleSvgChange, name]);

    // Handle save
    const handleSave = useCallback(() => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (!svgInput.trim()) {
            setError('SVG content is required');
            return;
        }

        const validation = validateSvg(svgInput);
        if (!validation.valid) {
            setError(validation.error || 'Invalid SVG');
            return;
        }

        let processedSvg = sanitizeSvg(svgInput);
        if (normalizeColor) {
            processedSvg = normalizeSvgColors(processedSvg);
        }

        onSave({
            name: name.trim(),
            svg: encodeSvgToBase64(processedSvg),
            normalizeColor,
        });

        onClose();
    }, [name, svgInput, normalizeColor, onSave, onClose]);

    // Get preview SVG with color normalization applied
    const getDisplaySvg = useCallback(() => {
        if (!previewSvg) {
            return null;
        }
        return normalizeColor ? normalizeSvgColors(previewSvg) : previewSvg;
    }, [previewSvg, normalizeColor]);

    const displaySvg = getDisplaySvg();
    const viewBox = displaySvg ? extractSvgViewBox(displaySvg) : null;

    return (
        <Modal
            show={show}
            onHide={onClose}
            dialogClassName='CustomSvgModal'
            backdrop='static'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title>
                    {editingSvg ?
                        formatMessage({id: 'custom_svg_modal.title.edit', defaultMessage: 'Edit Custom SVG'}) :
                        formatMessage({id: 'custom_svg_modal.title.add', defaultMessage: 'Add Custom SVG'})
                    }
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='CustomSvgModal__form'>
                    <div className='CustomSvgModal__field'>
                        <label htmlFor='customSvgName'>
                            {formatMessage({id: 'custom_svg_modal.name', defaultMessage: 'Name'})}
                        </label>
                        <input
                            id='customSvgName'
                            type='text'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={formatMessage({id: 'custom_svg_modal.name_placeholder', defaultMessage: 'e.g., my-logo, custom-badge'})}
                            autoFocus={true}
                        />
                        <span className='CustomSvgModal__hint'>
                            {formatMessage({id: 'custom_svg_modal.name_hint', defaultMessage: 'A unique name to identify this icon'})}
                        </span>
                    </div>

                    <div className='CustomSvgModal__field'>
                        <label htmlFor='customSvgContent'>
                            {formatMessage({id: 'custom_svg_modal.svg_content', defaultMessage: 'SVG Content'})}
                        </label>
                        <div className='CustomSvgModal__uploadRow'>
                            <button
                                type='button'
                                className='btn btn-tertiary'
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className='icon icon-upload'/>
                                {formatMessage({id: 'custom_svg_modal.upload', defaultMessage: 'Upload SVG'})}
                            </button>
                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='.svg,image/svg+xml'
                                onChange={handleFileUpload}
                                style={{display: 'none'}}
                            />
                            <span className='CustomSvgModal__or'>
                                {formatMessage({id: 'custom_svg_modal.or', defaultMessage: 'or paste below'})}
                            </span>
                        </div>
                        <textarea
                            id='customSvgContent'
                            value={svgInput}
                            onChange={(e) => handleSvgChange(e.target.value)}
                            placeholder={formatMessage({id: 'custom_svg_modal.svg_placeholder', defaultMessage: '<svg viewBox="0 0 24 24">...</svg>'})}
                            rows={6}
                        />
                    </div>

                    <div className='CustomSvgModal__field CustomSvgModal__checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={normalizeColor}
                                onChange={(e) => setNormalizeColor(e.target.checked)}
                            />
                            {formatMessage({id: 'custom_svg_modal.normalize_color', defaultMessage: 'Normalize colors'})}
                        </label>
                        <span className='CustomSvgModal__hint'>
                            {formatMessage({
                                id: 'custom_svg_modal.normalize_color_hint',
                                defaultMessage: 'Replace fill/stroke colors with currentColor so the icon inherits the text color. Disable to keep original colors.',
                            })}
                        </span>
                    </div>

                    {error && (
                        <div className='CustomSvgModal__error'>
                            <i className='icon icon-alert-circle-outline'/>
                            {error}
                        </div>
                    )}

                    {displaySvg && (
                        <div className='CustomSvgModal__preview'>
                            <label>
                                {formatMessage({id: 'custom_svg_modal.preview', defaultMessage: 'Preview'})}
                            </label>
                            <div className='CustomSvgModal__previewRow'>
                                <div className='CustomSvgModal__previewBox CustomSvgModal__previewBox--light'>
                                    <i
                                        className='icon sidebar-channel-icon'
                                        dangerouslySetInnerHTML={{
                                            __html: displaySvg.replace(
                                                /<svg/,
                                                '<svg width="24" height="24"' + (viewBox ? '' : ' viewBox="0 0 24 24"'),
                                            ),
                                        }}
                                    />
                                </div>
                                <div className='CustomSvgModal__previewBox CustomSvgModal__previewBox--dark'>
                                    <i
                                        className='icon sidebar-channel-icon'
                                        dangerouslySetInnerHTML={{
                                            __html: displaySvg.replace(
                                                /<svg/,
                                                '<svg width="24" height="24"' + (viewBox ? '' : ' viewBox="0 0 24 24"'),
                                            ),
                                        }}
                                    />
                                </div>
                                <div className='CustomSvgModal__previewBox CustomSvgModal__previewBox--small'>
                                    <i
                                        className='icon sidebar-channel-icon'
                                        dangerouslySetInnerHTML={{
                                            __html: displaySvg.replace(
                                                /<svg/,
                                                '<svg width="18" height="18"' + (viewBox ? '' : ' viewBox="0 0 24 24"'),
                                            ),
                                        }}
                                    />
                                    <span className='CustomSvgModal__previewLabel'>
                                        {formatMessage({id: 'custom_svg_modal.sidebar_size', defaultMessage: 'Sidebar size'})}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={onClose}
                >
                    {formatMessage({id: 'custom_svg_modal.cancel', defaultMessage: 'Cancel'})}
                </button>
                <button
                    type='button'
                    className='btn btn-primary'
                    onClick={handleSave}
                    disabled={!name.trim() || !svgInput.trim() || Boolean(error)}
                >
                    {editingSvg ?
                        formatMessage({id: 'custom_svg_modal.update', defaultMessage: 'Update'}) :
                        formatMessage({id: 'custom_svg_modal.save', defaultMessage: 'Save'})
                    }
                </button>
            </Modal.Footer>
        </Modal>
    );
}
