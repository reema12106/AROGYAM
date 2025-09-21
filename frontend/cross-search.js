// Cross-Mapping Search Page JS
const API_BASE = "http://127.0.0.1:5000";

async function apiGet(endpoint, params = {}, token = null) {
    const url = new URL(API_BASE + endpoint, window.location.origin);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const options = { method: "GET", headers: { "Content-Type": "application/json", ...(token && { "Authorization": `Bearer ${token}` }) } };
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`GET ${endpoint} failed: ${response.status} ${response.statusText}`);
    return await response.json();
}

async function searchAllMappings(query) {
    // Try NAMASTE search first
    let namasteBundle = null, icd11Bundle = null;
    try {
        namasteBundle = await apiGet("/api/search/conditions", { q: query, limit: 10 });
    } catch {}
    try {
        icd11Bundle = await apiGet("/api/search/icd11", { q: query, limit: 10 });
    } catch {}
    return { namasteBundle, icd11Bundle };
}

function groupCodings(codings) {
    const grouped = {};
    codings.forEach(coding => {
        let label = 'Other';
        if (coding.system && coding.system.includes('namaste')) label = 'NAMASTE';
        else if (coding.system && coding.system.includes('icd')) label = 'ICD-11';
        else if (coding.system && coding.system.toLowerCase().includes('tm2')) label = 'TM2';
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(coding);
    });
    return grouped;
}

function renderResults({ namasteBundle, icd11Bundle }) {
    const resultsDiv = document.getElementById('cross-search-results');
    resultsDiv.innerHTML = '';
    let found = false;
    [namasteBundle, icd11Bundle].forEach(bundle => {
        if (bundle && bundle.entry && bundle.entry.length > 0) {
            found = true;
            bundle.entry.forEach((entry, idx) => {
                if (entry.resource && entry.resource.resourceType === 'Condition') {
                    const resource = entry.resource;
                    let html = `<div class='bundle-entry'><div><span class='label'>#${idx + 1}</span> <b>${resource.code.coding[0]?.display || ''}</b></div>`;
                    const grouped = groupCodings(resource.code.coding || []);
                    Object.keys(grouped).forEach(label => {
                        html += `<div class='coding-group'><span class='label'>${label}:</span>`;
                        grouped[label].forEach(coding => {
                            html += `<div class='coding-item'>${coding.code || ''} <span style='color:#888;'>${coding.display || ''}</span> <span style='font-size:0.9em;'>[${coding.system || ''}]</span></div>`;
                        });
                        html += `</div>`;
                    });
                    html += `</div>`;
                    resultsDiv.innerHTML += html;
                }
            });
        }
    });
    if (!found) resultsDiv.innerHTML = `<div class='no-results'>No results found for this query.</div>`;
}

document.getElementById('cross-search-form').addEventListener('submit', async function() {
    const query = document.getElementById('cross-search-query').value.trim();
    if (!query) return;
    document.getElementById('cross-search-results').innerHTML = '<em>Searching...</em>';
    try {
        const results = await searchAllMappings(query);
        renderResults(results);
    } catch (e) {
        document.getElementById('cross-search-results').innerHTML = `<span class='no-results'>Error: ${e.message}</span>`;
    }
});
