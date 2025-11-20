async function fetchVersions() {
    try {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/'; // 代理服务器
        const apiUrl = 'https://bmclapi2.bangbang93.com/mc/game/version_manifest.json';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
        console.log(data);
        displayVersions(data.versions);
    } catch (error) {
        console.error('获取版本信息失败:', error);
    }
}

function displayVersions(versions) {
    const versionsContainer = document.getElementById('versions');
    console.log(versions);
    versionsContainer.innerHTML = versions
        .map(version => `<p>${version.id} - ${version.type}</p>`)
        .join('');
}

fetchVersions();
displayVersions([]);