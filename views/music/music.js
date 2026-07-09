const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const tracks = ref([]);
        const loaded = ref(false);
        const error = ref('');

        function playerUrl(songId) {
            return `https://music.163.com/outchain/player?type=2&id=${songId}&auto=0&height=66`;
        }

        onMounted(async () => {
            try {
                const res = await fetch('./music.json', { cache: 'no-store' });
                if (!res.ok) throw new Error('加载失败');
                const data = await res.json();
                tracks.value = data.tracks || [];
            } catch (e) {
                error.value = '歌单读取失败，请检查 music.json 是否可访问。';
            } finally {
                loaded.value = true;
            }
        });

        return { tracks, loaded, error, playerUrl };
    }
}).mount('#app');
