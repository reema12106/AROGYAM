// API Base URL - points to your Flask backend
const API_BASE = '/api';

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
    setupNavigation();
    setupTabs();
    checkSystemStatus();
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

// Perform search
async function performSearch() {
    const query = document.getElementById('search-query').value;
    const searchType = document.getElementById('search-type').value;
    
    if (!query || query.length < 2) {
        alert('Please enter at least 2 characters to search');
        return;
    }
    
    try {
        showLoader('search-results');
        
        let endpoint = `${API_BASE}/search/conditions?q=${encodeURIComponent(query)}`;
        if (searchType === 'icd11') {
            endpoint = `${API_BASE}/search/icd11?q=${encodeURIComponent(query)}`;
        }
        
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (response.ok) {
            displaySearchResults(data);
        } else {
            throw new Error(data.error || 'Search failed');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('Search failed: ' + error.message);
    const searchResults = document.getElementById('search-results');
    if (searchResults) searchResults.classList.add('hidden');
    }
}

// Display search results
function displaySearchResults(data) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    
    if (data.entry && data.entry.length > 0) {
        const searchResults = document.getElementById('search-results');
        if (searchResults) searchResults.classList.remove('hidden');
        
        data.entry.forEach(entry => {
            const resource = entry.resource;
            if (resource.resourceType === 'Condition' && resource.code && resource.code.coding) {
                const namasteCoding = resource.code.coding.find(c => c.system.includes('namaste'));
                const icd11Codings = resource.code.coding.filter(c => c.system.includes('icd'));
                
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.onclick = () => {
                    if (namasteCoding) {
                        document.getElementById('namaste-code').value = namasteCoding.code;
                        showPage('translate');
                        document.querySelector('[data-tab="namaste-to-icd"]').click();
                    }
                };
                
                let html = `
                    <div class="result-header">
                        <span class="result-title">${namasteCoding ? namasteCoding.display : 'Unknown'}</span>
                        <span class="result-code">${namasteCoding ? namasteCoding.code : 'N/A'}</span>
                    </div>
                `;
                
                if (icd11Codings.length > 0) {
                    html += `<div class="result-mappings">`;
                    html += `<p><strong>Mappings:</strong></p>`;
                    
                    icd11Codings.forEach(coding => {
                        const mappingType = coding.display && coding.display.includes('TM2') ? 'tm2' : 
                                          coding.display && coding.display.includes('Biomed') ? 'biomed' : 'fallback';
                        html += `
                            <div class="mapping-item">
                                <span class="mapping-type ${mappingType}">${mappingType.toUpperCase()}</span>
                                <span>${coding.code} - ${coding.display}</span>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                resultItem.innerHTML = html;
                resultsContainer.appendChild(resultItem);
            }
        });
    } else {
        resultsContainer.innerHTML = '<p>No results found</p>';
        document.getElementById('search-results').classList.remove('hidden');
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
        const response = await fetch(`${API_BASE}/auth/register`, {
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
        const response = await fetch(`${API_BASE}/auth/send-otp`, {
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
        const response = await fetch(`${API_BASE}/auth/verify-otp`, {
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
    element.classList.remove('hidden');
    element.innerHTML = '<p>Loading...</p>';
}

// Add other functions for translation, encounters, etc.

// For now, add placeholder functions
async function translateCode(direction) {
    alert('Translation functionality will be implemented after backend connection is confirmed');
}

async function createEncounter() {
    alert('Encounter creation will be implemented after backend connection is confirmed');
}

async function loadEncounters() {
    alert('Encounter loading will be implemented after backend connection is confirmed');
}