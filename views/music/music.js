const listElement = document.querySelector("#music-list");
const countElement = document.querySelector("#music-count");
const emptyElement = document.querySelector("#music-empty");

function buildPlayerUrl(songId) {
    return `https://music.163.com/outchain/player?type=2&id=${songId}&auto=0&height=66`;
}

function createMusicCard(track) {
    const card = document.createElement("article");
    card.className = "music-card";

    const tagText = track.tag || "单曲";
    const noteText = track.note ? `<p class="music-note">${track.note}</p>` : "";

    card.innerHTML = `
        <div class="music-meta">
            <div>
                <span class="music-tag">${tagText}</span>
                <h3>${track.title}</h3>
                <p class="music-artist">${track.artist}</p>
                ${noteText}
            </div>
        </div>
        <div class="player-shell">
            <iframe
                frameborder="no"
                border="0"
                marginwidth="0"
                marginheight="0"
                width="330"
                height="86"
                loading="lazy"
                allow="autoplay"
                src="${buildPlayerUrl(track.songId)}"
                title="${track.title} - ${track.artist}"
            ></iframe>
        </div>
    `;

    return card;
}

function renderTracks(tracks) {
    listElement.innerHTML = "";

    if (!Array.isArray(tracks) || tracks.length === 0) {
        countElement.textContent = "0 首曲目";
        emptyElement.hidden = false;
        return;
    }

    emptyElement.hidden = true;
    countElement.textContent = `共 ${tracks.length} 首曲目`;

    const fragment = document.createDocumentFragment();
    tracks.forEach((track) => {
        fragment.appendChild(createMusicCard(track));
    });

    listElement.appendChild(fragment);
}

async function initializeMusicPage() {
    try {
        const response = await fetch("./music.json", { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Failed to load music.json: ${response.status}`);
        }

        const payload = await response.json();
        renderTracks(payload.tracks);
    } catch (error) {
        console.error(error);
        countElement.textContent = "加载失败";
        emptyElement.hidden = false;
        emptyElement.textContent = "歌单读取失败，请检查 music.json 是否可访问。";
    }
}

initializeMusicPage();