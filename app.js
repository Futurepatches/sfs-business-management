// Standard Fluid Systems - Main Application Logic
const SFS_CONFIG = {
    scriptUrl: "https://script.google.com/macros/s/AKfycbwL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec
};

let appState = {
    user: null,
    inventory: [],
    deliveries: [],
    invoices: [],
    activeTab: 'dashboard'
};

document.addEventListener('DOMContentLoaded', () => {
    checkSavedSession();
    setupEventListeners();
});

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('userInput').value.trim();
    const pass = document.getElementById('passInput').value.trim();
    
    if (user && pass) {
        appState.user = user;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        initDashboard();
    } else {
        document.getElementById('loginError').innerText = 'Please enter valid credentials.';
    }
}

function switchTab(tabId) {
    appState.activeTab = tabId;
    document.querySelectorAll('.navbtn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Hide all views and show selected
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(tabId + 'View');
    if (target) target.classList.remove('hidden');

    if (tabId === 'deliveries') loadDeliveriesData();
    if (tabId === 'invoices') loadInvoicesData();
}

function initDashboard() {
    // Load initial stats and tables
    fetchInventory();
}

async function fetchInventory() {
    // Simulated or live fetch from Google Sheets
    // Yahan aap apni fetch API call ya Google Apps Script endpoint connect karenge
}

// --- CORE FIX: AUTO-FILL INVOICE FROM DC ---
function handleDCSelection(dcNumber) {
    const selectedDC = appState.deliveries.find(d => d.dcNumber == dcNumber || d.challanNo == dcNumber);
    if (!selectedDC) return;

    // Auto-fill all header & customer fields
    document.getElementById('invCustomer').value = selectedDC.customerName || selectedDC.m_s || '';
    document.getElementById('invAddress').value = selectedDC.address || '';
    document.getElementById('invPoNo').value = selectedDC.poNo || '';
    document.getElementById('invPoDate').value = selectedDC.poDate || '';
    document.getElementById('invDcDate').value = selectedDC.date || '';
    document.getElementById('invStn').value = selectedDC.stn || '';
    document.getElementById('invNtn').value = selectedDC.ntn || '';

    // Auto-populate items table inside Invoice form
    const itemsTableBody = document.getElementById('invoiceItemsBody');
    if (itemsTableBody && selectedDC.items) {
        itemsTableBody.innerHTML = '';
        selectedDC.items.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" value="${item.description || ''}" class="input"></td>
                <td><input type="text" value="${item.model || ''}" class="input"></td>
                <td><input type="number" value="${item.qty || 1}" class="input item-qty"></td>
                <td><input type="number" value="${item.rate || 0}" class="input item-rate"></td>
                <td class="item-total">${(item.qty || 1) * (item.rate || 0)}</td>
            `;
            itemsTableBody.appendChild(row);
        });
    }
}

function loadDeliveriesData() {
    // Deliveries screen logic
}

function loadInvoicesData() {
    // Invoices screen logic & dropdown binding for DC numbers
    const dcSelect = document.getElementById('dcSelectDropdown');
    if (dcSelect) {
        dcSelect.addEventListener('change', (e) => {
            handleDCSelection(e.target.value);
        });
    }
}
