const ContentStore = (() => {
  const LOCAL_DRAFT_KEY = 'english-editor-draft';
  const LOCAL_PUBLISHED_KEY = 'english-published-content';
  const SESSION_GITHUB_TOKEN_KEY = 'english-github-write-token';
  const DEFAULT_DATA_PATH = 'data/content.json';
  const GITHUB_API = 'https://api.github.com';
  const DEFAULT_CONTENT = {
    version: 2,
    updatedAt: null,
    folders: [
      { id: 'vocabulary', type: 'folder', name: 'Vocabulary', children: [] },
      { id: 'grammar', type: 'folder', name: 'Grammar', children: [] }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getGithubConfig() {
    return {
      owner: window.GITHUB_OWNER || '',
      repo: window.GITHUB_REPO || '',
      branch: window.GITHUB_BRANCH || 'main',
      path: window.CONTENT_DATA_PATH || DEFAULT_DATA_PATH
    };
  }

  function getDataPath(basePath = '') {
    const configured = window.CONTENT_DATA_PATH || DEFAULT_DATA_PATH;
    const isAbsolute = /^https?:\/\//.test(configured) || configured.startsWith('/');
    const path = isAbsolute || !basePath ? configured : `${basePath}${configured}`;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}t=${Date.now()}`;
  }

  function getGithubToken() {
    const existing = sessionStorage.getItem(SESSION_GITHUB_TOKEN_KEY);
    if (existing) return existing;

    const token = window.prompt('Nhập GitHub token có quyền Contents: Read and write cho repo này:') || '';
    if (token) sessionStorage.setItem(SESSION_GITHUB_TOKEN_KEY, token);
    return token;
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function decodeBase64Utf8(value) {
    const binary = atob(value.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function normalizeNode(node, publishedFallback = true) {
    const clean = {
      id: node.id || makeId(node.type || 'item'),
      type: node.type === 'folder' ? 'folder' : 'file',
      name: node.name || (node.type === 'folder' ? 'Untitled folder' : 'Untitled file')
    };

    if (clean.type === 'folder') {
      clean.children = Array.isArray(node.children)
        ? node.children.map((child) => normalizeNode(child, publishedFallback))
        : [];
      return clean;
    }

    clean.status = node.status || (publishedFallback ? 'published' : 'draft');
    clean.content = node.content || '';
    clean.publishedContent = node.publishedContent || (clean.status === 'published' ? clean.content : '');
    clean.hasUnpublishedChanges = Boolean(node.hasUnpublishedChanges);
    clean.createdAt = node.createdAt || nowIso();
    clean.updatedAt = node.updatedAt || clean.createdAt;
    clean.assets = Array.isArray(node.assets) ? node.assets : [];
    return clean;
  }

  function normalizeContent(data, publishedFallback = true) {
    const source = data && Array.isArray(data.folders) ? data : DEFAULT_CONTENT;
    return {
      version: source.version || 2,
      updatedAt: source.updatedAt || nowIso(),
      folders: source.folders.map((folder) => normalizeNode(folder, publishedFallback))
    };
  }

  function readLocalDraft() {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    try {
      return normalizeContent(JSON.parse(raw), false);
    } catch (error) {
      return null;
    }
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  async function githubRequest(path, token, options = {}) {
    return fetchJson(`${GITHUB_API}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
  }

  async function getGithubContentFile(config, token) {
    const path = encodeURIComponent(config.path).replace(/%2F/g, '/');
    return githubRequest(
      `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`,
      token
    );
  }

  async function commitContentToGithub(content, mode) {
    const config = getGithubConfig();
    if (!config.owner || !config.repo || !config.path) {
      throw new Error('Thiếu GITHUB_OWNER, GITHUB_REPO hoặc CONTENT_DATA_PATH trong site-config.js.');
    }

    const token = getGithubToken();
    if (!token) throw new Error('Chưa nhập GitHub token.');

    const current = await getGithubContentFile(config, token);
    const message = mode === 'publish'
      ? 'Publish content from editor'
      : 'Save editor draft content';
    const path = encodeURIComponent(config.path).replace(/%2F/g, '/');

    await githubRequest(`/repos/${config.owner}/${config.repo}/contents/${path}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: encodeBase64Utf8(JSON.stringify(content, null, 2)),
        sha: current.sha,
        branch: config.branch
      })
    });
  }

  async function loadContent({ basePath = '', editor = false } = {}) {
    const localDraft = editor ? readLocalDraft() : null;

    try {
      const remote = normalizeContent(await fetchJson(getDataPath(basePath)), !editor);
      if (localDraft && new Date(localDraft.updatedAt) > new Date(remote.updatedAt)) {
        return localDraft;
      }
      return remote;
    } catch (error) {
      if (localDraft) return localDraft;
      return clone(DEFAULT_CONTENT);
    }
  }

  async function saveContent(data, { mode = 'draft' } = {}) {
    const normalized = normalizeContent(data, false);
    normalized.updatedAt = nowIso();
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(normalized));
    localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(filterPublished(normalized)));

    try {
      await commitContentToGithub(normalized, mode);
    } catch (error) {
      return {
        universal: false,
        data: normalized,
        message: `Đã lưu local, chưa commit GitHub: ${error.message}`
      };
    }

    return {
      universal: true,
      data: normalized,
      message: mode === 'publish' ? 'Đã post và commit GitHub.' : 'Đã lưu draft và commit GitHub.'
    };
  }

  function filterPublished(data) {
    function filterNode(node) {
      if (node.type === 'folder') {
        const children = (node.children || []).map(filterNode).filter(Boolean);
        return { ...node, children };
      }
      if (node.status !== 'published') return null;
      return {
        ...node,
        content: node.publishedContent || node.content || ''
      };
    }

    return {
      ...data,
      folders: (data.folders || []).map(filterNode).filter(Boolean)
    };
  }

  return {
    makeId,
    nowIso,
    loadContent,
    saveContent,
    filterPublished,
    normalizeContent
  };
})();
