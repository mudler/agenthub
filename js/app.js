// AgentHub - Main Application Logic
const AGENTS_PATH = 'agents/';

let agents = [];
let currentAgent = null;

// Initialize the application
async function init() {
    await loadAgents();
    setupEventListeners();
    renderAgents(agents);
}

// Load all agent JSON files from the agents directory
async function loadAgents() {
    try {
        // Fetch the directory listing via GitHub API
        const response = await fetch(AGENTS_PATH);
        if (!response.ok) {
            console.warn('Using fallback agent loading');
            await loadAgentsFallback();
            return;
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href$=".json"]');
        
        agents = [];
        for (const link of links) {
            const filename = link.getAttribute('href');
            if (filename && filename !== '../') {
                try {
                    const agentResponse = await fetch(AGENTS_PATH + filename);
                    const agent = await agentResponse.json();
                    agent._filename = filename;
                    agents.push(agent);
                } catch (e) {
                    console.warn(`Failed to load ${filename}:`, e);
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load agents from directory, using fallback:', error);
        await loadAgentsFallback();
    }
}

// Fallback: Load agents via GitHub API
async function loadAgentsFallback() {
    try {
        const response = await fetch('https://api.github.com/repos/mudler/agenthub/contents/agents');
        if (!response.ok) {
            throw new Error('Failed to fetch agents directory');
        }
        
        const files = await response.json();
        agents = [];
        
        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const rawUrl = file.download_url;
                    const agentResponse = await fetch(rawUrl);
                    const agent = await agentResponse.json();
                    agent._filename = file.name;
                    agents.push(agent);
                } catch (e) {
                    console.warn(`Failed to load ${file.name}:`, e);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load agents:', error);
        agents = [];
    }
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearch);
    
    // Modal close
    const modal = document.getElementById('agentModal');
    const closeModal = document.querySelector('.close-modal');
    closeModal.addEventListener('click', () => modal.classList.remove('active'));
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadAgent);
}

// Handle search input
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        renderAgents(agents);
        return;
    }
    
    const filtered = agents.filter(agent => {
        const name = (agent.name || '').toLowerCase();
        const description = (agent.description || '').toLowerCase();
        const model = (agent.model || '').toLowerCase();
        const systemPrompt = (agent.system_prompt || '').toLowerCase();
        
        return name.includes(query) || 
               description.includes(query) || 
               model.includes(query) ||
               systemPrompt.includes(query);
    });
    
    renderAgents(filtered);
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
    
    // Add click listeners to cards
    grid.querySelectorAll('.agent-card').forEach((card, index) => {
        card.addEventListener('click', () => showAgentModal(agentsList[index]));
    });
}

// Create an agent card HTML
function createAgentCard(agent) {
    const name = escapeHtml(agent.name || 'Unnamed Agent');
    const description = escapeHtml(agent.description || 'No description available');
    const model = escapeHtml(agent.model || 'N/A');
    
    const details = [];
    if (agent.standalone_job) details.push('standalone');
    if (agent.enable_planning) details.push('planning');
    if (agent.enable_reasoning) details.push('reasoning');
    if (agent.enable_kb) details.push('KB enabled');
    if (agent.periodic_runs) details.push(`runs: ${agent.periodic_runs}`);
    
    return `
        <div class="agent-card">
            <h3>${name}</h3>
            <span class="model">${model}</span>
            <p class="description">${description}</p>
            <div class="details">
                ${details.map(d => `<span class="detail-item">• ${escapeHtml(d)}</span>`).join('')}
            </div>
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
    
    // Create a summary and the full JSON
    const summary = createAgentSummary(agent);
    const json = JSON.stringify(agent, null, 2);
    
    body.innerHTML = `
        ${summary}
        <h3>Full Configuration</h3>
        <pre>${escapeHtml(json)}</pre>
    `;
    
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
    
    return `
        <table class="summary-table">
            ${tableHtml}
        </table>
    `;
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
