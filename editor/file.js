const EDITOR_PASSWORD = 'NgTh@05102023';
const STORAGE_EDITOR_DRAFT = 'english-editor-draft';
const STORAGE_PUBLISHED = 'english-published-content';
const BASE_DATA_PATH = '../data/content.json';
const DEFAULT_CONTENT = {
  folders: [
    { id: 'vocabulary', type: 'folder', name: 'Vocabulary', children: [] },
    { id: 'grammar', type: 'folder', name: 'Grammar', children: [] }
  ]
};

const broadcastChannel = new BroadcastChannel('english-app-sync');


let editorData = { folders: [] };
let currentFileId = null;
let currentFile = null;
let savedSelectionRange = null;

function saveSelectionRange() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const editor = document.getElementById('editor-content');
  if (!editor || !editor.contains(range.commonAncestorContainer)) return;
  savedSelectionRange = range.cloneRange();
}

function restoreSelectionRange() {
  if (!savedSelectionRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedSelectionRange);
}

function keepSelectionForControl(control) {
  if (!control) return;
  control.addEventListener('mousedown', saveSelectionRange);
  control.addEventListener('focus', saveSelectionRange);
}

function setupColorPalette(containerId, colors, applyFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  colors.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-swatch';
    if (color === 'transparent') {
      button.classList.add('none-swatch');
      button.textContent = '×';
      button.title = 'Remove highlight';
    } else {
      button.style.backgroundColor = color;
    }
    button.dataset.color = color;
    button.addEventListener('mousedown', saveSelectionRange);
    button.addEventListener('click', () => {
      restoreSelectionRange();
      applyFn(color);
    });
    container.appendChild(button);
  });
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fetchBaseData() {
  return ContentStore.loadContent({ basePath: '../' });
}

function loadEditorData() {
  return ContentStore.loadContent({ basePath: '../', editor: true });
}

async function saveDraftData(message = 'Draft saved.') {
  saveCurrentFileContent();
  if (currentFile) {
    currentFile.status = currentFile.status || 'draft';
    currentFile.hasUnpublishedChanges = currentFile.status === 'published';
  }
  try {
    const result = await ContentStore.saveContent(editorData, { mode: 'draft' });
    editorData = result.data;
    if (currentFileId) currentFile = findNodeById(editorData.folders, currentFileId);
    showEditorMessage(result.universal ? result.message : `${message} ${result.message}`);
  } catch (error) {
    showEditorMessage(`Could not save draft: ${error.message}`);
  }
}

async function postContent() {
  saveCurrentFileContent();
  if (currentFile) {
    currentFile.status = 'published';
    currentFile.publishedContent = currentFile.content;
    currentFile.hasUnpublishedChanges = false;
    currentFile.updatedAt = ContentStore.nowIso();
  }
  try {
    const result = await ContentStore.saveContent(editorData, { mode: 'publish' });
    editorData = result.data;
    if (currentFileId) currentFile = findNodeById(editorData.folders, currentFileId);
    broadcastChannel.postMessage('published-updated');
    showEditorMessage(result.universal ? result.message : `Posted locally. ${result.message}`);
  } catch (error) {
    showEditorMessage(`Could not post: ${error.message}`);
  }
}


function showEditorMessage(text) {
  const message = document.getElementById('editor-message');
  if (message) message.textContent = text;
}

function findNodeById(collection, id) {
  for (const node of collection) {
    if (node.id === id) return node;
    if (node.type === 'folder' && node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentForId(collection, id, parent = null) {
  for (const node of collection) {
    if (node.id === id) return parent;
    if (node.type === 'folder' && node.children) {
      const found = findParentForId(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

function getFolderById(folderId) {
  const node = findNodeById(editorData.folders, folderId);
  return node?.type === 'folder' ? node : null;
}

function createEditorFileTreeNode(node, parentEl) {
  const treeNode = document.createElement('div');
  treeNode.className = `tree-item ${node.type}-item`;
  const icon = node.type === 'folder' ? '📁' : '📄';
  treeNode.innerHTML = `<span class="item-icon">${icon}</span><span class="item-name"></span>`;
  treeNode.querySelector('.item-name').textContent = node.name;
  if (node.type === 'file') {
    treeNode.addEventListener('click', () => {
      if (node.id !== currentFileId) {
        window.location.href = `file.html?file=${encodeURIComponent(node.id)}`;
      }
    });
  }
  if (node.id === currentFileId) treeNode.classList.add('active');
  parentEl.appendChild(treeNode);

  if (node.type === 'folder' && node.children?.length) {
    const childList = document.createElement('div');
    childList.style.paddingLeft = '1rem';
    node.children.forEach((child) => createEditorFileTreeNode(child, childList));
    parentEl.appendChild(childList);
  }
}

function renderEditorFileTree() {
  const container = document.getElementById('editor-file-tree');
  if (!container) return;
  container.innerHTML = '';
  editorData.folders.forEach((folder) => createEditorFileTreeNode(folder, container));
}

function createFileInFolder(folderId, name) {
  const folder = getFolderById(folderId);
  if (!folder) return null;
  const file = {
    id: ContentStore.makeId('file'),
    type: 'file',
    name,
    status: 'draft',
    content: '<p>Start writing content here...</p>',
    publishedContent: '',
    hasUnpublishedChanges: false,
    createdAt: ContentStore.nowIso(),
    updatedAt: ContentStore.nowIso(),
    assets: []
  };
  folder.children = folder.children || [];
  folder.children.push(file);
  saveDraftData('New file created.');
  return file;
}

function setCurrentFile(fileId) {
  currentFileId = fileId;
  currentFile = findNodeById(editorData.folders, fileId);
  const titleInput = document.getElementById('file-name-input');
  const content = document.getElementById('editor-content');
  if (!currentFile) return;
  if (titleInput) titleInput.value = currentFile.name || '';
  if (content) content.innerHTML = currentFile.content || '<p>Start writing content.</p>';
  const statusLabel = document.getElementById('file-status-label');
  if (statusLabel) {
    statusLabel.textContent = currentFile.status === 'published'
      ? (currentFile.hasUnpublishedChanges ? 'Published + Draft' : 'Published')
      : 'Draft';
    statusLabel.className = `status-tag ${currentFile.status === 'published' ? 'published' : ''}`;
  }
  renderEditorFileTree();
}

function saveCurrentFileContent() {
  if (!currentFile) return;
  const content = document.getElementById('editor-content');
  const titleInput = document.getElementById('file-name-input');
  if (titleInput) currentFile.name = titleInput.value || currentFile.name || 'New file';
  if (content) currentFile.content = content.innerHTML;
  currentFile.updatedAt = ContentStore.nowIso();
}

function execCommand(command, value = null) {
  restoreSelectionRange();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(command, false, value);
}

function insertImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const wrapper = document.createElement('span');
    wrapper.className = 'image-wrapper';
    wrapper.style.display = 'inline-block';
    wrapper.style.resize = 'both';
    wrapper.style.overflow = 'auto';
    wrapper.style.maxWidth = '100%';
    wrapper.style.minWidth = '120px';
    wrapper.style.margin = '0.75rem 0';

    const img = document.createElement('img');
    img.src = reader.result;
    img.className = 'image-block';
    img.alt = 'Image';
    img.draggable = false;
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = 'auto';

    wrapper.appendChild(img);
    const range = window.getSelection().getRangeAt(0);
    range.insertNode(wrapper);
  };
  reader.readAsDataURL(file);
}

function insertSound(file, type) {
  const reader = new FileReader();
  reader.onload = () => {
    const container = document.createElement('div');
    if (type === 'long') {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = reader.result;
      audio.style.display = 'block';
      audio.style.margin = '0.75rem 0';
      container.appendChild(audio);
    } else {
      const button = document.createElement('button');
      button.className = 'audio-short';
      button.type = 'button';
      button.textContent = '🔊 Play short audio';
      const audio = document.createElement('audio');
      audio.src = reader.result;
      button.addEventListener('click', () => audio.play());
      container.appendChild(button);
    }
    const range = window.getSelection().getRangeAt(0);
    range.insertNode(container);
  };
  reader.readAsDataURL(file);
}

function insertBlankfield() {
  const blankId = `blank-${Math.random().toString(36).slice(2, 10)}`;
  const wrapper = document.createElement('span');
  wrapper.className = 'blankfield';
  wrapper.dataset.id = blankId;
  wrapper.innerHTML = `<span class="blank-line">____</span><span class="blank-answer" contenteditable="true" spellcheck="false">Answer</span>`;
  const range = window.getSelection().getRangeAt(0);
  range.insertNode(wrapper);
}

function insertMultipleChoice() {
  const mcqId = `mcq-${Math.random().toString(36).slice(2, 10)}`;
  const container = document.createElement('div');
  container.className = 'multiple-choice';
  container.dataset.id = mcqId;
  container.dataset.correct = 'A';
  container.innerHTML = `
    <div><strong>Question:</strong></div>
    <div contenteditable="true" class="mcq-question">Enter the question here...</div>
    <div class="mcq-row">
      <button type="button" class="muq-button selected" data-option="A">A</button>
      <button type="button" class="muq-button" data-option="B">B</button>
      <button type="button" class="muq-button" data-option="C">C</button>
      <button type="button" class="muq-button" data-option="D">D</button>
    </div>
    <div class="mcq-note">Click once to choose the correct answer.</div>
  `;
  container.querySelectorAll('.muq-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.muq-button').forEach((item) => item.classList.remove('selected'));
      btn.classList.add('selected');
      container.dataset.correct = btn.dataset.option;
    });
  });
  const range = window.getSelection().getRangeAt(0);
  range.insertNode(container);
}

function applyLineHeight() {
  restoreSelectionRange();
  const value = document.getElementById('line-height').value;
  const range = window.getSelection().getRangeAt(0);
  if (!range || range.collapsed) return;
  const span = document.createElement('span');
  span.style.lineHeight = value;
  try {
    range.surroundContents(span);
  } catch (e) {
    // Fallback for partial selections
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }
}

function applyFontSize() {
  restoreSelectionRange();
  const size = parseInt(document.getElementById('font-size').value, 10);
  if (!size || size < 10 || size > 64) return;
  const range = window.getSelection().getRangeAt(0);
  if (!range || range.collapsed) return;
  const span = document.createElement('span');
  span.style.fontSize = `${size}px`;
  try {
    range.surroundContents(span);
  } catch (e) {
    // Fallback for partial selections
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }
}

function applyTextColor(color) {
  execCommand('foreColor', color);
}

function applyHighlightColor(color) {
  execCommand('hiliteColor', color);
}

function bindEditorToolbar() {
  document.addEventListener('selectionchange', saveSelectionRange);
  document.getElementById('font-family').addEventListener('change', (event) => {
    execCommand('fontName', event.target.value);
  });
  const fontSizeInput = document.getElementById('font-size');
  const lineHeightInput = document.getElementById('line-height');
  keepSelectionForControl(fontSizeInput);
  keepSelectionForControl(lineHeightInput);
  fontSizeInput?.addEventListener('blur', applyFontSize);
  fontSizeInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFontSize();
      event.target.blur();
    }
  });
  lineHeightInput?.addEventListener('blur', applyLineHeight);
  lineHeightInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLineHeight();
      event.target.blur();
    }
  });
  document.querySelectorAll('[data-cmd]').forEach((button) => {
    button.addEventListener('click', () => execCommand(button.dataset.cmd));
  });
  setupColorPalette('text-color-palette', ['#000000', '#1f2937', '#4b5563', '#2563eb', '#059669', '#d97706', '#b91c1c', '#7c3aed'], applyTextColor);
  setupColorPalette('highlight-color-palette', ['transparent', '#fde68a', '#fda4af', '#a5f3fc', '#bbf7d0', '#c7d2fe', '#fecdd3', '#facc15', '#fbcfe8'], applyHighlightColor);

  document.getElementById('insert-image-btn').addEventListener('click', () => document.getElementById('image-input').click());
  document.getElementById('insert-sound-btn').addEventListener('click', () => document.getElementById('audio-input').click());
  document.getElementById('insert-blank-btn').addEventListener('click', insertBlankfield);
  document.getElementById('insert-mcq-btn').addEventListener('click', insertMultipleChoice);

  const editorContent = document.getElementById('editor-content');
  editorContent?.addEventListener('keydown', (event) => {
    if (event.key === '^') {
      event.preventDefault();
      execCommand('superscript');
    }
    if (event.key === '_') {
      event.preventDefault();
      execCommand('subscript');
    }
  });

  document.getElementById('image-input').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) insertImage(file);
    event.target.value = '';
  });
  document.getElementById('audio-input').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const type = prompt('Enter "long" for audio with controls or "short" for short audio:', 'long');
      insertSound(file, type === 'short' ? 'short' : 'long');
    }
    event.target.value = '';
  });
}

function bindEditorActions() {
  document.getElementById('save-draft-btn').addEventListener('click', () => {
    saveDraftData('Draft saved successfully.').then(() => {
      window.location.href = 'index.html';
    });
  });
  document.getElementById('post-btn').addEventListener('click', () => {
    if (confirm('Posting will make this file visible in the reader. Continue?')) {
      postContent().then(() => {
        window.location.href = 'index.html';
      });
    }
  });
}

function setAuthOverlayVisible(visible) {
  const overlay = document.getElementById('auth-overlay');
  document.body.classList.toggle('auth-active', visible);
  if (overlay) {
    overlay.style.display = visible ? 'grid' : 'none';
    overlay.hidden = !visible;
    overlay.classList.toggle('hidden', !visible);
  }
}

function initFilePage() {
  const authenticated = sessionStorage.getItem('editorAuthenticated') === 'true';
  setAuthOverlayVisible(!authenticated);

  const submitButton = document.getElementById('auth-submit');
  const passwordInput = document.getElementById('editor-password');
  const authMessage = document.getElementById('auth-message');

  function authenticate() {
    if (!passwordInput) return;
    if (passwordInput.value === EDITOR_PASSWORD) {
      sessionStorage.setItem('editorAuthenticated', 'true');
      setAuthOverlayVisible(false);
      loadFilePage();
      if (authMessage) authMessage.textContent = '';
    } else if (authMessage) {
      authMessage.textContent = 'Incorrect password. Please try again.';
    }
  }

  if (submitButton) submitButton.addEventListener('click', authenticate);
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        authenticate();
      }
    });
  }

  if (authenticated) {
    loadFilePage();
  }
}

function loadFilePage() {
  bindEditorToolbar();
  bindEditorActions();
  loadEditorData().then((data) => {
    editorData = ContentStore.normalizeContent(data, false);
    if (!editorData.folders?.length) {
      editorData = DEFAULT_CONTENT;
    }
    renderEditorFileTree();

    const fileId = getQueryParam('file');
    const folderId = getQueryParam('folder');

    if (fileId) {
      const file = findNodeById(editorData.folders, fileId);
      if (!file) {
        alert('File does not exist. Returning to the editor.');
        window.location.href = 'index.html';
        return;
      }
      setCurrentFile(fileId);
      return;
    }

    if (folderId) {
      const folder = getFolderById(folderId);
      if (!folder) {
        alert('Folder does not exist. Returning to the editor.');
        window.location.href = 'index.html';
        return;
      }
      const fileName = prompt('New file name:', 'New file');
      if (!fileName) {
        window.location.href = 'index.html';
        return;
      }
      const file = createFileInFolder(folderId, fileName);
      if (!file) {
        alert('Could not create a new file.');
        window.location.href = 'index.html';
        return;
      }
      history.replaceState(null, '', `file.html?file=${encodeURIComponent(file.id)}`);
      setCurrentFile(file.id);
      return;
    }

    alert('No file or folder was specified.');
    window.location.href = 'index.html';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFilePage);
} else {
  initFilePage();
}
