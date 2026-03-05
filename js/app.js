// AgentHub - Main Application Logic
const AGENTS_PATH = 'agents/';
const SKILLS_PATH = 'skills/';

let agents = [];
let skills = [];
let currentAgent = null;
let currentSkill = null;
let currentTab = 'agents';

// Initialize the application
async function init() {
    initTheme();
    await Promise.all([loadAgents(), loadSkills()]);
    setupEventListeners();
    renderAgents(agents);
    handleDeepLink();
}

// Theme management
function initTheme() {
    const saved = localStorage.getItem('agenthub-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
    updateThemeIcon();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('agenthub-theme', next);
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const theme = document.documentElement.getAttribute('data-theme');
    btn.innerHTML = theme === 'light'
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
}

// Load agents from manifest or fallback
async function loadAgents() {
    try {
        const response = await fetch(AGENTS_PATH + 'index.json');
        if (response.ok) {
            agents = await response.json();
            return;
        }
    } catch (e) {
        // manifest not available, try dev fallback
    }
    await loadAgentsDevFallback();
}

// Dev fallback: scan for individual JSON files via directory listing
async function loadAgentsDevFallback() {
    try {
        const response = await fetch(AGENTS_PATH);
        if (!response.ok) return;
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href$=".json"]');

        agents = [];
        for (const link of links) {
            const filename = link.getAttribute('href');
            if (filename && filename !== '../' && filename !== 'index.json') {
                try {
                    const r = await fetch(AGENTS_PATH + filename);
                    const agent = await r.json();
                    agent._filename = filename;
                    agents.push(agent);
                } catch (e) {
                    console.warn(`Failed to load ${filename}:`, e);
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load agents:', error);
        agents = [];
    }
}

// Load skills from manifest
async function loadSkills() {
    try {
        const response = await fetch(SKILLS_PATH + 'index.json');
        if (response.ok) {
            skills = await response.json();
            return;
        }
    } catch (e) {
        // skills manifest not available
    }
    skills = [];
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('downloadBtn').addEventListener('click', downloadAgent);
    document.getElementById('copyBtn').addEventListener('click', copyAgentJson);
    document.getElementById('exportSkillBtn').addEventListener('click', exportSkillZip);

    // Modal close
    const modal = document.getElementById('agentModal');
    document.querySelector('.close-modal').addEventListener('click', () => modal.classList.remove('active'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Deep link on hash change
    window.addEventListener('hashchange', handleDeepLink);
}

// Tab switching
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('agentsGrid').style.display = tab === 'agents' ? '' : 'none';
    document.getElementById('skillsGrid').style.display = tab === 'skills' ? '' : 'none';

    const countEl = document.getElementById('agentCount');
    if (tab === 'agents') {
        countEl.textContent = `${agents.length} agent${agents.length !== 1 ? 's' : ''}`;
        renderAgents(agents);
    } else {
        countEl.textContent = `${skills.length} skill${skills.length !== 1 ? 's' : ''}`;
        renderSkills(skills);
    }
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('searchInput').value = '';
}

// Handle search input
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (currentTab === 'agents') {
        const filtered = query
            ? agents.filter(a =>
                (a.name || '').toLowerCase().includes(query) ||
                (a.description || '').toLowerCase().includes(query) ||
                (a.model || '').toLowerCase().includes(query) ||
                (a.system_prompt || '').toLowerCase().includes(query))
            : agents;
        renderAgents(filtered);
    } else {
        const filtered = query
            ? skills.filter(s =>
                (s.name || '').toLowerCase().includes(query) ||
                (s.title || '').toLowerCase().includes(query) ||
                (s.content || '').toLowerCase().includes(query))
            : skills;
        renderSkills(filtered);
    }
}

// Render agents to the grid
function renderAgents(agentsList) {
    const grid = document.getElementById('agentsGrid');
    const countEl = document.getElementById('agentCount');
    const noResults = document.getElementById('noResults');

    countEl.textContent = `${agentsList.length} agent${agentsList.length !== 1 ? 's' : ''}`;

    if (agentsList.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';
    grid.innerHTML = agentsList.map(agent => createAgentCard(agent)).join('');
    grid.querySelectorAll('.agent-card').forEach((card, index) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-download-btn')) {
                e.stopPropagation();
                currentAgent = agentsList[index];
                downloadAgent();
                return;
            }
            showAgentModal(agentsList[index]);
        });
    });
}

// Create an agent card HTML
function createAgentCard(agent) {
    const name = escapeHtml(agent.name || 'Unnamed Agent');
    const description = escapeHtml(agent.description || 'No description available');
    const model = escapeHtml(agent.model || 'N/A');

    const badges = [];
    if (agent.model) badges.push(`<span class="badge badge-model">${model}</span>`);
    if (agent.standalone_job) badges.push('<span class="badge badge-standalone">standalone</span>');
    if (agent.enable_planning) badges.push('<span class="badge badge-planning">planning</span>');
    if (agent.enable_reasoning) badges.push('<span class="badge badge-reasoning">reasoning</span>');
    if (agent.enable_kb) badges.push('<span class="badge badge-kb">knowledge base</span>');
    if (agent.enable_skills) badges.push('<span class="badge badge-skills">skills</span>');

    return `
        <div class="agent-card">
            <h3>${name}</h3>
            <div class="badges">${badges.join('')}</div>
            <p class="description">${description}</p>
            <button class="card-download-btn" title="Download Agent (.json)"><i class="fa-solid fa-download"></i></button>
        </div>
    `;
}

// Render skills to the grid
function renderSkills(skillsList) {
    const grid = document.getElementById('skillsGrid');
    const countEl = document.getElementById('agentCount');
    const noResults = document.getElementById('noResults');

    countEl.textContent = `${skillsList.length} skill${skillsList.length !== 1 ? 's' : ''}`;

    if (skillsList.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';
    grid.innerHTML = skillsList.map(skill => createSkillCard(skill)).join('');
    grid.querySelectorAll('.agent-card').forEach((card, index) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-download-btn')) {
                e.stopPropagation();
                currentSkill = skillsList[index];
                exportSkillZip();
                return;
            }
            showSkillModal(skillsList[index]);
        });
    });
}

// Create a skill card HTML
function createSkillCard(skill) {
    const title = escapeHtml(skill.title || skill.name);
    // Get a preview: strip markdown headings and take first ~200 chars
    const raw = (skill.content || '').replace(/^#+\s.*$/gm, '').replace(/\n{2,}/g, '\n').trim();
    const preview = escapeHtml(raw.substring(0, 200));

    return `
        <div class="agent-card skill-card">
            <h3><i class="fa-solid fa-wand-magic-sparkles" style="color: var(--color-accent); margin-right: 0.4rem;"></i>${title}</h3>
            <div class="badges">
                <span class="badge badge-skills">${escapeHtml(skill.name)}</span>
            </div>
            <p class="skill-preview">${preview}</p>
            <button class="card-download-btn" data-skill="${escapeHtml(skill.name)}" title="Download Skill (.zip)"><i class="fa-solid fa-download"></i></button>
        </div>
    `;
}

// Show agent details in modal
function showAgentModal(agent) {
    currentAgent = agent;

    const modal = document.getElementById('agentModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = agent.name || 'Unnamed Agent';

    const summary = createAgentSummary(agent);
    const json = JSON.stringify(agent, null, 2);

    body.innerHTML = `
        ${summary}
        <h3>Full Configuration</h3>
        <pre>${escapeHtml(json)}</pre>
    `;

    // Show agent buttons, hide skill button
    document.querySelector('.modal-actions').style.display = 'flex';
    document.getElementById('copyBtn').style.display = '';
    document.getElementById('downloadBtn').style.display = '';
    document.getElementById('exportSkillBtn').style.display = 'none';
    modal.classList.add('active');

    // Update URL hash
    if (agent.name) {
        history.replaceState(null, '', '#agent=' + encodeURIComponent(agent.name));
    }
}

// Show skill details in modal
function showSkillModal(skill) {
    currentAgent = null;
    currentSkill = skill;

    const modal = document.getElementById('agentModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = skill.title || skill.name;

    // Render markdown, stripping the first heading if it matches the title
    let content = skill.content || '';
    const titleText = skill.title || skill.name;
    content = content.replace(new RegExp('^#\\s+' + titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\n', 'm'), '');
    const html = typeof marked !== 'undefined'
        ? marked.parse(content)
        : '<pre>' + escapeHtml(content) + '</pre>';

    body.innerHTML = `<div class="skill-content">${html}</div>`;

    // Show only skill export button
    document.querySelector('.modal-actions').style.display = 'flex';
    document.getElementById('copyBtn').style.display = 'none';
    document.getElementById('downloadBtn').style.display = 'none';
    document.getElementById('exportSkillBtn').style.display = '';
    modal.classList.add('active');
}

// Create a summary of key agent properties
function createAgentSummary(agent) {
    const fields = [
        ['Name', agent.name],
        ['Model', agent.model],
        ['Description', agent.description],
        ['System Prompt', agent.system_prompt],
        ['Periodic Runs', agent.periodic_runs],
        ['Connectors', agent.connectors?.length || 0],
        ['Actions', agent.actions?.length || 0],
        ['MCP Servers', agent.mcp_servers?.length || 0],
        ['Skills', agent.enable_skills ? 'Enabled' : 'Disabled'],
        ['KB', agent.enable_kb ? 'Enabled' : 'Disabled'],
        ['Planning', agent.enable_planning ? 'Enabled' : 'Disabled'],
        ['Reasoning', agent.enable_reasoning ? 'Enabled' : 'Disabled'],
    ];

    const tableHtml = fields
        .filter(([, value]) => value !== undefined && value !== '' && value !== null)
        .map(([label, value]) => `
            <tr>
                <td><strong>${escapeHtml(label)}</strong></td>
                <td>${escapeHtml(String(value))}</td>
            </tr>
        `).join('');

    return `<table class="summary-table">${tableHtml}</table>`;
}

// Download agent JSON
function downloadAgent() {
    if (!currentAgent) return;

    const json = JSON.stringify(currentAgent, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = currentAgent._filename || `${currentAgent.name || 'agent'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Copy agent JSON to clipboard
function copyAgentJson() {
    if (!currentAgent) return;

    const json = JSON.stringify(currentAgent, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        const btn = document.getElementById('copyBtn');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
    });
}

// Export skill folder as zip
function exportSkillZip() {
    if (!currentSkill || typeof JSZip === 'undefined') return;

    const zip = new JSZip();
    const folder = zip.folder(currentSkill.name);
    folder.file('SKILL.md', currentSkill.content || '');

    zip.generateAsync({ type: 'blob' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentSkill.name + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// Deep link support: #agent=name
function handleDeepLink() {
    const hash = window.location.hash;
    if (!hash) return;

    const match = hash.match(/^#agent=(.+)$/);
    if (match) {
        const name = decodeURIComponent(match[1]);
        const agent = agents.find(a => a.name === name);
        if (agent) {
            switchTab('agents');
            showAgentModal(agent);
        }
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
