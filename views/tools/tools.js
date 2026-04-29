const listElement = document.querySelector("#tool-list");
const countElement = document.querySelector("#tool-count");
const emptyElement = document.querySelector("#tool-empty");

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function createToolCard(tool) {
    const article = document.createElement("article");
    article.className = "tool-card";

    const tags = Array.isArray(tool.tags)
        ? tool.tags.map((tag) => `<span class="tool-tag">${escapeHtml(tag)}</span>`).join("")
        : "";

    const target = tool.external ? "_blank" : "_self";
    const rel = tool.external ? ' rel="noopener noreferrer"' : "";

    article.innerHTML = `
        <div class="tool-head">
            <div>
                <span class="tool-kind">${escapeHtml(tool.kind || "工具")}</span>
                <h3>${escapeHtml(tool.title)}</h3>
            </div>
        </div>
        <p class="tool-description">${escapeHtml(tool.description || "")}</p>
        <div class="tool-tags">${tags}</div>
        <a class="tool-link" href="${escapeHtml(tool.href)}" target="${target}"${rel}>${escapeHtml(tool.actionText || "打开工具")}</a>
    `;

    return article;
}

function renderTools(tools) {
    listElement.innerHTML = "";

    if (!Array.isArray(tools) || tools.length === 0) {
        countElement.textContent = "0 个工具";
        emptyElement.hidden = false;
        return;
    }

    emptyElement.hidden = true;
    countElement.textContent = `共 ${tools.length} 个工具`;

    const fragment = document.createDocumentFragment();
    tools.forEach((tool) => {
        fragment.appendChild(createToolCard(tool));
    });

    listElement.appendChild(fragment);
}

async function initializeToolsPage() {
    try {
        const response = await fetch("./tools.json", { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Failed to load tools.json: ${response.status}`);
        }

        const payload = await response.json();
        renderTools(payload.tools);
    } catch (error) {
        console.error(error);
        countElement.textContent = "加载失败";
        emptyElement.hidden = false;
        emptyElement.textContent = "工具列表读取失败，请检查 tools.json 是否可访问。";
    }
}

initializeToolsPage();