        let projectFiles = [];
        let packedContent = '';
        let packedChunks = []; // Store multiple chunks
        let isProcessing = false;
        let shouldStop = false; // Flag to stop processing
        let errorLog = { pack: [], unpack: [] }; // Track errors for each tab
        
        const MAX_CHUNK_SIZE = 5000 * 1024;

        // Add error to log
        function logError(tab, fileName, reason) {
            errorLog[tab].push({ fileName, reason, timestamp: new Date() });
            displayErrorLog(tab);
        }

        // Display error log
        function displayErrorLog(tab) {
            const errorLogDiv = document.getElementById(tab + 'ErrorLog');
            const errorListDiv = document.getElementById(tab + 'ErrorList');

            if (errorLog[tab].length === 0) {
                errorLogDiv.style.display = 'none';
                return;
            }

            errorLogDiv.style.display = 'block';
            const fragment = document.createDocumentFragment();

            errorLog[tab].forEach(error => {
                const div = document.createElement('div');
                div.className = 'error-item';
                div.innerHTML = `
                    <div class="error-file">[X] ${error.fileName}</div>
                    <div class="error-reason">Reason: ${error.reason}</div>
                `;
                fragment.appendChild(div);
            });

            errorListDiv.innerHTML = '';
            errorListDiv.appendChild(fragment);
        }

        // Clear error log
        function clearErrorLog(tab) {
            errorLog[tab] = [];
            document.getElementById(tab + 'ErrorLog').style.display = 'none';
            document.getElementById(tab + 'ErrorList').innerHTML = '';
        }

        // Terminal log functions
        function terminalLog(tab, message, type = 'info') {
            const terminal = document.getElementById(tab + 'Terminal');
            if (!terminal) return;
            
            terminal.style.display = 'block';
            
            const line = document.createElement('div');
            line.className = `terminal-line ${type}`;
            
            const timestamp = new Date().toLocaleTimeString('vi-VN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            line.textContent = `[${timestamp}] ${message}`;
            terminal.appendChild(line);
            
            // Auto scroll to bottom
            terminal.scrollTop = terminal.scrollHeight;
            
            // Keep only last 100 lines
            while (terminal.children.length > 100) {
                terminal.removeChild(terminal.firstChild);
            }
        }

        function clearTerminal(tab) {
            const terminal = document.getElementById(tab + 'Terminal');
            if (terminal) {
                terminal.innerHTML = '';
                terminal.style.display = 'none';
            }
        }

        // Switch tabs
        function switchTab(tab) {
            if (isProcessing) {
                alert('Processing, please wait...');
                return;
            }

            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            if (tab === 'pack') {
                document.querySelectorAll('.tab')[0].classList.add('active');
                document.getElementById('pack-tab').classList.add('active');
            } else {
                document.querySelectorAll('.tab')[1].classList.add('active');
                document.getElementById('unpack-tab').classList.add('active');
            }
        }

        // Set processing state
        function setProcessing(processing, tab) {
            isProcessing = processing;
            shouldStop = false; // Reset stop flag
            const uploadArea = document.getElementById(tab + 'UploadArea');
            const btn = document.getElementById(tab + 'Btn');
            const stopBtn = document.getElementById(tab + 'StopBtn');
            const resetBtn = document.getElementById(tab + 'ResetBtn');
            const tabs = document.querySelectorAll('.tab');

            if (processing) {
                uploadArea.classList.add('disabled');
                if (btn) btn.disabled = true;
                if (stopBtn) stopBtn.style.display = 'inline-block';
                if (resetBtn) resetBtn.style.display = 'none';
                tabs.forEach(t => t.style.pointerEvents = 'none');
            } else {
                uploadArea.classList.remove('disabled');
                if (btn) btn.disabled = false;
                if (stopBtn) stopBtn.style.display = 'none';
                if (resetBtn) resetBtn.style.display = 'inline-block';
                tabs.forEach(t => t.style.pointerEvents = 'auto');
            }
        }

        // Stop process
        function stopProcess(tab) {
            shouldStop = true;
            terminalLog(tab, '[STOP] STOP signal received. Stopping...', 'error');
            showStatus(tab + 'Status', '! Đã dừng xử lý', 'info');
        }

        // Reset process
        function resetProcess(tab) {
            // Clear all data
            if (tab === 'pack') {
                projectFiles = [];
                document.getElementById('folderInput').value = '';
                document.getElementById('packBtn').style.display = 'none';
            } else {
                packedContent = '';
                packedChunks = [];
                document.getElementById('txtInput').value = '';
                document.getElementById('unpackBtn').style.display = 'none';
            }
            
            // Clear UI
            clearTerminal(tab);
            clearErrorLog(tab);
            const fileList = document.getElementById(tab + 'FileList');
            if (fileList) fileList.style.display = 'none';
            document.getElementById(tab + 'Status').style.display = 'none';
            document.getElementById(tab + 'ResetBtn').style.display = 'none';
            
            // Reset progress
            updateProgress(tab, 0, '');
            document.getElementById(tab + 'Progress').style.display = 'none';
            
            terminalLog(tab, '[RESET] Reset completed', 'info');
            setTimeout(() => clearTerminal(tab), 1000);
        }

        // Update progress
        function updateProgress(tab, percent, text) {
            const progressContainer = document.getElementById(tab + 'Progress');
            const progressFill = document.getElementById(tab + 'ProgressFill');
            const progressText = document.getElementById(tab + 'ProgressText');

            progressContainer.style.display = 'block';
            progressFill.style.width = percent + '%';
            progressText.textContent = text;

            if (percent >= 100) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    progressFill.style.width = '0%';
                }, 1500);
            }
        }

        // Folder input handler - Quick scan without reading content
        document.getElementById('folderInput').addEventListener('change', async (e) => {
            if (isProcessing) {
                e.preventDefault();
                return;
            }

            const files = Array.from(e.target.files);
            projectFiles = files.map(file => ({
                file: file,
                path: file.webkitRelativePath || file.name,
                selected: true,
                content: null // Will be loaded later
            }));
            
            clearErrorLog('pack');
            clearTerminal('pack');
            
            terminalLog('pack', `Found ${files.length} files`, 'info');
            terminalLog('pack', 'Ready to select files for packing', 'info');
            
            displayFileTree(projectFiles);
            document.getElementById('packBtn').style.display = 'inline-block';
            updatePackButton();
        });

        // Text file input handler - Extract from ZIP
        document.getElementById('txtInput').addEventListener('change', async (e) => {
            if (isProcessing) {
                e.preventDefault();
                return;
            }

            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.name.endsWith('.zip')) {
                showStatus('unpackStatus', 'Please select a .zip file!', 'error');
                return;
            }
            
            clearTerminal('unpack');
            clearErrorLog('unpack');
            
            setProcessing(true, 'unpack');
            updateProgress('unpack', 10, 'Reading ZIP file...');
            
            terminalLog('unpack', `Loading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
            
            try {
                // Load ZIP file
                const zip = await JSZip.loadAsync(file);
                
                terminalLog('unpack', 'Extracting chunks from ZIP...', 'info');
                terminalLog('unpack', '─'.repeat(50), 'info');
                
                // Get all .txt files from ZIP
                const txtFiles = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (relativePath.endsWith('.txt') && !zipEntry.dir) {
                        txtFiles.push({ name: relativePath, entry: zipEntry });
                    }
                });
                
                if (txtFiles.length === 0) {
                    throw new Error('No .txt files found in ZIP');
                }
                
                // Sort by name to ensure correct order
                txtFiles.sort((a, b) => a.name.localeCompare(b.name));
                
                terminalLog('unpack', `Found ${txtFiles.length} chunk(s) in ZIP`, 'success');
                
                packedChunks = [];
                
                for (let i = 0; i < txtFiles.length; i++) {
                    const txtFile = txtFiles[i];
                    terminalLog('unpack', `[${i + 1}/${txtFiles.length}] Extracting: ${txtFile.name}`, 'info');
                    
                    const content = await txtFile.entry.async('text');
                    packedChunks.push({
                        name: txtFile.name,
                        content: content,
                        index: i
                    });
                    
                    const percent = 10 + ((i + 1) / txtFiles.length) * 30;
                    updateProgress('unpack', percent, `Extracting ${i + 1}/${txtFiles.length} chunks`);
                }
                
                // Display loaded files
                displayUnpackFileList(packedChunks);
                
                document.getElementById('unpackBtn').style.display = 'inline-block';
                terminalLog('unpack', '─'.repeat(50), 'info');
                terminalLog('unpack', `✓ Extracted ${packedChunks.length} chunk(s) successfully`, 'success');
                showStatus('unpackStatus', `✓ Loaded ${packedChunks.length} chunk(s) from ZIP`, 'success');

                updateProgress('unpack', 100, 'Ready to unpack!');
            } catch (error) {
                terminalLog('unpack', `✗ Error loading ZIP: ${error.message}`, 'error');
                showStatus('unpackStatus', `❌ Error: ${error.message}`, 'error');
            }
            
            setProcessing(false, 'unpack');
        });

        // Display unpack file list
        function displayUnpackFileList(chunks) {
            const listDiv = document.getElementById('unpackFileList');
            listDiv.style.display = 'block';
            
            const fragment = document.createDocumentFragment();
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'file-select-header';
            headerDiv.innerHTML = `<strong>Loaded files (${chunks.length} file${chunks.length > 1 ? 's' : ''})</strong>`;
            fragment.appendChild(headerDiv);
            
            chunks.forEach((chunk, index) => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.innerHTML = `
                    <span style="color: var(--color-accent-primary); margin-right: 8px;">[${index + 1}]</span>
                    <span>📄 ${chunk.name}</span>
                    <span style="margin-left: auto; color: var(--color-text-muted); font-size: var(--font-sm);">
                        ${(chunk.content.length / 1024).toFixed(2)} KB
                    </span>
                `;
                fragment.appendChild(div);
            });
            
            listDiv.innerHTML = '';
            listDiv.appendChild(fragment);
        }

        // Read file content
        function readFileContent(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (error) => {
                    console.warn(`Không thể đọc file: ${file.name}`, error);
                    resolve(''); // Resolve với empty string thay vì reject
                };
                reader.readAsText(file);
            });
        }

        // Display file tree with folder structure and checkboxes
        function displayFileTree(files) {
            const listDiv = document.getElementById('packFileList');
            listDiv.style.display = 'block';

            // Build folder structure
            const tree = {};
            files.forEach((fileObj, index) => {
                fileObj.index = index;
                const parts = fileObj.path.split('/');
                let current = tree;
                
                parts.forEach((part, i) => {
                    if (i === parts.length - 1) {
                        // It's a file
                        if (!current._files) current._files = [];
                        current._files.push(fileObj);
                    } else {
                        // It's a folder
                        if (!current[part]) current[part] = {};
                        current = current[part];
                    }
                });
            });

            const fragment = document.createDocumentFragment();
            
            // Header with select all/none
            const headerDiv = document.createElement('div');
            headerDiv.className = 'file-select-header';
            headerDiv.innerHTML = `
                <strong>Select files/folders to pack (${files.length} total)</strong>
            `;
            fragment.appendChild(headerDiv);

            // Render tree
            renderTree(tree, fragment, '');

            listDiv.innerHTML = '';
            listDiv.appendChild(fragment);
            
            updatePackButton();
        }

        // Render tree recursively
        function renderTree(node, parent, prefix, depth = 0) {
            const folders = Object.keys(node).filter(k => k !== '_files').sort();
            const files = node._files || [];

            // Render folders first
            folders.forEach(folderName => {
                const folderId = `folder-${prefix}${folderName}`.replace(/[^a-zA-Z0-9]/g, '-');
                
                const folderDiv = document.createElement('div');
                folderDiv.className = 'file-item folder-item selected';
                folderDiv.style.fontWeight = 'bold';
                folderDiv.style.paddingLeft = `${depth * 20}px`;
                folderDiv.dataset.folder = prefix + folderName;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.dataset.isFolder = 'true';
                checkbox.onclick = (e) => e.stopPropagation(); // Only stop propagation, don't toggle collapse
                checkbox.onchange = (e) => {
                    toggleFolder(prefix + folderName, e.target.checked);
                    folderDiv.classList.toggle('selected', e.target.checked);
                    updatePackButton();
                };
                
                const label = document.createElement('label');
                label.textContent = `📂 ${folderName}/`;
                label.style.cursor = 'pointer';
                label.style.flex = '1';
                
                // Click on folder row (except checkbox) = toggle collapse
                folderDiv.onclick = (e) => {
                    if (e.target === checkbox) return; // Let checkbox handle its own click
                    
                    // Toggle collapse
                    const content = document.getElementById(folderId);
                    if (content) {
                        content.classList.toggle('collapsed');
                        // Update folder icon
                        if (content.classList.contains('collapsed')) {
                            label.textContent = `📁 ${folderName}/`;
                        } else {
                            label.textContent = `📂 ${folderName}/`;
                        }
                    }
                };
                
                folderDiv.appendChild(checkbox);
                folderDiv.appendChild(label);
                parent.appendChild(folderDiv);

                // Create container for folder contents
                const folderContent = document.createElement('div');
                folderContent.className = 'folder-content';
                folderContent.id = folderId;
                parent.appendChild(folderContent);

                // Render subfolder contents into the container
                renderTree(node[folderName], folderContent, prefix + folderName + '/', depth + 1);
            });

            // Render files
            files.forEach(fileObj => {
                const div = document.createElement('div');
                div.className = 'file-item selected';
                div.style.paddingLeft = `${depth * 20}px`;
                div.dataset.index = fileObj.index;
                div.dataset.folder = prefix.slice(0, -1);
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.id = `file-${fileObj.index}`;
                checkbox.onchange = (e) => {
                    projectFiles[fileObj.index].selected = e.target.checked;
                    div.classList.toggle('selected', e.target.checked);
                    updatePackButton();
                };
                
                const label = document.createElement('label');
                label.htmlFor = `file-${fileObj.index}`;
                label.textContent = `📄 ${fileObj.path.split('/').pop()}`;
                label.style.cursor = 'pointer';
                label.style.flex = '1';
                
                div.appendChild(checkbox);
                div.appendChild(label);
                
                div.onclick = (e) => {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                };
                
                parent.appendChild(div);
            });
        }

        // Toggle all files and subfolders in a folder
        function toggleFolder(folderPath, checked) {
            // Update all files in this folder
            projectFiles.forEach((fileObj, index) => {
                if (fileObj.path.startsWith(folderPath + '/')) {
                    fileObj.selected = checked;
                    const checkbox = document.getElementById(`file-${index}`);
                    if (checkbox) {
                        checkbox.checked = checked;
                        checkbox.closest('.file-item').classList.toggle('selected', checked);
                    }
                }
            });
            
            // Update all subfolder checkboxes
            const folderCheckboxes = document.querySelectorAll('input[data-is-folder="true"]');
            folderCheckboxes.forEach(cb => {
                const folderDiv = cb.closest('.file-item');
                const subFolderPath = folderDiv.dataset.folder;
                
                // If this subfolder is inside the toggled folder
                if (subFolderPath && subFolderPath.startsWith(folderPath + '/')) {
                    cb.checked = checked;
                    folderDiv.classList.toggle('selected', checked);
                }
            });
        }

        // Select/Deselect all files
        // Update pack button text with selected count
        function updatePackButton() {
            const selectedCount = projectFiles.filter(f => f.selected).length;
            const packBtn = document.getElementById('packBtn');
            
            if (selectedCount > 0) {
                packBtn.textContent = `[Save] Pack ${selectedCount} file${selectedCount > 1 ? 's' : ''}`;
                packBtn.disabled = false;
            } else {
                packBtn.textContent = `[Save] Pack 0 files`;
                packBtn.disabled = true;
            }
        }

        // Get selected files and read their content
        async function getSelectedFilesWithContent() {
            const selectedFiles = projectFiles.filter(f => f.selected);
            
            if (selectedFiles.length === 0) return [];

            setProcessing(true, 'pack');
            updateProgress('pack', 0, 'Reading selected files...');
            clearTerminal('pack');
            
            terminalLog('pack', `Reading ${selectedFiles.length} selected files...`, 'info');
            terminalLog('pack', '─'.repeat(50), 'info');

            const BATCH_SIZE = 20;
            const filesWithContent = [];
            let completed = 0;

            for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
                if (shouldStop) {
                    terminalLog('pack', '[■] Process stopped by user', 'error');
                    break;
                }
                
                const batch = selectedFiles.slice(i, i + BATCH_SIZE);
                
                const batchResults = await Promise.all(
                    batch.map(async (fileObj) => {
                        try {
                            terminalLog('pack', `[>] Reading: ${fileObj.path}`);
                            const content = await readFileContent(fileObj.file);

                            if (content === '') {
                                terminalLog('pack', `[!] Skipped: ${fileObj.path} (binary file)`, 'error');
                                logError('pack', fileObj.path, 'Cannot read file (possibly binary file)');
                                return null;
                            }
                            
                            terminalLog('pack', `✓ Success: ${fileObj.path} (${(content.length / 1024).toFixed(2)} KB)`, 'success');

                            return {
                                path: fileObj.path,
                                content: content
                            };
                        } catch (error) {
                            const errorMsg = error.message || 'Unknown error';
                            terminalLog('pack', `✗ Error: ${fileObj.path} - ${errorMsg}`, 'error');
                            logError('pack', fileObj.path, errorMsg);
                            return null;
                        }
                    })
                );

                const validResults = batchResults.filter(r => r !== null);
                filesWithContent.push(...validResults);
                completed += batch.length;

                const percent = (completed / selectedFiles.length) * 100;
                updateProgress('pack', percent, `Read ${completed}/${selectedFiles.length} files`);
            }

            terminalLog('pack', '─'.repeat(50), 'info');
            terminalLog('pack', `✓ Loaded ${filesWithContent.length} files successfully`, 'success');
            
            if (errorLog.pack.length > 0) {
                terminalLog('pack', `[!] ${errorLog.pack.length} files failed`, 'error');
            }

            return filesWithContent;
        }

        // Pack project - OPTIMIZED: Array join with chunking support
        async function packProject() {
            const selectedFiles = await getSelectedFilesWithContent();
            
            if (selectedFiles.length === 0) {
                showStatus('packStatus', 'No files selected or all failed to read!', 'error');
                setProcessing(false, 'pack');
                return;
            }

            updateProgress('pack', 0, 'Packing...');
            clearTerminal('pack');
            
            terminalLog('pack', 'Starting pack process...', 'info');
            terminalLog('pack', '─'.repeat(50), 'info');

            try {
                const parts = ['===PROJECT_PACK_START===\n'];
                const UPDATE_INTERVAL = 10;
                let currentSize = 0;
                let chunkIndex = 1;
                const chunks = [];
                
                terminalLog('pack', `Max chunk size: ${(MAX_CHUNK_SIZE / 1024 / 1024).toFixed(2)} MB`, 'info');
                
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    
                    try {
                        const fileBlock = [
                            '\n===FILE_START===\n',
                            'PATH: ', file.path, '\n',
                            'CONTENT_START:\n',
                            file.content,
                            '\n===FILE_END===\n'
                        ].join('');
                        
                        const fileBlockSize = new Blob([fileBlock]).size;
                        
                        // Check if adding this file would exceed chunk size
                        if (currentSize + fileBlockSize > MAX_CHUNK_SIZE && parts.length > 1) {
                            // Save current chunk
                            parts.push('\n===PROJECT_PACK_END===');
                            const chunkContent = parts.join('');
                            chunks.push({
                                index: chunkIndex,
                                content: chunkContent,
                                size: new Blob([chunkContent]).size
                            });
                            
                            terminalLog('pack', `✓ Chunk ${chunkIndex} created (${(new Blob([chunkContent]).size / 1024 / 1024).toFixed(2)} MB)`, 'success');
                            
                            // Start new chunk
                            chunkIndex++;
                            parts.length = 0;
                            parts.push('===PROJECT_PACK_START===\n');
                            currentSize = 0;
                        }
                        
                        parts.push(fileBlock);
                        currentSize += fileBlockSize;
                        
                    } catch (error) {
                        logError('pack', file.path, `Error packing: ${error.message}`);
                        terminalLog('pack', `✗ Error packing: ${file.path}`, 'error');
                        continue;
                    }

                    if (i % UPDATE_INTERVAL === 0 || i === selectedFiles.length - 1) {
                        const percent = ((i + 1) / selectedFiles.length) * 80;
                        updateProgress('pack', percent, `Packing ${i + 1}/${selectedFiles.length} files`);
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
                
                // Save last chunk
                if (parts.length > 1) {
                    parts.push('\n===PROJECT_PACK_END===');
                    const chunkContent = parts.join('');
                    chunks.push({
                        index: chunkIndex,
                        content: chunkContent,
                        size: new Blob([chunkContent]).size
                    });
                    
                    terminalLog('pack', `✓ Chunk ${chunkIndex} created (${(new Blob([chunkContent]).size / 1024 / 1024).toFixed(2)} MB)`, 'success');
                }

                updateProgress('pack', 85, 'Creating ZIP archive...');
                terminalLog('pack', '─'.repeat(50), 'info');
                terminalLog('pack', `Creating ZIP with ${chunks.length} chunk(s)...`, 'info');

                // Create ZIP file containing all chunks
                const zip = new JSZip();
                
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const fileName = chunks.length === 1 
                        ? 'project-packed.txt' 
                        : `project-packed-part-${chunk.index}.txt`;
                    
                    zip.file(fileName, chunk.content);
                    terminalLog('pack', `✓ Added to ZIP: ${fileName} (${(chunk.size / 1024).toFixed(2)} KB)`, 'success');
                }
                
                updateProgress('pack', 90, 'Compressing ZIP...');
                terminalLog('pack', 'Compressing ZIP archive...', 'info');
                
                // Generate ZIP file
                const zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 9 } // Maximum compression
                }, (metadata) => {
                    const percent = 90 + (metadata.percent * 0.08);
                    updateProgress('pack', percent, `Compressing... ${Math.round(metadata.percent)}%`);
                });
                
                updateProgress('pack', 98, 'Downloading...');
                
                // Download single ZIP file
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'project-packed.zip';
                a.click();
                URL.revokeObjectURL(url);
                
                const zipSize = (zipBlob.size / 1024 / 1024).toFixed(2);
                terminalLog('pack', `✓ Downloaded: project-packed.zip (${zipSize} MB)`, 'success');

                updateProgress('pack', 100, 'Complete!');
                terminalLog('pack', '─'.repeat(50), 'info');
                terminalLog('pack', `✓ Pack completed! Created 1 ZIP file with ${chunks.length} chunk(s)`, 'success');
                
                let statusMsg = `✓ Created project-packed.zip (${zipSize} MB, ${chunks.length} chunk${chunks.length > 1 ? 's' : ''})`;
                if (errorLog.pack.length > 0) {
                    statusMsg += ` | ! ${errorLog.pack.length} files failed`;
                }
                showStatus('packStatus', statusMsg, errorLog.pack.length > 0 ? 'info' : 'success');
                
            } catch (error) {
                terminalLog('pack', `✗ Critical error: ${error.message}`, 'error');
                showStatus('packStatus', `❌ Critical error: ${error.message}`, 'error');
            }
            
            setProcessing(false, 'pack');
        }

        // Unpack project with chunking support
        async function unpackProject() {
            if (packedChunks.length === 0) {
                showStatus('unpackStatus', 'No files loaded!', 'error');
                return;
            }

            setProcessing(true, 'unpack');
            clearErrorLog('unpack');
            clearTerminal('unpack');
            updateProgress('unpack', 0, 'Merging chunks...');
            
            terminalLog('unpack', 'Starting unpack process...', 'info');
            terminalLog('unpack', '─'.repeat(50), 'info');

            try {
                // Merge all chunks in order
                terminalLog('unpack', `Merging ${packedChunks.length} chunk(s)...`, 'info');
                
                let mergedContent = '';
                for (let i = 0; i < packedChunks.length; i++) {
                    const chunk = packedChunks[i];
                    terminalLog('unpack', `[${i + 1}/${packedChunks.length}] Merging: ${chunk.name}`, 'info');
                    
                    let chunkContent = chunk.content;
                    
                    // Remove markers from middle chunks
                    if (i > 0) {
                        // Remove start marker from non-first chunks
                        chunkContent = chunkContent.replace('===PROJECT_PACK_START===\n', '');
                    }
                    if (i < packedChunks.length - 1) {
                        // Remove end marker from non-last chunks
                        chunkContent = chunkContent.replace('\n===PROJECT_PACK_END===', '');
                    }
                    
                    mergedContent += chunkContent;
                    
                    const percent = ((i + 1) / packedChunks.length) * 20;
                    updateProgress('unpack', percent, `Merging ${i + 1}/${packedChunks.length} chunks`);
                }
                
                terminalLog('unpack', `✓ Merged ${packedChunks.length} chunk(s) successfully`, 'success');
                terminalLog('unpack', `Total size: ${(mergedContent.length / 1024 / 1024).toFixed(2)} MB`, 'info');
                
                updateProgress('unpack', 25, 'Parsing files...');
                terminalLog('unpack', '─'.repeat(50), 'info');
                terminalLog('unpack', 'Parsing file structure...', 'info');
                
                const files = parsePackedContent(mergedContent);
                
                terminalLog('unpack', `✓ Found ${files.length} files`, 'success');
                updateProgress('unpack', 40, `Found ${files.length} files`);

                terminalLog('unpack', '─'.repeat(50), 'info');
                terminalLog('unpack', 'Creating ZIP archive...', 'info');
                
                await downloadAsZip(files);

                updateProgress('unpack', 100, 'Complete!');
                terminalLog('unpack', '─'.repeat(50), 'info');
                terminalLog('unpack', '✓ Unpack completed successfully!', 'success');

                const errorCount = errorLog.unpack.length;
                let statusMsg = `✓ Unpacked ${files.length - errorCount} files successfully!`;
                if (errorCount > 0) {
                    statusMsg += ` | ! ${errorCount} files failed`;
                }
                showStatus('unpackStatus', statusMsg, errorCount > 0 ? 'info' : 'success');
            } catch (error) {
                terminalLog('unpack', `✗ Critical error: ${error.message}`, 'error');
                showStatus('unpackStatus', `❌ Error: ${error.message}`, 'error');
            }

            setProcessing(false, 'unpack');
        }

        // Parse packed content - OPTIMIZED: indexOf with error handling
        function parsePackedContent(content) {
            const files = [];
            let pos = 0;

            // OPTIMIZATION 4: Use indexOf instead of regex for better performance
            while (true) {
                try {
                    const fileStart = content.indexOf('===FILE_START===', pos);
                    if (fileStart === -1) break;

                    const pathStart = content.indexOf('PATH: ', fileStart);
                    if (pathStart === -1) break;

                    const pathEnd = content.indexOf('\n', pathStart + 6);
                    if (pathEnd === -1) break;

                    const path = content.substring(pathStart + 6, pathEnd).trim();

                    const contentStart = content.indexOf('CONTENT_START:\n', pathEnd);
                    if (contentStart === -1) break;

                    const fileEnd = content.indexOf('\n===FILE_END===', contentStart + 15);
                    if (fileEnd === -1) {
                        logError('unpack', path, 'Không tìm thấy FILE_END marker');
                        break;
                    }

                    const fileContent = content.substring(contentStart + 15, fileEnd);

                    files.push({ path, content: fileContent });
                    pos = fileEnd + 15;
                } catch (error) {
                    logError('unpack', 'Unknown file', `Lỗi parse: ${error.message}`);
                    break;
                }
            }

            return files;
        }

        // Download files as ZIP - OPTIMIZED: Single ZIP file instead of multiple downloads
        async function downloadAsZip(files) {
            updateProgress('unpack', 40, 'Đang tạo file ZIP...');

            try {
                // Check if JSZip is loaded
                if (typeof JSZip === 'undefined') {
                    throw new Error('JSZip library chưa được tải. Vui lòng refresh trang.');
                }

                const zip = new JSZip();

                // Add all files to ZIP
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];

                    try {
                        // Add file to ZIP with proper path structure
                        zip.file(file.path, file.content);

                        // Update progress
                        if (i % 10 === 0 || i === files.length - 1) {
                            const percent = 40 + ((i + 1) / files.length) * 40;
                            updateProgress('unpack', percent, `Đang thêm ${i + 1}/${files.length} files vào ZIP`);
                        }
                    } catch (error) {
                        logError('unpack', file.path, `Lỗi thêm vào ZIP: ${error.message}`);
                    }
                }

                updateProgress('unpack', 85, 'Đang nén file ZIP...');

                // Generate ZIP file
                const zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                }, (metadata) => {
                    // Update progress during compression
                    const percent = 85 + (metadata.percent * 0.15);
                    updateProgress('unpack', percent, `Đang nén... ${Math.round(metadata.percent)}%`);
                });

                updateProgress('unpack', 95, 'Đang tải xuống...');

                // Download ZIP file
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'project-unpacked.zip';
                a.click();
                URL.revokeObjectURL(url);

            } catch (error) {
                logError('unpack', 'ZIP Creation', `Lỗi tạo ZIP: ${error.message}`);
                throw error;
            }
        }

        // Show status message
        function showStatus(elementId, message, type) {
            const statusDiv = document.getElementById(elementId);
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;
            statusDiv.style.display = 'block';
        }

        // Drag and drop for pack
        const packArea = document.getElementById('packUploadArea');
        packArea.addEventListener('dragover', (e) => {
            if (isProcessing) return;
            e.preventDefault();
            packArea.classList.add('dragover');
        });
        packArea.addEventListener('dragleave', () => {
            packArea.classList.remove('dragover');
        });
        packArea.addEventListener('drop', (e) => {
            if (isProcessing) return;
            e.preventDefault();
            packArea.classList.remove('dragover');
            document.getElementById('folderInput').files = e.dataTransfer.files;
            document.getElementById('folderInput').dispatchEvent(new Event('change'));
        });

        // Drag and drop for unpack
        const unpackArea = document.getElementById('unpackUploadArea');
        unpackArea.addEventListener('dragover', (e) => {
            if (isProcessing) return;
            e.preventDefault();
            unpackArea.classList.add('dragover');
        });
        unpackArea.addEventListener('dragleave', () => {
            unpackArea.classList.remove('dragover');
        });
        unpackArea.addEventListener('drop', (e) => {
            if (isProcessing) return;
            e.preventDefault();
            unpackArea.classList.remove('dragover');
            document.getElementById('txtInput').files = e.dataTransfer.files;
            document.getElementById('txtInput').dispatchEvent(new Event('change'));
        });
