const STORAGE_PUBLISHED = 'english-published-content';
const STORAGE_READER_RESPONSES = 'english-reader-responses';
const BASE_DATA_PATH = 'data/content.json';
const DEFAULT_CONTENT = {
  folders: [
    {
      id: 'vocabulary',
      type: 'folder',
      name: 'Vocabulary',
      children: [
        {
          id: 'vocab-1',
          type: 'file',
          name: 'Words: Family',
          content: '<h2>Family Vocabulary</h2><p>Learn the basic family words: father, mother, brother, sister.</p>'
        }
      ]
    },
    {
      id: 'grammar',
      type: 'folder',
      name: 'Grammar',
      children: [
        {
          id: 'grammar-1',
          type: 'file',
          name: 'Present Simple',
          content: '<h2>Present Simple</h2><p>Use the present simple tense to talk about habits and routines.</p>'
        }
      ]
    }
  ]
};

const broadcastChannel = new BroadcastChannel('english-app-sync');


function fetchBaseData() {
  return ContentStore.loadContent();
}

function parsePublishedData(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function getPublishedData() {
  return fetchBaseData().then((data) => ContentStore.filterPublished(data));
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
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

function findFolderPath(id, nodes, path = []) {
  for (const node of nodes) {
    if (node.id === id) return [...path, node];
    if (node.type === 'folder' && node.children) {
      const result = findFolderPath(id, node.children, [...path, node]);
      if (result) return result;
    }
  }
  return null;
}

function buildReaderTree(container, data) {
  container.innerHTML = '';
  data.folders.forEach((folder) => {
    const folderNode = document.createElement('div');
    folderNode.className = 'tree-item folder-item';
    folderNode.innerHTML = `<span class="item-icon">📁</span><span class="item-name"></span>`;
    folderNode.querySelector('.item-name').textContent = folder.name;
    folderNode.addEventListener('click', () => renderReaderFolder(folder, data));
    container.appendChild(folderNode);
  });
  const rootFolder = { id: 'root', name: 'Root', children: data.folders, type: 'folder' };
  renderReaderFolder(rootFolder, data);
}

function buildViewerTree(container, data, currentFileId) {
  container.innerHTML = '';

  function createTree(node, parentEl) {
    if (node.type === 'folder') {
      const folderNode = document.createElement('div');
      folderNode.className = 'tree-item folder-item';
      folderNode.innerHTML = `<span class="item-icon">📁</span><span class="item-name"></span>`;
      folderNode.querySelector('.item-name').textContent = node.name;
      parentEl.appendChild(folderNode);
      const childList = document.createElement('div');
      childList.style.paddingLeft = '1rem';
      childList.style.display = 'block';
      node.children?.forEach((child) => createTree(child, childList));
      parentEl.appendChild(childList);
      return;
    }

    const fileNode = document.createElement('div');
    fileNode.className = 'tree-item file-item';
    fileNode.dataset.id = node.id;
    fileNode.innerHTML = `
      <span class="item-icon">📄</span>
      <span class="item-name"></span>
      <button type="button" class="secondary-button">View</button>
    `;
    fileNode.querySelector('.item-name').textContent = node.name;
    const button = fileNode.querySelector('button');
    button.addEventListener('click', () => {
      if (window.location.pathname.endsWith('viewer.html')) {
        window.location.href = `viewer.html?file=${encodeURIComponent(node.id)}`;
      }
    });
    if (node.id === currentFileId) fileNode.classList.add('active');
    parentEl.appendChild(fileNode);
  }

  data.folders.forEach((folder) => createTree(folder, container));
}

function renderReaderFolder(folder, data) {
  const content = document.getElementById('reader-folder-content');
  if (!content) return;
  const path = folder.id === 'root' ? [] : findFolderPath(folder.id, data.folders) || [];
  const breadcrumbs = document.createElement('div');
  breadcrumbs.className = 'folder-breadcrumb';
  const rootLink = document.createElement('button');
  rootLink.type = 'button';
  rootLink.className = 'breadcrumb-link';
  rootLink.textContent = 'Root';
  rootLink.addEventListener('click', () => renderReaderFolder({ id: 'root', name: 'Root', children: data.folders, type: 'folder' }, data));
  breadcrumbs.appendChild(rootLink);
  path.forEach((node) => {
    const separator = document.createElement('span');
    separator.textContent = ' / ';
    breadcrumbs.appendChild(separator);
    const nodeButton = document.createElement('button');
    nodeButton.type = 'button';
    nodeButton.className = 'breadcrumb-link';
    nodeButton.textContent = node.name;
    nodeButton.addEventListener('click', () => renderReaderFolder(node, data));
    breadcrumbs.appendChild(nodeButton);
  });

  const list = document.createElement('div');
  list.className = 'browse-list';
  if (!folder.children || !folder.children.length) {
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
      entry.appendChild(left);
      if (item.type === 'folder') {
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'secondary-button';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => renderReaderFolder(item, data));
        entry.appendChild(openBtn);
      } else {
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'primary-button';
        openBtn.textContent = 'View';
        openBtn.addEventListener('click', () => {
          window.location.href = `viewer.html?file=${encodeURIComponent(item.id)}`;
        });
        entry.appendChild(openBtn);
      }
      list.appendChild(entry);
    });
  }

  content.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'folder-view-title';
  title.innerHTML = `<strong>${folder.name}</strong>`;
  content.append(breadcrumbs, title, list);
}

function renderReaderContent(html, fileId = 'reader') {
  const target = document.getElementById('reader-content');
  if (!target) return;
  target.innerHTML = html || '<p>This file has no content yet.</p>';
  target.querySelectorAll('[contenteditable]').forEach((element) => element.removeAttribute('contenteditable'));
  enhanceReaderInteractions(target, fileId);
}

function initViewerPage() {
  const content = document.getElementById('viewer-content');
  const tree = document.getElementById('viewer-tree');
  if (!content) return;
  const fileName = document.getElementById('viewer-file-name');
  const fileId = getQueryParam('file');
  if (!fileId) {
    content.innerHTML = '<p>File not found.</p>';
    return;
  }
  getPublishedData().then((data) => {
    if (tree) buildViewerTree(tree, data, fileId);
    const file = findNodeById(data.folders, fileId);
    if (!file) {
      content.innerHTML = '<p>This file does not exist or has not been posted yet.</p>';
      return;
    }
    if (fileName) fileName.textContent = file.name || 'Untitled file';
    content.innerHTML = file.content || '<p>This file has no content yet.</p>';
    content.querySelectorAll('[contenteditable]').forEach((element) => element.removeAttribute('contenteditable'));
    enhanceReaderInteractions(content, file.id);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'primary-button';
    resetBtn.textContent = 'Reset answers';
    resetBtn.style.marginTop = '2rem';
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(`${STORAGE_READER_RESPONSES}:${file.id}`);
      window.location.reload();
    });
    content.appendChild(resetBtn);
  });
}

function enhanceReaderInteractions(root, fileId = 'reader') {
  const responseKey = `${STORAGE_READER_RESPONSES}:${fileId}`;
  const responses = JSON.parse(localStorage.getItem(responseKey) || '{}');

  function normalizeStoredResponse(stored) {
    if (!stored) return null;
    if (typeof stored === 'string') return { value: stored, revealed: false };
    return {
      value: stored.value || '',
      revealed: Boolean(stored.revealed)
    };
  }

  function saveResponse(questionId, value, revealed = false) {
    responses[questionId] = { value, revealed };
    localStorage.setItem(responseKey, JSON.stringify(responses));
  }

  root.querySelectorAll('.blankfield').forEach((blank) => {
    const answerNode = blank.querySelector('.blank-answer');
    const correctValue = answerNode ? answerNode.textContent.trim() : '';
    const questionId = blank.dataset.id || `blank-${Math.random().toString(36).slice(2)}`;
    blank.dataset.id = questionId;
    if (answerNode) answerNode.style.display = 'none';
    const placeholder = document.createElement('div');
    placeholder.className = 'reader-interaction';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'reader-blank-input';
    const stored = normalizeStoredResponse(responses[questionId]);
    input.placeholder = 'Enter your answer...';
    input.value = stored?.value || '';
    input.disabled = Boolean(stored);
    const checkBtn = document.createElement('button');
    checkBtn.className = 'secondary-button';
    checkBtn.textContent = 'Check';
    const feedback = document.createElement('div');
    feedback.className = 'reader-feedback';

    checkBtn.addEventListener('click', () => {
      const saved = normalizeStoredResponse(responses[questionId]);
      if (saved) {
        const wasCorrect = saved.value.trim().toLowerCase() === correctValue.toLowerCase();
        if (!wasCorrect && !saved.revealed) {
          saveResponse(questionId, saved.value, true);
          feedback.textContent = `Answer: ${correctValue}`;
          feedback.className = 'reader-feedback wrong';
          checkBtn.disabled = true;
        }
        return;
      }
      const value = input.value.trim();
      const isCorrect = value.toLowerCase() === correctValue.toLowerCase();
      saveResponse(questionId, value, false);
      feedback.textContent = isCorrect ? 'Right' : 'Wrong';
      feedback.className = isCorrect ? 'reader-feedback correct' : 'reader-feedback wrong';
      input.disabled = true;
      checkBtn.textContent = isCorrect ? 'Check' : 'See answer';
      checkBtn.disabled = isCorrect;
    });

    if (stored) {
      const value = stored.value;
      const isCorrect = value.toLowerCase() === correctValue.toLowerCase();
      feedback.textContent = stored.revealed && !isCorrect ? `Answer: ${correctValue}` : (isCorrect ? 'Right' : 'Wrong');
      feedback.className = isCorrect ? 'reader-feedback correct' : 'reader-feedback wrong';
      checkBtn.textContent = isCorrect || stored.revealed ? 'Check' : 'See answer';
      checkBtn.disabled = isCorrect || stored.revealed;
    }

    placeholder.append(input, checkBtn, feedback);
    blank.after(placeholder);
    blank.style.display = 'inline-flex';
    blank.style.alignItems = 'center';
  });

  root.querySelectorAll('.multiple-choice').forEach((mcq) => {
    const correct = mcq.dataset.correct || '';
    const questionId = mcq.dataset.id || `mcq-${Math.random().toString(36).slice(2)}`;
    mcq.dataset.id = questionId;
    mcq.classList.add('reader-mcq');
    const buttonNodes = Array.from(mcq.querySelectorAll('button')).filter((btn) => btn.dataset.option);
    const feedback = document.createElement('div');
    feedback.className = 'reader-feedback';
    const controls = document.createElement('div');
    controls.className = 'reader-check';
    const checkBtn = document.createElement('button');
    checkBtn.className = 'secondary-button';
    checkBtn.textContent = 'Check';
    controls.append(checkBtn, feedback);

    const questionNode = mcq.querySelector('.mcq-question');
    if (questionNode && questionNode.parentNode) {
      const header = document.createElement('div');
      header.className = 'reader-mcq-header';
      questionNode.parentNode.insertBefore(header, questionNode);
      header.appendChild(questionNode);
      header.appendChild(controls);
    } else {
      const firstRow = mcq.querySelector('.mcq-row');
      mcq.insertBefore(controls, firstRow || mcq.firstChild);
    }

    buttonNodes.forEach((button) => {
      button.addEventListener('click', () => {
        if (normalizeStoredResponse(responses[questionId])) return;
        buttonNodes.forEach((btn) => btn.classList.remove('selected'));
        button.classList.add('selected');
      });
    });

    checkBtn.addEventListener('click', () => {
      const saved = normalizeStoredResponse(responses[questionId]);
      if (saved) {
        const wasCorrect = saved.value === correct;
        if (!wasCorrect && !saved.revealed) {
          saveResponse(questionId, saved.value, true);
          feedback.textContent = `Answer: ${correct}`;
          feedback.className = 'reader-feedback wrong';
          checkBtn.disabled = true;
        }
        return;
      }
      const selectedBtn = buttonNodes.find(btn => btn.classList.contains('selected'));
      if (!selectedBtn) return;
      const selected = selectedBtn.dataset.option;
      const isCorrect = selected === correct;
      saveResponse(questionId, selected, false);
      feedback.textContent = isCorrect ? 'Right' : 'Wrong';
      feedback.className = isCorrect ? 'reader-feedback correct' : 'reader-feedback wrong';
      buttonNodes.forEach(btn => btn.disabled = true);
      checkBtn.textContent = isCorrect ? 'Check' : 'See answer';
      checkBtn.disabled = isCorrect;
    });

    const stored = normalizeStoredResponse(responses[questionId]);
    if (stored) {
      buttonNodes.forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.option === stored.value);
        btn.disabled = true;
      });
      const isCorrect = stored.value === correct;
      feedback.textContent = stored.revealed && !isCorrect ? `Answer: ${correct}` : (isCorrect ? 'Right' : 'Wrong');
      feedback.className = isCorrect ? 'reader-feedback correct' : 'reader-feedback wrong';
      checkBtn.textContent = isCorrect || stored.revealed ? 'Check' : 'See answer';
      checkBtn.disabled = isCorrect || stored.revealed;
    }
  });
}

function initReaderPage() {
  const treeContainer = document.getElementById('reader-tree');
  if (!treeContainer) return;
  getPublishedData().then((data) => buildReaderTree(treeContainer, data));
}

function refreshPublishedViews() {
  if (document.getElementById('reader-tree')) initReaderPage();
  if (document.getElementById('viewer-content')) initViewerPage();
}

broadcastChannel.onmessage = (event) => {
  if (event.data === 'published-updated') {
    refreshPublishedViews();
  }
};

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_PUBLISHED) {
    refreshPublishedViews();
  }
});

window.addEventListener('focus', () => {
  refreshPublishedViews();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initReaderPage();
    initViewerPage();
  });
} else {
  initReaderPage();
  initViewerPage();
}
