// Standard Fluid Systems - Main Application Logic
const SFS_CONFIG = {
    scriptUrl: "https://script.google.com/macros/s/AKfycbwL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec"
};

let appState = {
    user: null,
    inventory: [],
    deliveries: [],
    invoices: [],
    activeTab: 'dashboard'
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = handleLoginSubmit;
    }
    fetchDataFromSheets();
});

function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    
    const userInput = document.getElementById('userInput');
    const passInput = document.getElementById('passInput');
    const errorDiv = document.getElementById('loginError');

    const user = userInput ? userInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';
    
    if (user !== "" && pass !== "") {
        appState.user = user;
        const loginScreen = document.getElementById('loginScreen');
        const appDiv = document.getElementById('app');

        if (loginScreen) loginScreen.classList.add('hidden');
        if (appDiv) appDiv.classList.remove('hidden');
        
        initDashboard();
    } else {
        if (errorDiv) errorDiv.innerText = 'Please enter valid username and password.';
    }
    return false;
}

async function fetchDataFromSheets() {
    try {
        const response = await fetch(SFS_CONFIG.scriptUrl);
        const data = await response.json();
        if (data) {
            appState.inventory = data.inventory || [];
            appState.deliveries = data.deliveries || [];
            appState.invoices = data.invoices || [];
            
            initDashboard();
            populateDCDropdown();
            loadInventoryData();
            loadDeliveriesData();
        }
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
    }
}

function switchTab(tabId) {
    appState.activeTab = tabId;
    document.querySelectorAll('.navbtn').forEach(btn => btn.classList.remove('active'));
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(tabId + 'View');
    if (target) target.classList.remove('hidden');

    if (tabId === 'inventory') loadInventoryData();
    if (tabId === 'deliveries') loadDeliveriesData();
    if (tabId === 'invoices') loadInvoicesData();
}

function initDashboard() {
    const totalItemsEl = document.getElementById('dashTotalItems');
    const totalDcEl = document.getElementById('dashTotalDC');
    const totalInvEl = document.getElementById('dashTotalInv');

    if (totalItemsEl) totalItemsEl.innerText = appState.inventory.length;
    if (totalDcEl) totalDcEl.innerText = appState.deliveries.length;
    if (totalInvEl) totalInvEl.innerText = appState.invoices.length;
}

function loadInventoryData() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (appState.inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No inventory items found.</td></tr>';
        return;
    }
    appState.inventory.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.model || item.itemCode || ''}</td>
            <td>${item.description || ''}</td>
            <td>${item.category || ''}</td>
            <td>${item.qty || item.stock || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

function loadDeliveriesData() {
    const tbody = document.getElementById('deliveriesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (appState.deliveries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No delivery challans found.</td></tr>';
        return;
    }
    appState.deliveries.forEach(dc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dc.dcNumber || dc.challanNo || ''}</td>
            <td>${dc.date || ''}</td>
            <td>${dc.customerName || dc.m_s || ''}</td>
            <td>${dc.poNo || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

function populateDCDropdown() {
    const dcSelect = document.getElementById('dcSelectDropdown');
    if (dcSelect && appState.deliveries.length > 0) {
        dcSelect.innerHTML = '<option value="">Select DC Number</option>';
        appState.deliveries.forEach(dc => {
            const dcNo = dc.dcNumber || dc.challanNo;
            if (dcNo) {
                const opt = document.createElement('option');
                opt.value = dcNo;
                opt.textContent = `DC-${dcNo} (${dc.customerName || dc.m_s || 'Client'})`;
                dcSelect.appendChild(opt);
            }
        });
    }
}

function handleDCSelection(dcNumber) {
    const selectedDC = appState.deliveries.find(d => (d.dcNumber == dcNumber || d.challanNo == dcNumber));
    if (!selectedDC) return;

    const invCust = document.getElementById('invCustomer');
    const invAddr = document.getElementById('invAddress');
    const invPo = document.getElementById('invPoNo');
    const invPoDt = document.getElementById('invPoDate');
    const invDcDt = document.getElementById('invDcDate');
    const invStn = document.getElementById('invStn');
    const invNtn = document.getElementById('invNtn');

    if (invCust) invCust.value = selectedDC.customerName || selectedDC.m_s || '';
    if (invAddr) invAddr.value = selectedDC.address || '';
    if (invPo) invPo.value = selectedDC.poNo || '';
    if (invPoDt) invPoDt.value = selectedDC.poDate || '';
    if (invDcDt) invDcDt.value = selectedDC.date || '';
    if (invStn) invStn.value = selectedDC.stn || '';
    if (invNtn) invNtn.value = selectedDC.ntn || '';

    const itemsTableBody = document.getElementById('invoiceItemsBody');
    if (itemsTableBody && selectedDC.items) {
        itemsTableBody.innerHTML = '';
        selectedDC.items.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.description || ''}</td>
                <td>${item.model || ''}</td>
                <td>${item.qty || 1}</td>
                <td>${item.rate || 0}</td>
                <td>${(item.qty || 1) * (item.rate || 0)}</td>
            `;
            itemsTableBody.appendChild(row);
        });
    }
}

function loadInvoicesData() {
    populateDCDropdown();
    const dcSelect = document.getElementById('dcSelectDropdown');
    if (dcSelect) {
        dcSelect.onchange = function(e) {
            handleDCSelection(e.target.value);
        };
    }
}
