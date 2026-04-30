import MarkdownIt from 'https://esm.sh/markdown-it@14.1.0';
import markdownItAnchor from 'https://esm.sh/markdown-it-anchor@9.2.0';
import markdownItAttrs from 'https://esm.sh/markdown-it-attrs@4.3.1';
import markdownItContainer from 'https://esm.sh/markdown-it-container@4.0.0';
import markdownItFootnote from 'https://esm.sh/markdown-it-footnote@4.0.0';
import markdownItTaskLists from 'https://esm.sh/markdown-it-task-lists@2.1.1';
import DOMPurify from 'https://esm.sh/dompurify@3.2.4';
import hljs from 'https://esm.sh/highlight.js@11.11.1/lib/common';
import mermaid from 'https://esm.sh/mermaid@11.6.0';

const body = document.getElementById('markdown-body');
const sidebarNav = document.querySelector('.sidebar-nav');
const tocNav = document.getElementById('toc-nav');
const mobileSidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const viewerBaseUrl = new URL('./', location.href);

let currentDocPath = '';
let currentHeadingId = '';
let manifestItems = [];
let navLinksByPath = new Map();
let tocObserver = null;
let tocHeadings = [];

mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'default'
});

function slugifyHeading(text) {
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function preserveBlockMath(markdownSource) {
    const blocks = [];
    const protectedSource = markdownSource.replace(/\$\$([\s\S]*?)\$\$/g, match => {
        const token = `@@BLOCK_MATH_${blocks.length}@@`;
        blocks.push({ token, value: match.slice(2, -2).trim() });
        return token;
    });

    return { protectedSource, blocks };
}

function restoreBlockMath(renderedHtml, blocks) {
    let restoredHtml = renderedHtml;

    blocks.forEach(({ token, value }) => {
        const placeholder = `<div class="block-math" data-math="${encodeURIComponent(value)}"></div>`;
        restoredHtml = restoredHtml.replace(`<p>${token}</p>`, placeholder);
        restoredHtml = restoredHtml.replace(token, placeholder);
    });

    return restoredHtml;
}

function renderBlockMath() {
    if (!window.katex?.render) {
        return;
    }

    body.querySelectorAll('.block-math').forEach(node => {
        const expression = node.dataset.math ? decodeURIComponent(node.dataset.math) : '';
        window.katex.render(expression, node, {
            displayMode: true,
            throwOnError: false
        });
    });
}

function isExternalUrl(url) {
    return /^(?:[a-z]+:)?\/\//i.test(url) || /^(?:mailto:|tel:|data:)/i.test(url);
}

function isHashOnly(url) {
    return url.startsWith('#');
}

function splitHref(url) {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
        return { path: url, anchor: '' };
    }

    return {
        path: url.slice(0, hashIndex),
        anchor: decodeURIComponent(url.slice(hashIndex + 1))
    };
}

function buildDocumentUrl(docPath, heading = '') {
    return `?doc=${encodeURIComponent(docPath)}${heading ? `#${encodeURIComponent(heading)}` : ''}`;
}

function readLocationState() {
    const params = new URLSearchParams(location.search);
    return {
        doc: params.get('doc') || '',
        heading: decodeURIComponent(location.hash.slice(1))
    };
}

function normalizeDocPath(url) {
    const pathPart = splitHref(url).path.split('?')[0];
    if (!pathPart) {
        return currentDocPath;
    }

    if (pathPart.startsWith('docs/')) {
        return pathPart;
    }

    const absoluteUrl = new URL(pathPart, new URL(currentDocPath, viewerBaseUrl));
    if (absoluteUrl.origin !== viewerBaseUrl.origin) {
        return null;
    }

    const basePath = viewerBaseUrl.pathname;
    if (!absoluteUrl.pathname.startsWith(basePath)) {
        return null;
    }

    return decodeURIComponent(absoluteUrl.pathname.slice(basePath.length));
}

function resolveAssetUrl(url) {
    if (!url || isExternalUrl(url) || isHashOnly(url)) {
        return url;
    }

    if (url.startsWith('/')) {
        const previewPrefix = location.pathname.startsWith('/site-preview/') ? '/site-preview' : '';
        return new URL(`${previewPrefix}${url}`, location.origin).toString();
    }

    // Bare asset paths resolve to a mirrored folder under /assets/docs/<doc-path-without-ext>/.
    if (!/^(?:[./]|\/)/.test(url) && !url.startsWith('assets/') && !url.startsWith('docs/')) {
        const docRelativePath = currentDocPath.startsWith('docs/') ? currentDocPath.slice('docs/'.length) : currentDocPath;
        const docAssetFolder = docRelativePath.replace(/\.md$/i, '');

        if (docAssetFolder) {
            return new URL(`../../assets/docs/${docAssetFolder}/${url}`, viewerBaseUrl).toString();
        }
    }

    return new URL(url, new URL(currentDocPath, viewerBaseUrl)).toString();
}

function renderContainer(type, title) {
    return function containerRenderer(tokens, index) {
        const token = tokens[index];
        if (token.nesting === 1) {
            return `<div class="md-alert md-alert-${type}"><div class="md-alert-title">${title}</div>`;
        }

        return '</div>';
    };
}

const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code, language) {
        if (language === 'mermaid') {
            return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
        }

        if (language && hljs.getLanguage(language)) {
            return `<pre><code class="hljs language-${language}">${hljs.highlight(code, { language }).value}</code></pre>`;
        }

        return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
    }
})
    .use(markdownItFootnote)
    .use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true })
    .use(markdownItAttrs)
    .use(markdownItAnchor, {
        slugify: slugifyHeading,
        permalink: markdownItAnchor.permalink.linkInsideHeader({
            symbol: '#',
            placement: 'after',
            class: 'header-anchor',
            ariaHidden: true
        })
    })
    .use(markdownItContainer, 'note', { render: renderContainer('note', 'Note') })
    .use(markdownItContainer, 'tip', { render: renderContainer('tip', 'Tip') })
    .use(markdownItContainer, 'warning', { render: renderContainer('warning', 'Warning') })
    .use(markdownItContainer, 'danger', { render: renderContainer('danger', 'Danger') })
    .use(markdownItContainer, 'details', {
        render(tokens, index) {
            const token = tokens[index];
            if (token.nesting === 1) {
                const info = token.info.trim().slice('details'.length).trim() || 'Details';
                return `<details class="md-details"><summary>${escapeHtml(info)}</summary>`;
            }

            return '</details>';
        }
    });

const defaultLinkOpen = markdown.renderer.rules.link_open || function defaultLinkRender(tokens, index, options, env, self) {
    return self.renderToken(tokens, index, options);
};

markdown.renderer.rules.link_open = function linkOpen(tokens, index, options, env, self) {
    const token = tokens[index];
    const hrefIndex = token.attrIndex('href');

    if (hrefIndex >= 0) {
        const href = token.attrs[hrefIndex][1];
        const { anchor } = splitHref(href);

        if (!isExternalUrl(href) && !isHashOnly(href)) {
            const normalizedDocPath = normalizeDocPath(href);
            if (normalizedDocPath && normalizedDocPath.endsWith('.md')) {
                token.attrs[hrefIndex][1] = buildDocumentUrl(normalizedDocPath, anchor);
                token.attrSet('data-doc-link', normalizedDocPath);
                if (anchor) {
                    token.attrSet('data-doc-anchor', anchor);
                }
            } else {
                token.attrs[hrefIndex][1] = resolveAssetUrl(href);
            }
        } else if (isExternalUrl(href)) {
            token.attrSet('target', '_blank');
            token.attrSet('rel', 'noopener noreferrer');
        }
    }

    return defaultLinkOpen(tokens, index, options, env, self);
};

markdown.renderer.rules.image = function image(tokens, index, options, env, self) {
    const token = tokens[index];
    const srcIndex = token.attrIndex('src');
    if (srcIndex >= 0) {
        token.attrs[srcIndex][1] = resolveAssetUrl(token.attrs[srcIndex][1]);
    }

    return self.renderToken(tokens, index, options);
};

function renderNavTree(items, depth = 0) {
    const container = document.createElement('div');
    container.className = depth === 0 ? 'nav-tree' : 'nav-children';

    items.forEach(item => {
        if (item.type === 'dir') {
            const details = document.createElement('details');
            details.className = 'nav-folder';
            details.open = true;

            const summary = document.createElement('summary');
            summary.className = 'nav-folder-title';
            summary.textContent = item.title;

            details.appendChild(summary);
            details.appendChild(renderNavTree(item.children || [], depth + 1));
            container.appendChild(details);
            return;
        }

        const link = document.createElement('a');
        link.className = 'nav-link';
        link.href = buildDocumentUrl(item.path);
        link.textContent = item.title;
        link.dataset.doc = item.path;
        link.style.setProperty('--depth', String(depth));
        navLinksByPath.set(item.path, link);
        container.appendChild(link);
    });

    return container;
}

function renderSidebar(items) {
    navLinksByPath = new Map();
    sidebarNav.innerHTML = '';
    sidebarNav.appendChild(renderNavTree(items));
}

function findFirstDoc(items) {
    for (const item of items) {
        if (item.type === 'file') {
            return item.path;
        }

        if (item.type === 'dir') {
            const child = findFirstDoc(item.children || []);
            if (child) {
                return child;
            }
        }
    }

    return '';
}

function updateActiveNav(path) {
    navLinksByPath.forEach(link => link.classList.remove('active'));
    const activeLink = navLinksByPath.get(path);
    if (!activeLink) {
        return;
    }

    activeLink.classList.add('active');
    let parent = activeLink.parentElement;
    while (parent) {
        if (parent.tagName === 'DETAILS') {
            parent.open = true;
        }
        parent = parent.parentElement;
    }
}

function setActiveToc(headingId) {
    currentHeadingId = headingId || '';
    tocNav.querySelectorAll('.toc-link').forEach(link => {
        link.classList.toggle('active', link.dataset.heading === currentHeadingId);
    });
}

function extractHeadingText(heading) {
    const clone = heading.cloneNode(true);
    clone.querySelectorAll('.header-anchor').forEach(node => node.remove());
    return clone.textContent.trim();
}

function updateActiveTocFromScroll() {
    if (tocHeadings.length === 0) {
        return;
    }

    const offset = 140;
    let activeHeading = tocHeadings[0];

    for (const heading of tocHeadings) {
        if (heading.getBoundingClientRect().top - offset <= 0) {
            activeHeading = heading;
        } else {
            break;
        }
    }

    setActiveToc(activeHeading.id);
}

function buildToc() {
    if (tocObserver) {
        tocObserver.disconnect();
        tocObserver = null;
    }

    const headings = Array.from(body.querySelectorAll('h1[id], h2[id], h3[id]'));
    tocHeadings = headings;
    tocNav.innerHTML = '';

    if (headings.length === 0) {
        tocHeadings = [];
        tocNav.innerHTML = '<p class="toc-empty">当前页没有可用标题</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    headings.forEach(heading => {
        const link = document.createElement('a');
        link.className = `toc-link toc-level-${heading.tagName.slice(1)}`;
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.textContent = extractHeadingText(heading);
        link.dataset.heading = heading.id;
        fragment.appendChild(link);
    });

    tocNav.appendChild(fragment);
    updateActiveTocFromScroll();

    tocObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
            updateActiveTocFromScroll();
        }
    }, {
        rootMargin: '-96px 0px -68% 0px',
        threshold: [0, 1]
    });

    headings.forEach(heading => tocObserver.observe(heading));
}

function scrollToHeading(headingId, smooth = false) {
    if (!headingId) {
        window.scrollTo(0, 0);
        return;
    }

    const target = document.getElementById(headingId);
    if (!target) {
        window.scrollTo(0, 0);
        return;
    }

    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    setActiveToc(headingId);
}

async function enhanceRenderedContent(headingId) {
    renderBlockMath();

    if (typeof renderMathInElement === 'function') {
        renderMathInElement(body, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    }

    const mermaidBlocks = body.querySelectorAll('.mermaid');
    if (mermaidBlocks.length > 0) {
        await mermaid.run({ nodes: mermaidBlocks });
    }

    buildToc();
    scrollToHeading(headingId, false);
}

async function loadDoc(path, { heading = '', pushHistory = false, replaceHistory = false } = {}) {
    currentDocPath = path;
    body.innerHTML = '<p class="loading">加载中…</p>';
    updateActiveNav(path);

    try {
        const res = await fetch(path);
        if (!res.ok) {
            throw new Error('文件未找到');
        }

        const md = await res.text();
        const { protectedSource, blocks } = preserveBlockMath(md);
        const rendered = restoreBlockMath(markdown.render(protectedSource), blocks);
        body.innerHTML = DOMPurify.sanitize(rendered);
        await enhanceRenderedContent(heading);

        const method = replaceHistory ? 'replaceState' : 'pushState';
        if (replaceHistory || pushHistory) {
            history[method]({ doc: path, heading }, '', buildDocumentUrl(path, heading));
        }
    } catch (error) {
        body.innerHTML = '<p style="color:#e74c3c">⚠️ 无法加载文档：' + error.message + '</p>';
        tocNav.innerHTML = '<p class="toc-empty">当前页没有可用标题</p>';
    }
}

function toggleSidebar() {
    mobileSidebar.classList.toggle('open');
}

body.addEventListener('click', event => {
    const link = event.target.closest('a[data-doc-link]');
    if (!link) {
        return;
    }

    event.preventDefault();
    loadDoc(link.dataset.docLink, {
        heading: link.dataset.docAnchor || '',
        pushHistory: true
    });
});

sidebarNav.addEventListener('click', event => {
    const link = event.target.closest('a[data-doc]');
    if (!link) {
        return;
    }

    event.preventDefault();
    mobileSidebar.classList.remove('open');
    loadDoc(link.dataset.doc, { pushHistory: true });
});

tocNav.addEventListener('click', event => {
    const link = event.target.closest('a[data-heading]');
    if (!link) {
        return;
    }

    event.preventDefault();
    const headingId = link.dataset.heading;
    scrollToHeading(headingId, true);
    history.replaceState({ doc: currentDocPath, heading: headingId }, '', buildDocumentUrl(currentDocPath, headingId));
});

menuToggle.addEventListener('click', toggleSidebar);

async function loadManifest() {
    const response = await fetch('docs-manifest.json');
    if (!response.ok) {
        throw new Error('无法加载文档清单');
    }

    return response.json();
}

async function initializeDocs() {
    try {
        const manifest = await loadManifest();
        manifestItems = manifest.items || [];
        renderSidebar(manifestItems);

        const state = readLocationState();
        const initialDoc = state.doc || findFirstDoc(manifestItems);
        if (!initialDoc) {
            throw new Error('未找到可用文档');
        }

        await loadDoc(initialDoc, {
            heading: state.heading,
            replaceHistory: !state.doc
        });
    } catch (error) {
        sidebarNav.innerHTML = '<p class="loading">⚠️ 文档目录加载失败</p>';
        body.innerHTML = '<p style="color:#e74c3c">⚠️ 初始化文档站失败：' + error.message + '</p>';
        tocNav.innerHTML = '<p class="toc-empty">当前页没有可用标题</p>';
    }
}

window.addEventListener('popstate', async () => {
    const state = readLocationState();
    const fallbackDoc = findFirstDoc(manifestItems);
    if (state.doc || fallbackDoc) {
        await loadDoc(state.doc || fallbackDoc, { heading: state.heading });
    }
});

window.addEventListener('scroll', updateActiveTocFromScroll, { passive: true });

initializeDocs();