// ========== API CLIENT LOGIC (INTEGRATED) ========== //
const API_BASE = "http://127.0.0.1:5000";

async function apiGet(endpoint, params = {}, token = null) {
    try {
        const url = new URL(API_BASE + endpoint, window.location.origin);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            }
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`GET ${endpoint} failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function apiPost(endpoint, body = {}, token = null) {
    try {
        const url = API_BASE + endpoint;
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            },
            body: JSON.stringify(body)
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`POST ${endpoint} failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function searchConditions(query, limit = 10, page = 1, patientId = null, token = null) {
    return apiGet("/search/conditions", { q: query, limit, page, patient_id: patientId }, token);
}
async function getMappingProfile(namasteCode, patientId = null, token = null) {
    return apiGet(`/mapping-profile/${namasteCode}`, { patient_id: patientId }, token);
}
async function searchICD11(query, mappingType = "", limit = 10, patientId = null, token = null) {
    return apiGet("/search/icd11", { q: query, mapping_type: mappingType, limit, patient_id: patientId }, token);
}
// API Base URL - points to your Flask backend


// Current authentication state
let isAuthenticated = false;
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('userData') || 'null');

// DOM Elements
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const loginLink = document.getElementById('login-link');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
    if (!isAuthenticated) {
        // Hide all pages except login
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById('login-page').classList.add('active');
        // Optionally, hide nav links except login
        navLinks.forEach(link => {
            if (link.getAttribute('data-page') !== 'login') {
                link.style.display = 'none';
            } else {
                link.style.display = '';
            }
        });
    } else {
        setupNavigation();
        setupTabs();
        checkSystemStatus();
    }
});

// Check if user is already logged in
function checkExistingLogin() {
    if (authToken && currentUser) {
        isAuthenticated = true;
        updateLoginUI();
        console.log('User already logged in:', currentUser);
    }
}

// Setup navigation
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            
            if (page === 'logout') {
                logout();
                showPage('home');
            } else {
                showPage(page);
            }
        });
    });
}

// Setup tabs
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Show specific page
function showPage(pageId) {
    if (!isAuthenticated && pageId !== 'login') {
        // Force login if not authenticated
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById('login-page').classList.add('active');
        navLinks.forEach(link => {
            if (link.getAttribute('data-page') !== 'login') {
                link.style.display = 'none';
            } else {
                link.style.display = '';
            }
        });
        return;
    }
    pages.forEach(page => {
        page.classList.remove('active');
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(`${pageId}-page`).classList.add('active');
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
}

// Update UI based on login state
function updateLoginUI() {
    if (isAuthenticated && currentUser) {
        loginLink.textContent = 'Logout';
        loginLink.setAttribute('data-page', 'logout');
    } else {
        loginLink.textContent = 'Login';
        loginLink.setAttribute('data-page', 'login');
    }
}

// Check system status
async function checkSystemStatus() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        const statusElement = document.getElementById('system-status');
        if (data.status === 'healthy') {
            statusElement.innerHTML = `
                <p style="color: var(--secondary);">✅ Backend is connected and healthy</p>
                <p>Server time: ${new Date(data.timestamp).toLocaleString()}</p>
            `;
        } else {
            statusElement.innerHTML = `<p style="color: var(--danger);">❌ Backend connection issue</p>`;
        }
    } catch (error) {
        document.getElementById('system-status').innerHTML = `
            <p style="color: var(--warning);">⚠️ Could not connect to backend</p>
            <p>Error: ${error.message}</p>
            <p>Make sure your backend server is running on port 5000</p>
        `;
    }
}


// Perform search using integrated API client logic
async function performSearch() {
    const query = document.getElementById('search-query').value;
    const searchType = document.getElementById('search-type').value;
    if (!query || query.length < 2) {
        alert('Please enter at least 2 characters to search');
        return;
    }
    showLoader('search-results');
    try {
        // Always show all search endpoint results
        let [namasteBundle, icd11Bundle] = await Promise.all([
            searchConditions(query, 10, 1, null, authToken),
            searchICD11(query, '', 10, null, authToken)
        ]);
        let mappingProfile = null;
        // Only call mapping-profile if query is a likely NAMASTE code
        if (isLikelyNamasteCode(query)) {
            try {
                mappingProfile = await getMappingProfile(query, null, authToken);
            } catch (err) {
                console.error('Mapping profile fetch failed:', err);
            }
        }
        displayAllSearchResults({ namasteBundle, icd11Bundle, mappingProfile });
    } catch (error) {
        console.error('❌ Search error:', error);
        alert('Search failed: ' + error.message);
// Helper to check if a string is likely a NAMASTE code (e.g., starts with 'N' and is numeric)
function isLikelyNamasteCode(str) {
    return /^N\d+$/i.test(str);
}
        const searchResults = document.getElementById('search-results');
        if (searchResults) searchResults.classList.add('hidden');
    }
}

// Display all search endpoint results in the web page
function displayAllSearchResults({ namasteBundle, icd11Bundle, mappingProfile }) {
    console.log('🔎 NAMASTE Bundle:', namasteBundle);
    console.log('🔎 ICD-11 Bundle:', icd11Bundle);
    console.log('🔎 Mapping Profile:', mappingProfile);
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = '';

    // NAMASTE search
    searchResults.innerHTML += `<h3>NAMASTE Search Results</h3>`;
    let foundResults = false;
    if (namasteBundle && namasteBundle.entry && namasteBundle.entry.length > 0) {
        foundResults = true;
    }
    displaySearchResultsSection(namasteBundle, searchResults);

    // ICD-11 search
    searchResults.innerHTML += `<h3>ICD-11 Search Results</h3>`;
    if (icd11Bundle && icd11Bundle.entry && icd11Bundle.entry.length > 0) {
        foundResults = true;
    }
    displaySearchResultsSection(icd11Bundle, searchResults);

    // Mapping profile (if found)
    if (mappingProfile && mappingProfile.resourceType === 'Condition') {
        foundResults = true;
        searchResults.innerHTML += `<h3>Mapping Profile (by Code)</h3>`;
        displayMappingProfileSection(mappingProfile, searchResults);
    }

    // If no results at all, show a clear message
    if (!foundResults) {
        searchResults.innerHTML += `<div class="no-results"><p>No results found in any search section.</p></div>`;
    }
}

// Helper to display a FHIR Bundle section
function displaySearchResultsSection(bundle, container) {
    console.log('📦 Rendering bundle:', bundle);
    if (!bundle || !bundle.entry || bundle.entry.length === 0) {
        container.innerHTML += `<div class="no-results"><p>No results found.</p></div>`;
        return;
    }
    const bundleInfo = document.createElement('div');
    bundleInfo.className = 'bundle-info';
    bundleInfo.innerHTML = `
        <div class="bundle-header">
            <p><strong>Resource Type:</strong> ${bundle.resourceType || 'N/A'}</p>
            <p><strong>Type:</strong> ${bundle.type || 'N/A'}</p>
            <p><strong>Total Results:</strong> ${bundle.total || bundle.entry.length}</p>
            ${bundle.pagination ? `<p><strong>Page:</strong> ${bundle.pagination.page} of ${bundle.pagination.pages}</p>` : ''}
        </div>
    `;
    container.appendChild(bundleInfo);
    const entriesContainer = document.createElement('div');
    entriesContainer.className = 'bundle-entries';
    entriesContainer.innerHTML = '<h4>Entries:</h4>';
    bundle.entry.forEach((entry, index) => {
        const entryElement = document.createElement('div');
        entryElement.className = 'bundle-entry';
        if (entry.resource && entry.resource.resourceType === 'Condition') {
            const resource = entry.resource;
            let html = `<div class="entry-header">
                <span class="entry-number">#${index + 1}</span>
                <span class="resource-type">${resource.resourceType}</span>
                <span class="resource-id">ID: ${resource.id || 'N/A'}</span>
            </div><div class="entry-content"><div class="condition-info"><h4>Condition Details</h4>`;
            if (resource.clinicalStatus && resource.clinicalStatus.coding) {
                html += `<p><strong>Clinical Status:</strong> ${resource.clinicalStatus.coding[0].display || resource.clinicalStatus.coding[0].code}</p>`;
            }
            if (resource.category && resource.category[0] && resource.category[0].coding) {
                html += `<p><strong>Category:</strong> ${resource.category[0].coding[0].display || resource.category[0].coding[0].code}</p>`;
            }
            // Group codings by system for clarity
            if (resource.code && resource.code.coding) {
                html += `<div class="codings-section"><h5>Codings:</h5><div class="coding-list">`;
                const grouped = {};
                resource.code.coding.forEach(coding => {
                    let label = 'Other';
                    if (coding.system && coding.system.includes('namaste')) label = 'NAMASTE';
                    else if (coding.system && coding.system.includes('icd')) label = 'ICD-11';
                    else if (coding.system && coding.system.toLowerCase().includes('tm2')) label = 'TM2';
                    if (!grouped[label]) grouped[label] = [];
                    grouped[label].push(coding);
                });
                Object.keys(grouped).forEach(label => {
                    html += `<div class="coding-group"><strong>${label}:</strong>`;
                    grouped[label].forEach(coding => {
                        html += `<div class="coding-item"><span class="coding-code">${coding.code || 'N/A'}</span> <span class="coding-display">${coding.display || 'No display text'}</span> <span class="coding-system">[${coding.system || 'Unknown system'}]</span></div>`;
                    });
                    html += `</div>`;
                });
                html += `</div></div>`;
            }
            if (resource.subject) {
                html += `<p><strong>Subject:</strong> ${resource.subject.reference || 'N/A'}</p>`;
            }
            if (resource.extension && resource.extension.length > 0) {
                html += `<div class="extensions-section"><h5>Extensions:</h5><pre>${JSON.stringify(resource.extension, null, 2)}</pre></div>`;
            }
            html += `</div></div>`;
            entryElement.innerHTML = html;
        } else {
            entryElement.innerHTML = `<div class="entry-header"><span class="entry-number">#${index + 1}</span><span class="resource-type">${entry.resource ? entry.resource.resourceType : 'Unknown Resource'}</span></div><div class="entry-content"><pre>${JSON.stringify(entry, null, 2)}</pre></div>`;
        }
        entriesContainer.appendChild(entryElement);
    });
    container.appendChild(entriesContainer);
}

// Helper to display a mapping profile section
function displayMappingProfileSection(profile, container) {
    const profileDiv = document.createElement('div');
    profileDiv.className = 'mapping-profile';
    profileDiv.innerHTML = `<h4>Mapping Profile</h4><pre>${JSON.stringify(profile, null, 2)}</pre>`;
    container.appendChild(profileDiv);
}

// Display search results
function displaySearchResults(data) {
    console.log('📊 Displaying FHIR Bundle results:', data);
    if (!data) {
        console.error('❌ No data received in displaySearchResults');
        return;
    }
    
    // First make sure the search results section is visible
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.classList.remove('hidden');
    }
    
    // Use 'search-results' as the main container for displaying results
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) {
        console.error('❌ search-results element not found!');
        return;
    }
    resultsContainer.innerHTML = '';
    // Display FHIR Bundle metadata
    const bundleInfo = document.createElement('div');
    bundleInfo.className = 'bundle-info';
    bundleInfo.innerHTML = `
        <div class="bundle-header">
            <h3>FHIR Bundle Results</h3>
            <p><strong>Resource Type:</strong> ${data.resourceType || 'N/A'}</p>
            <p><strong>Type:</strong> ${data.type || 'N/A'}</p>
            <p><strong>Total Results:</strong> ${data.total || 0}</p>
            ${data.pagination ? `<p><strong>Page:</strong> ${data.pagination.page} of ${data.pagination.pages}</p>` : ''}
        </div>
    `;
    resultsContainer.appendChild(bundleInfo);
    
    if (data.entry && data.entry.length > 0) {
        // Create entries container
        const entriesContainer = document.createElement('div');
        entriesContainer.className = 'bundle-entries';
        entriesContainer.innerHTML = '<h4>Entries:</h4>';
        
        data.entry.forEach((entry, index) => {
            console.log(`📝 Processing entry ${index}:`, entry);
            
            const entryElement = document.createElement('div');
            entryElement.className = 'bundle-entry';
            
            if (entry.resource && entry.resource.resourceType === 'Condition') {
                const resource = entry.resource;
                
                // Extract codings
                const namasteCoding = resource.code.coding ? 
                    resource.code.coding.find(c => c.system && c.system.includes('namaste')) : null;
                
                const icd11Codings = resource.code.coding ? 
                    resource.code.coding.filter(c => c.system && c.system.includes('icd')) : [];
                
                let html = `
                    <div class="entry-header">
                        <span class="entry-number">#${index + 1}</span>
                        <span class="resource-type">${resource.resourceType}</span>
                        <span class="resource-id">ID: ${resource.id || 'N/A'}</span>
                    </div>
                    <div class="entry-content">
                        <div class="condition-info">
                            <h4>Condition Details</h4>
                `;
                
                // Display clinical status
                if (resource.clinicalStatus && resource.clinicalStatus.coding) {
                    html += `<p><strong>Clinical Status:</strong> ${resource.clinicalStatus.coding[0].display || resource.clinicalStatus.coding[0].code}</p>`;
                }
                
                // Display category
                if (resource.category && resource.category[0] && resource.category[0].coding) {
                    html += `<p><strong>Category:</strong> ${resource.category[0].coding[0].display || resource.category[0].coding[0].code}</p>`;
                }
                
                // Display codings in a structured way
                html += `<div class="codings-section">
                    <h5>Codings:</h5>
                    <div class="coding-list">`;
                
                if (resource.code && resource.code.coding) {
                    resource.code.coding.forEach(coding => {
                        const isNamaste = coding.system && coding.system.includes('namaste');
                        const isICD11 = coding.system && coding.system.includes('icd');
                        const codingType = isNamaste ? 'namaste' : isICD11 ? 'icd11' : 'other';
                        
                        html += `
                            <div class="coding-item ${codingType}">
                                <span class="coding-system">${coding.system || 'Unknown system'}</span>
                                <span class="coding-code">${coding.code || 'N/A'}</span>
                                <span class="coding-display">${coding.display || 'No display text'}</span>
                            </div>
                        `;
                    });
                }
                
                html += `</div></div>`; // Close codings-section and coding-list
                
                // Display subject if available
                if (resource.subject) {
                    html += `<p><strong>Subject:</strong> ${resource.subject.reference || 'N/A'}</p>`;
                }
                
                // Display extensions if available
                if (resource.extension && resource.extension.length > 0) {
                    html += `<div class="extensions-section">
                        <h5>Extensions:</h5>
                        <pre>${JSON.stringify(resource.extension, null, 2)}</pre>
                    </div>`;
                }
                
                html += `</div></div>`; // Close condition-info and entry-content
                
                // Add click handler for translation
                entryElement.onclick = () => {
                    if (namasteCoding) {
                        document.getElementById('namaste-code').value = namasteCoding.code;
                        showPage('translate');
                        document.querySelector('[data-tab="namaste-to-icd"]').click();
                    }
                };
                
                entryElement.innerHTML = html;
                entriesContainer.appendChild(entryElement);
                
            } else {
                // Display non-Condition resources or malformed entries
                entryElement.innerHTML = `
                    <div class="entry-header">
                        <span class="entry-number">#${index + 1}</span>
                        <span class="resource-type">${entry.resource ? entry.resource.resourceType : 'Unknown Resource'}</span>
                    </div>
                    <div class="entry-content">
                        <pre>${JSON.stringify(entry, null, 2)}</pre>
                    </div>
                `;
                entriesContainer.appendChild(entryElement);
            }
        });
        
        resultsContainer.appendChild(entriesContainer);
        
    } else {
        console.log('ℹ️ No entries found in bundle');
        resultsContainer.innerHTML += `
            <div class="no-results">
                <p>No results found in FHIR Bundle</p>
                <p>Bundle structure: ${JSON.stringify(data, null, 2).substring(0, 200)}...</p>
            </div>
        `;
    }
}

// Register new user
async function registerUser() {
    const abhaNumber = document.getElementById('abha-number').value;
    const phoneNumber = document.getElementById('phone-number').value;
    const name = document.getElementById('user-name').value;
    
    if (!abhaNumber || !phoneNumber) {
        alert('Please enter both ABHA number and phone number');
        return;
    }
    
    try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                abha_number: abhaNumber,
                phone_number: phoneNumber,
                name: name
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // After registration, send OTP
            await sendOTP(abhaNumber, phoneNumber);
        } else {
            // If user already exists, just send OTP
            if (data.error && data.error.includes('already exists')) {
                await sendOTP(abhaNumber, phoneNumber);
            } else {
                alert('Registration failed: ' + data.error);
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please check console for details.');
    }
}

// Send OTP
async function sendOTP(abhaNumber, phoneNumber) {
    try {
    const response = await fetch(`${API_BASE}/api/auth/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                abha_number: abhaNumber,
                phone_number: phoneNumber
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('otp-section').classList.remove('hidden');
            alert('OTP sent successfully! Check your console for the OTP (in development mode).');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('OTP send error:', error);
        alert('Failed to send OTP. Please check console for details.');
    }
}

// Verify OTP
async function verifyOTP() {
    const abhaNumber = document.getElementById('abha-number').value;
    const phoneNumber = document.getElementById('phone-number').value;
    const otpCode = document.getElementById('otp-code').value;
    
    if (!otpCode) {
        alert('Please enter the OTP code');
        return;
    }
    
    try {
    const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                abha_number: abhaNumber,
                phone_number: phoneNumber,
                otp_code: otpCode
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            authToken = data.data.access_token;
            currentUser = {
                abha_number: data.data.abha_number,
                phone_number: data.data.phone_number
            };
            
            // Store in localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userData', JSON.stringify(currentUser));
            
            updateLoginUI();
            showPage('home');
            alert('Login successful!');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('OTP verification error:', error);
        alert('Failed to verify OTP. Please check console for details.');
    }
}

// Logout
function logout() {
    isAuthenticated = false;
    authToken = null;
    currentUser = null;
    
    // Remove from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    updateLoginUI();
    alert('Logged out successfully');
}

// Helper function to show loader
function showLoader(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('hidden');
        element.innerHTML = '<p>Loading...</p>';
    }
}

// Test function to check if elements exist
function testElements() {
    console.log('🧪 Testing if elements exist:');
    const elementsToCheck = [
        'results-container',
        'search-results',
        'search-query',
        'search-type'
    ];
    
    elementsToCheck.forEach(id => {
        const element = document.getElementById(id);
        console.log(`   ${id}:`, element ? '✅ Found' : '❌ Not found');
        if (element) {
            console.log('     ', element);
        }
    });
}

// ==================== TRANSLATION FUNCTIONS ====================

async function translateCode(direction) {
    try {
        let code, system;
        
        if (direction === 'namaste-to-icd') {
            code = document.getElementById('namaste-code').value;
            system = 'https://nrces.in/fhir/CodeSystem/namaste';
        } else {
            code = document.getElementById('icd-code').value;
            system = 'http://id.who.int/icd/release/11';
        }
        
        if (!code) {
            alert('Please enter a code to translate');
            return;
        }
        
        showLoader(direction === 'namaste-to-icd' ? 'translation-result-content' : 'translation-result-content-2');
        
    const response = await fetch(`${API_BASE}/api/fhir/ConceptMap/namaste-icd11/$translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                code: code,
                system: system
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayTranslationResult(data, direction);
        } else {
            throw new Error(data.error || `Translation failed with status ${response.status}`);
        }
    } catch (error) {
        console.error('Translation error:', error);
        alert('Translation failed: ' + error.message);
    }
}

function displayTranslationResult(data, direction) {
    const resultElement = document.getElementById(
        direction === 'namaste-to-icd' ? 'translation-result-content' : 'translation-result-content-2'
    );
    const resultContainer = document.getElementById(
        direction === 'namaste-to-icd' ? 'translation-result' : 'translation-result-2'
    );
    
    if (!resultElement || !resultContainer) {
        console.error('Result elements not found');
        return;
    }
    
    resultContainer.classList.remove('hidden');
    
    if (data.parameter && data.parameter.length > 1) {
        let html = '<div class="translation-success">';
        html += '<p class="success-message">✅ Translation successful!</p>';
        
        // Find the result parameter
        const resultParam = data.parameter.find(p => p.name === 'result');
        if (resultParam && resultParam.valueBoolean) {
            html += '<p><strong>Result:</strong> Valid translation found</p>';
        }
        
        // Find all match parameters
        const matches = data.parameter.filter(p => p.name === 'match');
        html += `<p><strong>Matches found:</strong> ${matches.length}</p>`;
        
        matches.forEach((match, index) => {
            const equivalence = match.part.find(p => p.name === 'equivalence');
            const concept = match.part.find(p => p.name === 'concept');
            
            html += `
                <div class="match-item">
                    <h4>Match ${index + 1}</h4>
                    <p><strong>Equivalence:</strong> ${equivalence ? equivalence.valueCode : 'N/A'}</p>
            `;
            
            if (concept && concept.valueCoding) {
                html += `
                    <p><strong>System:</strong> ${concept.valueCoding.system || 'N/A'}</p>
                    <p><strong>Code:</strong> ${concept.valueCoding.code || 'N/A'}</p>
                    <p><strong>Display:</strong> ${concept.valueCoding.display || 'N/A'}</p>
                `;
            }
            
            html += '</div>';
        });
        
        html += '</div>';
        resultElement.innerHTML = html;
    } else {
        resultElement.innerHTML = `
            <div class="translation-error">
                <p class="error-message">❌ No translation found for the provided code</p>
                <p>Please check the code and try again.</p>
            </div>
        `;
    }
}

// ==================== ENCOUNTER FUNCTIONS ====================

async function createEncounter() {
    try {
        const patientId = document.getElementById('patient-id').value;
        const encounterType = document.getElementById('encounter-type').value;
        const notes = document.getElementById('encounter-notes').value;
        
        if (!patientId) {
            alert('Please enter a patient ID');
            return;
        }
        
    const response = await fetch(`${API_BASE}/api/encounters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                patient_id: patientId,
                encounter_type: encounterType,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const resultElement = document.getElementById('encounter-result-content');
            const resultContainer = document.getElementById('encounter-result');
            
            resultContainer.classList.remove('hidden');
            resultElement.innerHTML = `
                <div class="encounter-success">
                    <p class="success-message">✅ Encounter created successfully!</p>
                    <p><strong>Encounter ID:</strong> ${data.encounter_id}</p>
                    <p><strong>Patient ID:</strong> ${patientId}</p>
                    <p><strong>Type:</strong> ${encounterType}</p>
                    <p><strong>Message:</strong> ${data.message}</p>
                </div>
            `;
            
            // Clear the form
            document.getElementById('patient-id').value = '';
            document.getElementById('encounter-notes').value = '';
        } else {
            throw new Error(data.error || `Encounter creation failed with status ${response.status}`);
        }
    } catch (error) {
        console.error('Encounter creation error:', error);
        alert('Failed to create encounter: ' + error.message);
    }
}

async function loadEncounters() {
    try {
        const patientId = document.getElementById('search-patient-id').value;
        
        if (!patientId) {
            alert('Please enter a patient ID to search for encounters');
            return;
        }
        
        showLoader('encounters-container');
        document.getElementById('encounters-list').classList.remove('hidden');
        
        // Note: This endpoint would need to be implemented in your backend
        // For now, we'll use a placeholder implementation
    const response = await fetch(`${API_BASE}/api/encounters?patient_id=${patientId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayEncounters(data, patientId);
        } else if (response.status === 404) {
            // Endpoint not implemented yet - show mock data
            displayMockEncounters(patientId);
        } else {
            throw new Error(`Failed to load encounters with status ${response.status}`);
        }
    } catch (error) {
        console.error('Load encounters error:', error);
        // Show mock data as fallback
        const patientId = document.getElementById('search-patient-id').value;
        displayMockEncounters(patientId);
    }
}

function displayEncounters(data, patientId) {
    const container = document.getElementById('encounters-container');
    
    if (data && data.length > 0) {
        let html = `<h4>Encounters for Patient: ${patientId}</h4>`;
        html += `<p>Found ${data.length} encounter(s)</p>`;
        html += '<div class="encounters-grid">';
        
        data.forEach(encounter => {
            html += `
                <div class="encounter-card">
                    <h5>Encounter #${encounter.id}</h5>
                    <p><strong>Type:</strong> ${encounter.encounter_type}</p>
                    <p><strong>Date:</strong> ${new Date(encounter.created_at).toLocaleDateString()}</p>
                    <p><strong>Notes:</strong> ${encounter.notes || 'No notes'}</p>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    } else {
        container.innerHTML = `
            <div class="no-encounters">
                <p>No encounters found for patient: ${patientId}</p>
            </div>
        `;
    }
}

function displayMockEncounters(patientId) {
    const container = document.getElementById('encounters-container');
    
    // Mock data for demonstration
    const mockEncounters = [
        {
            id: 1001,
            encounter_type: 'consultation',
            created_at: '2023-10-15T09:30:00Z',
            notes: 'Initial consultation for digestive issues'
        },
        {
            id: 1002,
            encounter_type: 'follow-up',
            created_at: '2023-10-22T10:15:00Z',
            notes: 'Follow-up on prescribed treatment'
        },
        {
            id: 1003,
            encounter_type: 'emergency',
            created_at: '2023-11-05T16:45:00Z',
            notes: 'Emergency visit for acute symptoms'
        }
    ];
    
    let html = `<h4>Encounters for Patient: ${patientId}</h4>`;
    html += `<p class="mock-warning">⚠️ Using mock data - backend endpoint not fully implemented</p>`;
    html += `<p>Found ${mockEncounters.length} encounter(s)</p>`;
    html += '<div class="encounters-grid">';
    
    mockEncounters.forEach(encounter => {
        html += `
            <div class="encounter-card">
                <h5>Encounter #${encounter.id}</h5>
                <p><strong>Type:</strong> ${encounter.encounter_type}</p>
                <p><strong>Date:</strong> ${new Date(encounter.created_at).toLocaleDateString()}</p>
                <p><strong>Notes:</strong> ${encounter.notes}</p>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}