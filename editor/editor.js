const EDITOR_PASSWORD = 'NgTh@05102023';
const STORAGE_EDITOR_DRAFT = 'english-editor-draft';
const STORAGE_PUBLISHED = 'english-published-content';
const BASE_DATA_PATH = '../data/content.json';
const DEFAULT_CONTENT = {
  folders: [
    {
      id: 'vocabulary',
      type: 'folder',
      name: 'Vocabulary',
      children: []
    },
    {
      id: 'grammar',
      type: 'folder',
      name: 'Grammar',
      children: []
    }
  ]
};

let editorData = { folders: [] };
let currentFileId = null;
let selectedFolderId = null;
let selectedTreeId = null;

function generateId(prefix = 'id') {
  if (window.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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
  document.getElementById('publish-status').textContent = 'Published';
  document.getElementById('publish-status').classList.add('published');
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

function getSelectedFolder() {
  if (!selectedFolderId) return editorData.folders[0] || null;
  const node = findNodeById(editorData.folders, selectedFolderId);
  return node?.type === 'folder' ? node : null;
}

function setCurrentFile(fileId) {
  if (!fileId) {
    currentFileId = null;
    document.getElementById('current-file-name').textContent = 'Chưa chọn file';
    document.getElementById('editor-content').innerHTML = '';
    return;
  }
  saveCurrentFileContent();
  currentFileId = fileId;
  const file = findNodeById(editorData.folders, fileId);
  if (!file) return;
  document.getElementById('current-file-name').textContent = file.name;
  const content = file.content || '<p>Bắt đầu viết nội dung cho file này.</p>';
  document.getElementById('editor-content').innerHTML = content;
}

function saveCurrentFileContent() {
  if (!currentFileId) return;
  const file = findNodeById(editorData.folders, currentFileId);
  if (!file) return;
  const editor = document.getElementById('editor-content');
  if (editor) file.content = editor.innerHTML;
}

function createFolderNode(folder, parentId = null) {
  const template = document.getElementById('template-folder-item');
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = folder.id;
  node.dataset.parent = parentId || '';
  node.querySelector('.item-name').textContent = folder.name;
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    clearActiveItems();
    node.classList.add('active');
    selectedFolderId = folder.id;
    selectedTreeId = folder.id;
    const folderItems = node.querySelectorAll('.tree-item');
    folderItems.forEach((item) => item.classList.remove('active'));
    renderEditorTree();
  });

  const addChildBtn = node.querySelector('.add-child');
  addChildBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    selectedFolderId = folder.id;
    addNewFolder(true);
  });

  const deleteBtn = node.querySelector('.delete-item');
  if (!parentId) {
    deleteBtn.style.display = 'none';
  } else {
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      removeNode(folder.id);
    });
  }

  const children = document.createElement('div');
  children.className = 'tree-child-list';
  children.style.paddingLeft = '1.2rem';
  folder.children?.forEach((child) => {
    if (child.type === 'folder') children.appendChild(createFolderNode(child, folder.id));
    if (child.type === 'file') children.appendChild(createFileNode(child, folder.id));
  });
  node.appendChild(children);
  return node;
}

function createFileNode(file, parentId) {
  const template = document.getElementById('template-file-item-editor');
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = file.id;
  node.dataset.parent = parentId;
  node.querySelector('.item-name').textContent = file.name;
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    clearActiveItems();
    node.classList.add('active');
    selectedFolderId = parentId;
    selectedTreeId = file.id;
    setCurrentFile(file.id);
  });
  node.querySelector('.delete-item').addEventListener('click', (event) => {
    event.stopPropagation();
    removeNode(file.id);
  });
  return node;
}

function clearActiveItems() {
  document.querySelectorAll('.tree-item.active').forEach((item) => item.classList.remove('active'));
}

function renderEditorTree() {
  const container = document.getElementById('editor-tree');
  container.innerHTML = '';
  editorData.folders.forEach((folder) => container.appendChild(createFolderNode(folder)));
}

function removeNode(nodeId) {
  const parent = findParentForId(editorData.folders, nodeId);
  const list = parent ? parent.children : editorData.folders;
  const index = list.findIndex((item) => item.id === nodeId);
  if (index === -1) return;
  if (!parent && (nodeId === 'vocabulary' || nodeId === 'grammar')) {
    alert('Không thể xóa hai thư mục chính.');
    return;
  }
  if (!confirm('Xác nhận xóa mục này?')) return;
  list.splice(index, 1);
  if (currentFileId === nodeId || selectedTreeId === nodeId) {
    currentFileId = null;
    selectedTreeId = null;
    selectedFolderId = null;
    setCurrentFile(null);
  }
  renderEditorTree();
  saveDraftData('Đã cập nhật thư mục.');
}

function addNewFolder(isChild = false) {
  const folderName = prompt('Tên thư mục mới:');
  if (!folderName) return;
  const targetFolder = isChild ? getSelectedFolder() : getSelectedFolder();
  const newFolder = {
    id: generateId('folder'),
    type: 'folder',
    name: folderName,
    children: []
  };
  if (targetFolder) {
    targetFolder.children = targetFolder.children || [];
    targetFolder.children.push(newFolder);
  } else {
    editorData.folders.push(newFolder);
  }
  renderEditorTree();
  saveDraftData('Đã thêm thư mục mới.');
}

function addNewFile() {
  const fileName = prompt('Tên file mới:');
  if (!fileName) return;
  const targetFolder = getSelectedFolder();
  if (!targetFolder) {
    alert('Vui lòng chọn một thư mục để thêm file.');
    return;
  }
  const newFile = {
    id: generateId('file'),
    type: 'file',
    name: fileName,
    content: '<p>Viết nội dung tại đây...</p>'
  };
  targetFolder.children = targetFolder.children || [];
  targetFolder.children.push(newFile);
  renderEditorTree();
  saveDraftData('Đã thêm file mới.');
}

function execCommand(command, value = null) {
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
  const blankId = generateId('blank');
  const wrapper = document.createElement('span');
  wrapper.className = 'blankfield';
  wrapper.dataset.id = blankId;
  wrapper.innerHTML = `<span class="blank-line">____</span><span class="blank-answer" contenteditable="true" spellcheck="false">Answer</span>`;
  const range = window.getSelection().getRangeAt(0);
  range.insertNode(wrapper);
}

function insertMultipleChoice() {
  const mcqId = generateId('mcq');
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
  const value = document.getElementById('line-height').value;
  const range = window.getSelection().getRangeAt(0);
  if (!range || range.collapsed) return;
  const span = document.createElement('span');
  span.style.lineHeight = value;
  range.surroundContents(span);
}

function applyFontSize() {
  const size = document.getElementById('font-size').value;
  if (size < 10 || size > 64) return;
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
  document.getElementById('add-folder-btn').addEventListener('click', () => addNewFolder(true));
  document.getElementById('add-file-btn').addEventListener('click', addNewFile);
  document.getElementById('save-draft-btn').addEventListener('click', () => saveDraftData('Đã lưu draft thành công.'));
  document.getElementById('post-btn').addEventListener('click', () => {
    if (confirm('Đăng bài sẽ cho reader xem. Tiếp tục?')) postContent();
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

function initEditorPage() {
  const authenticated = sessionStorage.getItem('editorAuthenticated') === 'true';
  setAuthOverlayVisible(!authenticated);

  const submitButton = document.getElementById('auth-submit');
  const passwordInput = document.getElementById('editor-password');
  const authMessage = document.getElementById('auth-message');
  const authOverlay = document.getElementById('auth-overlay');

  function authenticate() {
    if (!passwordInput) return;
    if (passwordInput.value === EDITOR_PASSWORD) {
      sessionStorage.setItem('editorAuthenticated', 'true');
      setAuthOverlayVisible(false);
      loadEditorWorkspace();
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
    loadEditorWorkspace();
  }
}

function loadEditorWorkspace() {
  bindEditorToolbar();
  bindEditorActions();
  loadEditorData().then((data) => {
    editorData = data;
    if (!editorData.folders?.length) {
      editorData = {
        folders: [
          { id: 'vocabulary', type: 'folder', name: 'Vocabulary', children: [] },
          { id: 'grammar', type: 'folder', name: 'Grammar', children: [] }
        ]
      };
    }
    renderEditorTree();
    setCurrentFile(null);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditorPage);
} else {
  initEditorPage();
}
