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

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fetchBaseData() {
  return fetch(BASE_DATA_PATH)
    .then((res) => res.json())
    .catch(() => Promise.resolve(DEFAULT_CONTENT));
}

function loadEditorData() {
  const saved = localStorage.getItem(STORAGE_EDITOR_DRAFT);
  if (saved) {
    try {
      return Promise.resolve(JSON.parse(saved));
    } catch (err) {
      return fetchBaseData();
    }
  }
  return fetchBaseData();
}

function saveDraftData(message = 'Đã lưu draft') {
  saveCurrentFileContent();
  localStorage.setItem(STORAGE_EDITOR_DRAFT, JSON.stringify(editorData));
  showEditorMessage(message);
}

function postContent() {
  saveCurrentFileContent();
  localStorage.setItem(STORAGE_PUBLISHED, JSON.stringify(editorData));
  broadcastChannel.postMessage('published-updated');
  showEditorMessage('Nội dung đã được đăng. Reader có thể xem ngay.');
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
  treeNode.innerHTML = `<span class="item-icon">${icon}</span><span class="item-name">${node.name}</span>`;
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
    id: `file-${Math.random().toString(36).slice(2, 10)}`,
    type: 'file',
    name,
    content: '<p>Bắt đầu viết nội dung tại đây...</p>'
  };
  folder.children = folder.children || [];
  folder.children.push(file);
  saveDraftData('Đã tạo file mới.');
  return file;
}

function setCurrentFile(fileId) {
  currentFileId = fileId;
  currentFile = findNodeById(editorData.folders, fileId);
  const titleInput = document.getElementById('file-name-input');
  const content = document.getElementById('editor-content');
  if (!currentFile) return;
  if (titleInput) titleInput.value = currentFile.name || '';
  if (content) content.innerHTML = currentFile.content || '<p>Bắt đầu viết nội dung.</p>';
  renderEditorFileTree();
}

function saveCurrentFileContent() {
  if (!currentFile) return;
  const content = document.getElementById('editor-content');
  const titleInput = document.getElementById('file-name-input');
  if (titleInput) currentFile.name = titleInput.value || currentFile.name || 'New file';
  if (content) currentFile.content = content.innerHTML;
}

function execCommand(command, value = null) {
  restoreSelectionRange();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(command, false, value);
}

function insertImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = document.createElement('img');
    img.src = reader.result;
    img.className = 'image-block';
    img.alt = 'Hình ảnh';
    img.style.maxWidth = '100%';
    img.style.resize = 'both';
    img.style.overflow = 'auto';
    const range = window.getSelection().getRangeAt(0);
    range.insertNode(img);
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
      button.textContent = '🔊 Play âm thanh ngắn';
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
    <div><strong>Câu hỏi:</strong></div>
    <div contenteditable="true" class="mcq-question">Nhập câu hỏi tại đây...</div>
    <div class="mcq-row">
      <button type="button" class="muq-button selected" data-option="A">A</button>
      <button type="button" class="muq-button" data-option="B">B</button>
      <button type="button" class="muq-button" data-option="C">C</button>
      <button type="button" class="muq-button" data-option="D">D</button>
    </div>
    <div class="mcq-note">Click một lần để chọn đáp án đúng.</div>
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
  range.surroundContents(span);
}

function applyFontSize() {
  restoreSelectionRange();
  const size = parseInt(document.getElementById('font-size').value, 10);
  if (!size || size < 10 || size > 64) return;
  const range = window.getSelection().getRangeAt(0);
  if (!range || range.collapsed) return;
  const span = document.createElement('span');
  span.style.fontSize = `${size}px`;
  range.surroundContents(span);
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
  document.getElementById('font-size').addEventListener('change', applyFontSize);
  document.querySelectorAll('[data-cmd]').forEach((button) => {
    button.addEventListener('click', () => execCommand(button.dataset.cmd));
  });
  document.getElementById('text-color').addEventListener('change', (event) => applyTextColor(event.target.value));
  document.getElementById('highlight-color').addEventListener('change', (event) => applyHighlightColor(event.target.value));
  document.getElementById('line-height').addEventListener('change', applyLineHeight);

  document.getElementById('insert-image-btn').addEventListener('click', () => document.getElementById('image-input').click());
  document.getElementById('insert-sound-btn').addEventListener('click', () => document.getElementById('audio-input').click());
  document.getElementById('insert-blank-btn').addEventListener('click', insertBlankfield);
  document.getElementById('insert-mcq-btn').addEventListener('click', insertMultipleChoice);

  document.getElementById('image-input').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) insertImage(file);
    event.target.value = '';
  });
  document.getElementById('audio-input').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const type = prompt('Nhập "long" cho sound có tua hoặc "short" cho sound ngắn:', 'long');
      insertSound(file, type === 'short' ? 'short' : 'long');
    }
    event.target.value = '';
  });
}

function bindEditorActions() {
  document.getElementById('save-draft-btn').addEventListener('click', () => {
    saveDraftData('Đã lưu draft thành công.');
    window.location.href = 'index.html';
  });
  document.getElementById('post-btn').addEventListener('click', () => {
    if (confirm('Đăng bài sẽ cho reader xem. Tiếp tục?')) {
      postContent();
      window.location.href = 'index.html';
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
      authMessage.textContent = 'Mật khẩu không đúng. Vui lòng thử lại.';
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
    editorData = data;
    if (!editorData.folders?.length) {
      editorData = DEFAULT_CONTENT;
    }
    renderEditorFileTree();

    const fileId = getQueryParam('file');
    const folderId = getQueryParam('folder');

    if (fileId) {
      const file = findNodeById(editorData.folders, fileId);
      if (!file) {
        alert('File không tồn tại. Quay lại editor.');
        window.location.href = 'index.html';
        return;
      }
      setCurrentFile(fileId);
      return;
    }

    if (folderId) {
      const folder = getFolderById(folderId);
      if (!folder) {
        alert('Thư mục không tồn tại. Quay lại editor.');
        window.location.href = 'index.html';
        return;
      }
      const fileName = prompt('Tên file mới:', 'New file');
      if (!fileName) {
        window.location.href = 'index.html';
        return;
      }
      const file = createFileInFolder(folderId, fileName);
      if (!file) {
        alert('Không thể tạo file mới.');
        window.location.href = 'index.html';
        return;
      }
      history.replaceState(null, '', `file.html?file=${encodeURIComponent(file.id)}`);
      setCurrentFile(file.id);
      return;
    }

    alert('Không có file hoặc thư mục được chỉ định.');
    window.location.href = 'index.html';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFilePage);
} else {
  initFilePage();
}
