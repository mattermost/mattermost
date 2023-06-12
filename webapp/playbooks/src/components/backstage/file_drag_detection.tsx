// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

// Could be in state instead but that would cause more render-calls.
let dragDepth = 0;
export const useFileDragDetection = () => {
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    useEffect(() => {
        dragDepth = 0;

        const updateIsDraggingFile = () => {
            setIsDraggingFile(dragDepth > 0);
        };

        const handleDragEnter = () => {
            dragDepth++;
            updateIsDraggingFile();
        };

        const handleDragLeave = () => {
            dragDepth--;
            updateIsDraggingFile();
        };

        const handleDrop = () => {
            dragDepth = 0;
            updateIsDraggingFile();
        };

        document.addEventListener('dragenter', handleDragEnter);
        document.addEventListener('dragleave', handleDragLeave);
        document.addEventListener('drop', handleDrop);
        return () => {
            document.removeEventListener('dragenter', handleDragEnter);
            document.removeEventListener('dragleave', handleDragLeave);
            document.removeEventListener('drop', handleDrop);
        };
    }, []);

    return isDraggingFile;
};
