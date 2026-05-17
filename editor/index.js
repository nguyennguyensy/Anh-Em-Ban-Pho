const EDITOR_PASSWORD = 'NgTh@05102023';
const STORAGE_EDITOR_DRAFT = 'english-editor-draft';
const BASE_DATA_PATH = '../data/content.json';
const DEFAULT_CONTENT = {
  folders: [
    { id: 'vocabulary', type: 'folder', name: 'Vocabulary', children: [] },
    { id: 'grammar', type: 'folder', name: 'Grammar', children: [] }
  ]
};

let editorData = { folders: [] };
let currentFolderId = null;

function fetchBaseData() {
  return ContentStore.loadContent({ basePath: '../' });
}

function loadEditorData() {
  return ContentStore.loadContent({ basePath: '../', editor: true });
}

async function saveDraftData(message = 'Draft saved.') {
  try {
    const result = await ContentStore.saveContent(editorData, { mode: 'draft' });
    editorData = result.data;
    showEditorMessage(result.universal ? result.message : `${message} ${result.message}`);
  } catch (error) {
    showEditorMessage(`Could not save: ${error.message}`);
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

function getSelectedFolder() {
  if (!currentFolderId) return editorData.folders[0] || null;
  const node = findNodeById(editorData.folders, currentFolderId);
  return node?.type === 'folder' ? node : null;
}

function setActiveFolderInTree() {
  document.querySelectorAll('#editor-tree .tree-item').forEach((item) => {
    if (item.dataset.id === currentFolderId) item.classList.add('active');
    else item.classList.remove('active');
  });
}

function createFolderNode(folder) {
  const node = document.createElement('div');
  node.className = 'tree-item folder-item';
  node.dataset.id = folder.id;
  node.innerHTML = `<span class="item-icon">📁</span><span class="item-name"></span>`;
  node.querySelector('.item-name').textContent = folder.name;
  node.addEventListener('click', () => {
    openEditorFolder(folder.id);
  });
  return node;
}

function renderEditorTree() {
  const container = document.getElementById('editor-tree');
  if (!container) return;
  container.innerHTML = '';
  editorData.folders.forEach((folder) => container.appendChild(createFolderNode(folder)));
  setActiveFolderInTree();
}

function renderEditorFolder(folder) {
  const content = document.getElementById('editor-folder-content');
  const title = document.getElementById('current-folder-name');
  if (!content || !title) return;
  title.textContent = folder ? folder.name : 'No folder selected';
  const parent = findParentForId(editorData.folders, folder?.id);
  const breadcrumbs = document.createElement('div');
  breadcrumbs.className = 'folder-breadcrumb';

  const rootButton = document.createElement('button');
  rootButton.type = 'button';
  rootButton.className = 'breadcrumb-link';
  rootButton.textContent = 'Root';
  rootButton.addEventListener('click', () => {
    if (editorData.folders.length) openEditorFolder(editorData.folders[0].id);
  });
  breadcrumbs.appendChild(rootButton);

  const chain = [];
  let ancestor = parent;
  while (ancestor) {
    chain.unshift(ancestor);
    ancestor = findParentForId(editorData.folders, ancestor.id);
  }
  chain.push(folder);
  chain.forEach((node) => {
    if (!node) return;
    const separator = document.createElement('span');
    separator.textContent = ' / ';
    breadcrumbs.appendChild(separator);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'breadcrumb-link';
    button.textContent = node.name;
    button.addEventListener('click', () => openEditorFolder(node.id));
    breadcrumbs.appendChild(button);
  });

  const list = document.createElement('div');
  list.className = 'browse-list';
  if (!folder || !folder.children || !folder.children.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'This folder is empty.';
    list.appendChild(empty);
  } else {
    folder.children.forEach((item) => {
      const entry = document.createElement('div');
      entry.className = 'browse-item';
      const left = document.createElement('div');
      left.className = 'browse-item-left';
      const icon = document.createElement('span');
      icon.className = 'item-icon';
      icon.textContent = item.type === 'folder' ? '📁' : '📄';
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name;
      left.append(icon, name);
      if (item.type === 'file') {
        const status = document.createElement('span');
        status.className = `status-tag ${item.status === 'published' ? 'published' : ''}`;
        status.textContent = item.status === 'published'
          ? (item.hasUnpublishedChanges ? 'Published + Draft' : 'Published')
          : 'Draft';
        left.appendChild(status);
      }
      entry.appendChild(left);
      const buttons = document.createElement('div');
      buttons.className = 'folder-item-actions';

      if (item.type === 'folder') {
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'secondary-button';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => openEditorFolder(item.id));
        buttons.appendChild(openBtn);
      } else {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'primary-button';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
          window.location.href = `file.html?file=${encodeURIComponent(item.id)}`;
        });
        buttons.appendChild(editBtn);
      }

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'secondary-button';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        renameNode(item.id);
      });
      buttons.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'tiny-button';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeNode(item.id);
      });
      buttons.appendChild(deleteBtn);
      entry.appendChild(buttons);
      list.appendChild(entry);
    });
  }

  content.innerHTML = '';
  content.append(breadcrumbs, list);
}

function openEditorFolder(folderId) {
  currentFolderId = folderId;
  const folder = findNodeById(editorData.folders, folderId);
  renderEditorTree();
  renderEditorFolder(folder);
}

function addNewFolder() {
  const folderName = prompt('New folder name:');
  if (!folderName) return;
  const targetFolder = getSelectedFolder();
  const newFolder = {
    id: ContentStore.makeId('folder'),
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
  saveDraftData('New folder added.');
  renderEditorTree();
  if (targetFolder) openEditorFolder(targetFolder.id);
}

function addNewFile() {
  const target = getSelectedFolder();
  if (!target) {
    alert('Please select a folder before adding a file.');
    return;
  }
  window.location.href = `file.html?folder=${encodeURIComponent(target.id)}`;
}

function removeNode(nodeId) {
  const parent = findParentForId(editorData.folders, nodeId);
  const list = parent ? parent.children : editorData.folders;
  const index = list.findIndex((item) => item.id === nodeId);
  if (index === -1) return;
  if (!parent && (nodeId === 'vocabulary' || nodeId === 'grammar')) {
    alert('The two main folders cannot be deleted.');
    return;
  }
  if (!confirm('Delete this item?')) return;
  list.splice(index, 1);
  saveDraftData('Item deleted.');
  const current = getSelectedFolder();
  if (!current || current.id === nodeId) {
    currentFolderId = editorData.folders[0]?.id || null;
  }
  renderEditorTree();
  if (currentFolderId) openEditorFolder(currentFolderId);
}

function renameNode(nodeId) {
  const node = findNodeById(editorData.folders, nodeId);
  if (!node) return;
  const nextName = prompt('New name:', node.name);
  if (!nextName || nextName.trim() === node.name) return;
  node.name = nextName.trim();
  if (node.type === 'file') node.updatedAt = ContentStore.nowIso();
  saveDraftData('Renamed.');
  renderEditorTree();
  if (currentFolderId) openEditorFolder(currentFolderId);
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

  function authenticate() {
    if (!passwordInput) return;
    if (passwordInput.value === EDITOR_PASSWORD) {
      sessionStorage.setItem('editorAuthenticated', 'true');
      setAuthOverlayVisible(false);
      loadEditorWorkspace();
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
    loadEditorWorkspace();
  }
}

function loadEditorWorkspace() {
  document.getElementById('add-folder-btn')?.addEventListener('click', addNewFolder);
  document.getElementById('add-file-btn')?.addEventListener('click', addNewFile);
  document.getElementById('go-back-btn')?.addEventListener('click', () => {
    const parent = findParentForId(editorData.folders, currentFolderId);
    if (parent) openEditorFolder(parent.id);
    else if (editorData.folders.length) openEditorFolder(editorData.folders[0].id);
  });

  loadEditorData().then((data) => {
    editorData = ContentStore.normalizeContent(data, false);
    if (!editorData.folders?.length) {
      editorData = DEFAULT_CONTENT;
    }
    renderEditorTree();
    currentFolderId = currentFolderId || editorData.folders[0]?.id;
    if (currentFolderId) openEditorFolder(currentFolderId);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditorPage);
} else {
  initEditorPage();
}
