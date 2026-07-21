import MarkdownIt from 'https://esm.sh/markdown-it@14.1.0';
import markdownItAnchor from 'https://esm.sh/markdown-it-anchor@9.2.0';
import markdownItAttrs from 'https://esm.sh/markdown-it-attrs@4.3.1';
import markdownItContainer from 'https://esm.sh/markdown-it-container@4.0.0';
import markdownItFootnote from 'https://esm.sh/markdown-it-footnote@4.0.0';
import markdownItTaskLists from 'https://esm.sh/markdown-it-task-lists@2.1.1';
import DOMPurify from 'https://esm.sh/dompurify@3.2.4';
import hljs from 'https://esm.sh/highlight.js@11.11.1/lib/common';
import mermaid from 'https://esm.sh/mermaid@11.6.0';

const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted, provide, inject } = Vue;

mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'default'
});

// ── 工具函数 ──

function slugifyHeading(text) {
    return String(text).trim().toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function preserveBlockMath(md) {
    const blocks = [];
    const src = md.replace(/\$\$([\s\S]*?)\$\$/g, match => {
        const token = `@@BLOCK_MATH_${blocks.length}@@`;
        blocks.push({ token, value: match.slice(2, -2).trim() });
        return token;
    });
    return { src, blocks };
}

function restoreBlockMath(html, blocks) {
    let out = html;
    blocks.forEach(({ token, value }) => {
        const ph = `<div class="block-math" data-math="${encodeURIComponent(value)}"></div>`;
        out = out.replace(`<p>${token}</p>`, ph).replace(token, ph);
    });
    return out;
}

function isExternalUrl(url) {
    return /^(?:[a-z]+:)?\/\//i.test(url) || /^(?:mailto:|tel:|data:)/i.test(url);
}

function splitHref(url) {
    const i = url.indexOf('#');
    return i === -1 ? { path: url, anchor: '' } : { path: url.slice(0, i), anchor: decodeURIComponent(url.slice(i + 1)) };
}

function buildDocumentUrl(docPath, heading = '') {
    return `?doc=${encodeURIComponent(docPath)}${heading ? `#${encodeURIComponent(heading)}` : ''}`;
}

function readLocationState() {
    const p = new URLSearchParams(location.search);
    return { doc: p.get('doc') || '', heading: decodeURIComponent(location.hash.slice(1)) };
}

function isHashOnly(url) { return url.startsWith('#'); }

// ── Markdown-it 配置 ──

let currentDocPath = '';
const viewerBaseUrl = new URL('./', location.href);

function normalizeDocPath(url) {
    const pathPart = splitHref(url).path.split('?')[0];
    if (!pathPart) return currentDocPath;
    if (pathPart.startsWith('docs/')) return pathPart;
    const abs = new URL(pathPart, new URL(currentDocPath, viewerBaseUrl));
    if (abs.origin !== viewerBaseUrl.origin) return null;
    const base = viewerBaseUrl.pathname;
    if (!abs.pathname.startsWith(base)) return null;
    return decodeURIComponent(abs.pathname.slice(base.length));
}

function resolveAssetUrl(url) {
    if (!url || isExternalUrl(url) || isHashOnly(url)) return url;
    if (url.startsWith('/')) {
        const prefix = location.pathname.startsWith('/site-preview/') ? '/site-preview' : '';
        return new URL(`${prefix}${url}`, location.origin).toString();
    }
    if (!/^(?:[./]|\/)/.test(url) && !url.startsWith('assets/') && !url.startsWith('docs/')) {
        const rel = currentDocPath.startsWith('docs/') ? currentDocPath.slice('docs/'.length) : currentDocPath;
        const folder = rel.replace(/\.md$/i, '');
        if (folder) return new URL(`../../assets/docs/${folder}/${url}`, viewerBaseUrl).toString();
    }
    return new URL(url, new URL(currentDocPath, viewerBaseUrl)).toString();
}

function renderContainer(type, title) {
    return function (tokens, index) {
        const t = tokens[index];
        return t.nesting === 1
            ? `<div class="md-alert md-alert-${type}"><div class="md-alert-title">${title}</div>`
            : '</div>';
    };
}

const markdown = new MarkdownIt({
    html: true, linkify: true, typographer: true, breaks: false,
    highlight(code, lang) {
        if (lang === 'mermaid') return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
        if (lang && hljs.getLanguage(lang)) return `<pre><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
        return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
    }
})
    .use(markdownItFootnote)
    .use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true })
    .use(markdownItAttrs)
    .use(markdownItAnchor, {
        slugify: slugifyHeading,
        permalink: markdownItAnchor.permalink.linkInsideHeader({ symbol: '#', placement: 'after', class: 'header-anchor', ariaHidden: true })
    })
    .use(markdownItContainer, 'note', { render: renderContainer('note', 'Note') })
    .use(markdownItContainer, 'tip', { render: renderContainer('tip', 'Tip') })
    .use(markdownItContainer, 'warning', { render: renderContainer('warning', 'Warning') })
    .use(markdownItContainer, 'danger', { render: renderContainer('danger', 'Danger') })
    .use(markdownItContainer, 'details', {
        render(tokens, index) {
            const t = tokens[index];
            return t.nesting === 1
                ? `<details class="md-details"><summary>${escapeHtml(t.info.trim().slice('details'.length).trim() || 'Details')}</summary>`
                : '</details>';
        }
    });

const defaultLinkOpen = markdown.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));

markdown.renderer.rules.link_open = function (tokens, index, options, env, self) {
    const token = tokens[index];
    const hi = token.attrIndex('href');
    if (hi >= 0) {
        const href = token.attrs[hi][1];
        const { anchor } = splitHref(href);
        if (!isExternalUrl(href) && !isHashOnly(href)) {
            const norm = normalizeDocPath(href);
            if (norm && norm.endsWith('.md')) {
                token.attrs[hi][1] = buildDocumentUrl(norm, anchor);
                token.attrSet('data-doc-link', norm);
                if (anchor) token.attrSet('data-doc-anchor', anchor);
            } else {
                token.attrs[hi][1] = resolveAssetUrl(href);
            }
        } else if (isExternalUrl(href)) {
            token.attrSet('target', '_blank');
            token.attrSet('rel', 'noopener noreferrer');
        }
    }
    return defaultLinkOpen(tokens, index, options, env, self);
};

markdown.renderer.rules.image = function (tokens, index, options, env, self) {
    const token = tokens[index];
    const si = token.attrIndex('src');
    if (si >= 0) token.attrs[si][1] = resolveAssetUrl(token.attrs[si][1]);
    return self.renderToken(tokens, index, options);
};

// ── Vue 应用 ──

const app = createApp({
    setup() {
        const manifestItems = ref([]);
        const manifestLoaded = ref(false);
        const searchQuery = ref('');
        const currentDocPathRef = ref('');
        const currentHeadingId = ref('');
        const collapsed = ref(false);
        const mobileOpen = ref(false);
        const docHtml = ref('<p class="loading">加载中…</p>');
        const tocItems = ref([]);
        const loaded = ref(false);
        let tocObserver = null;
        let tocHeadings = [];

        const filteredNav = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return manifestItems.value;
            return filterTree(manifestItems.value, q);
        });

        function filterTree(items, q) {
            return items.reduce((acc, item) => {
                if (item.type === 'dir') {
                    const children = filterTree(item.children || [], q);
                    if (children.length > 0) acc.push({ ...item, children });
                } else {
                    const text = [item.title, item.path].join(' ').toLowerCase();
                    if (text.includes(q)) acc.push(item);
                }
                return acc;
            }, []);
        }

        async function loadDoc(path, { heading = '', pushHistory = false, replaceHistory = false } = {}) {
            currentDocPath = path;
            currentDocPathRef.value = path;
            docHtml.value = '<p class="loading">加载中…</p>';
            mobileOpen.value = false;

            try {
                const res = await fetch(path);
                if (!res.ok) throw new Error('文件未找到');
                const md = await res.text();

                let rendered;
                try {
                    const { src, blocks } = preserveBlockMath(md);
                    rendered = restoreBlockMath(markdown.render(src), blocks);
                } catch (e) {
                    console.error('Markdown render error:', e);
                    throw e;
                }

                try {
                    docHtml.value = DOMPurify.sanitize(rendered);
                } catch (e) {
                    console.error('DOMPurify error:', e);
                    docHtml.value = rendered;
                }

                loaded.value = true;
                await nextTick();
                enhanceRenderedContent(heading);

                const method = replaceHistory ? 'replaceState' : 'pushState';
                if (replaceHistory || pushHistory) {
                    history[method]({ doc: path, heading }, '', buildDocumentUrl(path, heading));
                }
            } catch (e) {
                console.error('loadDoc full error:', e);
                docHtml.value = '<p style="color:#e74c3c">⚠️ 无法加载文档：' + e.message + '</p>';
                tocItems.value = [];
            }
        }

        function enhanceRenderedContent(headingId) {
            const body = document.getElementById('markdown-body');
            if (!body) return;
            body.querySelectorAll('.block-math').forEach(node => {
                const expr = node.dataset.math ? decodeURIComponent(node.dataset.math) : '';
                if (window.katex?.render) window.katex.render(expr, node, { displayMode: true, throwOnError: false });
            });
            try {
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
            } catch (e) { console.warn('KaTeX render error:', e); }
            try {
                const mermaidBlocks = body.querySelectorAll('.mermaid');
                if (mermaidBlocks.length > 0) mermaid.run({ nodes: mermaidBlocks });
            } catch (e) { console.warn('Mermaid render error:', e); }
            buildToc();
            scrollToHeading(headingId, false);
        }

        function buildToc() {
            if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
            const body = document.getElementById('markdown-body');
            const headings = Array.from(body.querySelectorAll('h1[id], h2[id], h3[id], h4[id]'));
            tocHeadings = headings;
            if (headings.length === 0) { tocItems.value = []; return; }
            tocItems.value = headings.map(h => ({ id: h.id, text: extractHeadingText(h), level: h.tagName.slice(1) }));
            tocObserver = new IntersectionObserver(entries => {
                if (entries.some(e => e.isIntersecting)) updateActiveTocFromScroll();
            }, { rootMargin: '-96px 0px -68% 0px', threshold: [0, 1] });
            headings.forEach(h => tocObserver.observe(h));
            updateActiveTocFromScroll();
        }

        function extractHeadingText(heading) {
            const clone = heading.cloneNode(true);
            clone.querySelectorAll('.header-anchor').forEach(n => n.remove());
            return clone.textContent.trim();
        }

        function updateActiveTocFromScroll() {
            if (tocHeadings.length === 0) return;
            let active = tocHeadings[0];
            for (const h of tocHeadings) {
                if (h.getBoundingClientRect().top - 140 <= 0) active = h; else break;
            }
            currentHeadingId.value = active.id;
        }

        function scrollToHeading(id, smooth = false) {
            if (!id) { window.scrollTo(0, 0); return; }
            const el = document.getElementById(id);
            if (!el) { window.scrollTo(0, 0); return; }
            el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
            currentHeadingId.value = id;
            history.replaceState({ doc: currentDocPath, heading: id }, '', buildDocumentUrl(currentDocPath, id));
        }

        function findFirstDoc(items) {
            for (const item of items) {
                if (item.type === 'file') return item.path;
                if (item.type === 'dir') { const c = findFirstDoc(item.children || []); if (c) return c; }
            }
            return '';
        }

        // 通过 provide 传递给子组件
        provide('navigateTo', (path) => loadDoc(path, { pushHistory: true }));

        onMounted(async () => {
            collapsed.value = localStorage.getItem('documentSidebarCollapsed') === '1';
            watch(collapsed, v => {
                document.body.classList.toggle('sidebar-collapsed', v);
                localStorage.setItem('documentSidebarCollapsed', v ? '1' : '0');
            });
            document.body.classList.toggle('sidebar-collapsed', collapsed.value);

            const keyHandler = e => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    const input = document.getElementById('doc-search');
                    input.focus(); input.select();
                }
            };
            window.addEventListener('keydown', keyHandler);
            onUnmounted(() => window.removeEventListener('keydown', keyHandler));

            window.addEventListener('scroll', updateActiveTocFromScroll, { passive: true });
            onUnmounted(() => window.removeEventListener('scroll', updateActiveTocFromScroll));

            const popHandler = async () => {
                const state = readLocationState();
                const fallback = findFirstDoc(manifestItems.value);
                if (state.doc || fallback) await loadDoc(state.doc || fallback, { heading: state.heading });
            };
            window.addEventListener('popstate', popHandler);
            onUnmounted(() => window.removeEventListener('popstate', popHandler));

            // 文档内容链接点击（事件委托）
            document.getElementById('markdown-body').addEventListener('click', e => {
                const link = e.target.closest('a[data-doc-link]');
                if (!link) return;
                e.preventDefault();
                loadDoc(link.dataset.docLink, { heading: link.dataset.docAnchor || '', pushHistory: true });
            });

            try {
                const res = await fetch('docs-manifest.json');
                if (!res.ok) throw new Error('无法加载文档清单');
                const manifest = await res.json();
                manifestItems.value = manifest.items || [];
                manifestLoaded.value = true;

                const state = readLocationState();
                const initial = state.doc || findFirstDoc(manifestItems.value);
                if (!initial) throw new Error('未找到可用文档');
                await loadDoc(initial, { heading: state.heading, replaceHistory: !state.doc });
            } catch (e) {
                manifestLoaded.value = true;
                docHtml.value = '<p style="color:#e74c3c">⚠️ ' + e.message + '</p>';
            }
        });

        return {
            manifestItems, manifestLoaded, searchQuery, currentDocPath: currentDocPathRef,
            currentHeadingId, collapsed, mobileOpen, docHtml, tocItems, loaded,
            filteredNav, loadDoc, scrollToHeading
        };
    }
});

// ── 递归组件：侧边栏目录树 ──

app.component('nav-tree', {
    props: ['items', 'depth', 'currentDoc'],
    setup() {
        const navigateTo = inject('navigateTo');
        function buildUrl(path) { return buildDocumentUrl(path); }
        function navigate(path) { navigateTo(path); }
        return { buildUrl, navigate };
    },
    template: `
        <div :class="depth === 0 ? 'nav-tree' : 'nav-children'">
            <template v-for="item in items" :key="item.path || item.title">
                <details v-if="item.type === 'dir'" class="nav-folder" open>
                    <summary class="nav-folder-title">{{ item.title }}</summary>
                    <nav-tree :items="item.children || []" :depth="depth + 1" :current-doc="currentDoc" />
                </details>
                <a v-else
                   class="nav-link"
                   :class="{ active: item.path === currentDoc }"
                   :href="buildUrl(item.path)"
                   :style="{ '--depth': depth }"
                   @click.prevent="navigate(item.path)">
                    {{ item.title }}
                </a>
            </template>
        </div>
    `
});

app.mount('#app');
