document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('file-list');
    const searchInput = document.getElementById('search');

    let tools = [];

    // Fetch Tools from API
    async function fetchTools() {
        try {
            const res = await fetch('/api/tools');
            if (!res.ok) throw new Error('API_ERROR');
            tools = await res.json();
            renderTools();
        } catch (err) {
            console.error('Failed to load tools:', err);
            list.innerHTML = '<div style="color:red; font-family:monospace; padding:10px;">> ERROR: CONNECTION_REFUSED (IS SERVER RUNNING?)</div>';
        }
    }

    // Render Function
    function renderTools(filterText = '') {
        list.innerHTML = ''; // Clear list

        const filteredTools = tools.filter(tool => {
            const query = filterText.toLowerCase();
            return tool.title.toLowerCase().includes(query) ||
                tool.description.toLowerCase().includes(query) ||
                (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(query)));
        });

        if (filteredTools.length === 0) {
            list.innerHTML = '<div style="padding: 10px; color: #444;">> NOMATCH_FOUND</div>';
            return;
        }

        filteredTools.forEach(tool => {
            const row = document.createElement('a');
            row.className = 'row';
            row.href = tool.path;

            // Generate pseudo-random "permissions" string for flavor
            const perms = "-rwxr-xr-x";

            row.innerHTML = `
                <div class="id">${perms}</div>
                <div class="title-wrap">
                    <span class="title">${tool.title.toUpperCase()}</span>
                    <span class="desc" style="display:block; font-size:10px; color:#555;">${tool.description}</span>
                </div>
                <div class="meta">${tool.date}</div>
            `;

            list.appendChild(row);
        });
    }

    // Initial Load
    await fetchTools();

    // Auto-focus search
    searchInput.focus();

    // Search Listener
    searchInput.addEventListener('input', (e) => {
        renderTools(e.target.value);
    });
});
