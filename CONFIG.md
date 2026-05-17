# Site Config

Edit `site-config.js` directly before pushing to GitHub Pages.

```js
window.GITHUB_OWNER = "your-github-username";
window.GITHUB_REPO = "your-repo-name";
window.GITHUB_BRANCH = "main";
window.CONTENT_DATA_PATH = "data/content.json";
```

Do not put a GitHub token in this file.

The reader only loads `data/content.json`.

The editor asks for a GitHub fine-grained token when you click `Save Draft` or `Post`. The token needs:

- Repository access: this repo only
- Permissions: `Contents: Read and write`

The token is stored only in `sessionStorage` for the current browser session.
