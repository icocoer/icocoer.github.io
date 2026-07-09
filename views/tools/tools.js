const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const tools = ref([]);
        const loaded = ref(false);
        const error = ref('');

        onMounted(async () => {
            try {
                const res = await fetch('./tools.json', { cache: 'no-store' });
                if (!res.ok) throw new Error('加载失败');
                const data = await res.json();
                tools.value = data.tools || [];
            } catch (e) {
                error.value = '工具列表读取失败，请检查 tools.json 是否可访问。';
            } finally {
                loaded.value = true;
            }
        });

        return { tools, loaded, error };
    }
}).mount('#app');
