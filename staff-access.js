/* ============================================================================
   SFS BUSINESS MANAGEMENT — STAFF MODULE ACCESS
   ----------------------------------------------------------------------------
   Adds per-staff module permissions (Products, Sales, Accounts, Parties,
   Reports) on top of the existing ERP.

   HOW IT WORKS
   - Must be loaded LAST in index.html (after erp-overrides.js).
   - It does NOT modify app.js, erp-overrides.js or styles.css. It wraps the
     already-loaded nav(), showPage() and renderDashboard(), and replaces the
     Users & Roles screen.
   - An Administrator always sees everything.
   - A staff user sees only the modules switched on for them.
   - The backend (code.js) enforces the same rules, so a staff user cannot
     reach a blocked module by editing the page in the browser.

   SAFETY: this file reads and writes only the Users & Roles sheet row of the
   staff member being edited. No product, stock, DC, invoice, customer,
   supplier or payment data is touched.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. MODULES  (the five switches you asked for)
     Each module owns one or more ERP pages from erp-overrides.js.
     --------------------------------------------------------------------- */
  var MODULES = [
    { key: 'products', label: 'Products', hint: 'Products, Inward / Purchase, Stock Movement',
      pages: ['products', 'inward', 'movement'] },
    { key: 'sales', label: 'Sales (DC / Invoice)', hint: 'New DC, DC History, New Invoice, Invoice History',
      pages: ['newdc', 'dchistory', 'newinvoice', 'invoicehistory', 'dc', 'invoices'] },
    { key: 'accounts', label: 'Accounts (Payments)', hint: 'Outstanding / Payments, Supplier Payments',
      pages: ['outstanding', 'supplierpayable'] },
    { key: 'parties', label: 'Parties (Customers / Suppliers)', hint: 'Customers, Suppliers, Ledgers',
      pages: ['customers', 'suppliers'] },
    { key: 'reports', label: 'Reports', hint: 'Reports and sales summaries',
      pages: ['reports'] }
  ];

  var ADMIN_ONLY_PAGES = ['users'];          // Users & Roles - Administrator only
  var OPEN_PAGES = ['dashboard', 'settings']; // always reachable

  var PAGE_MODULE = {};
  MODULES.forEach(function (m) { m.pages.forEach(function (p) { PAGE_MODULE[p] = m.key; }); });

  /* ---------------------------------------------------------------------
     2. WHO IS LOGGED IN, AND WHAT MAY THEY SEE
     --------------------------------------------------------------------- */
  function currentUser() { return (window.S && window.S.user) || null; }

  function roleOf() {
    var u = currentUser();
    return String((u && (u.role || u.Role)) || '').trim().toUpperCase();
  }

  function isAdmin() { return roleOf() === 'ADMIN'; }

  /* Permissions for the logged-in user.
     Missing/blank permissions = full access (this is how existing staff
     accounts behaved before this update, so nothing breaks). */
  function myPermissions() {
    var out = {};
    var raw = currentUser() && currentUser().permissions;
    MODULES.forEach(function (m) {
      if (!raw || typeof raw !== 'object') out[m.key] = true;
      else out[m.key] = (raw[m.key] !== false && raw[m.key] !== undefined);
    });
    return out;
  }

  function can(key) {
    if (isAdmin()) return true;
    if (!key) return true;
    if (!(key in myPermissions())) return true;
    return myPermissions()[key] === true;
  }

  function pageAllowed(page) {
    if (!page) return true;
    if (OPEN_PAGES.indexOf(page) !== -1) return true;
    if (ADMIN_ONLY_PAGES.indexOf(page) !== -1) return isAdmin();
    var mod = PAGE_MODULE[page];
    if (!mod) return true;               // unknown/legacy page - do not block
    return can(mod);
  }

  function pageOfButton(b) {
    return b.getAttribute('data-page') ||
      (((b.getAttribute('onclick') || '').match(/'([^']+)'/) || [])[1]) || '';
  }

  function accessRestrictedHtml() {
    return '<div class="wrap"><div class="panel">' +
      '<h3>Access Restricted</h3>' +
      '<p class="muted">Your account does not have access to this module. ' +
      'Please contact the administrator if you need it.</p></div></div>';
  }

  /* ---------------------------------------------------------------------
     3. SMALL STYLE ADDITIONS (kept here so styles.css stays untouched)
     --------------------------------------------------------------------- */
  (function injectStyles() {
    if (document.getElementById('sfs-staff-access-style')) return;
    var css = '' +
      '.sfs-perm-grid{display:grid;grid-template-columns:1fr;gap:8px;margin:8px 0 14px}' +
      '.sfs-chk{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;cursor:pointer;line-height:1.35}' +
      '.sfs-chk input[type=checkbox]{width:16px;height:16px;min-width:16px;margin:1px 0 0;cursor:pointer}' +
      '.sfs-chk small{display:block;color:#5B6B80;font-size:11.5px}' +
      '.sfs-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;background:#EEF1F5;' +
        'color:#33475B;margin:2px 4px 2px 0;white-space:nowrap}' +
      '.sfs-badge.off{background:#F6E9E7;color:#A3372A}' +
      '.sfs-badge.full{background:#E3F1EA;color:#1E6B4E}' +
      '.sfs-note{font-size:12.5px;color:#5B6B80;margin:2px 0 10px}' +
      '.sfs-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}' +
      '.sfs-tile{padding:16px 18px;border:1px solid #E3E7EC;border-radius:10px;cursor:pointer;background:#fff}' +
      '.sfs-tile b{display:block;font-size:15px;margin-bottom:4px}' +
      '.sfs-tile span{font-size:12.5px;color:#5B6B80}';
    var el = document.createElement('style');
    el.id = 'sfs-staff-access-style';
    el.textContent = css;
    document.head.appendChild(el);
  })();

  /* ---------------------------------------------------------------------
     4. NAVIGATION - remove the modules a staff member may not open
     --------------------------------------------------------------------- */
  var baseNav = window.nav;
  window.nav = function () {
    if (typeof baseNav === 'function') baseNav.apply(this, arguments);

    var nav = document.getElementById('nav');
    if (!nav) return;

    Array.prototype.slice.call(nav.querySelectorAll('.navbtn')).forEach(function (b) {
      if (!pageAllowed(pageOfButton(b))) b.parentNode.removeChild(b);
    });

    // Drop section headings that no longer contain any page.
    Array.prototype.slice.call(nav.querySelectorAll('.nav-section')).forEach(function (s) {
      var next = s.nextElementSibling;
      if (!next || next.classList.contains('nav-section')) s.parentNode.removeChild(s);
    });
  };

  /* ---------------------------------------------------------------------
     5. PAGE GUARD - stops a hidden page being opened by hand
     --------------------------------------------------------------------- */
  var baseShowPage = window.showPage;
  window.showPage = function (page, btn) {
    if (!pageAllowed(page)) {
      Array.prototype.slice.call(document.querySelectorAll('.navbtn')).forEach(function (x) {
        x.classList.remove('active');
      });
      var title = document.getElementById('pageTitle');
      if (title) title.textContent = 'Access Restricted';
      var host = document.getElementById('content');
      if (host) host.innerHTML = accessRestrictedHtml();
      toast('Access denied - this module is not enabled for your account.', true);
      return;
    }
    return baseShowPage.apply(this, arguments);
  };

  /* ---------------------------------------------------------------------
     6. DASHBOARD - a restricted user gets tiles, not stock figures
     --------------------------------------------------------------------- */
  var baseDashboard = window.renderDashboard;
  window.renderDashboard = function () {
    var host = document.getElementById('dash');
    if (can('products') && can('reports')) {
      return typeof baseDashboard === 'function' ? baseDashboard.apply(this, arguments) : undefined;
    }
    if (!host) return;

    var allowed = MODULES.filter(function (m) { return can(m.key); });
    var cards = '<div class="cards">' +
      '<div class="card"><span>Signed in as</span><strong style="font-size:18px">' +
      esc((currentUser() && currentUser().name) || '') + '</strong></div>' +
      '<div class="card"><span>Role</span><strong style="font-size:18px">' + esc(roleOf() || 'STAFF') + '</strong></div>' +
      '<div class="card"><span>Modules</span><strong>' + allowed.length + '</strong></div>' +
      '</div>';

    var tiles = allowed.length
      ? '<div class="sfs-tiles">' + allowed.map(function (m) {
          return '<div class="sfs-tile" onclick="showPage(\'' + m.pages[0] + '\',null)">' +
            '<b>' + esc(m.label) + '</b><span>' + esc(m.hint) + '</span></div>';
        }).join('') + '</div>'
      : '<div class="muted">No modules have been enabled for your account yet. Please contact the administrator.</div>';

    host.innerHTML = cards + '<div class="panel"><h3>Your Modules</h3>' + tiles + '</div>';
  };

  /* ---------------------------------------------------------------------
     7. USERS & ROLES SCREEN (Administrator only)
     --------------------------------------------------------------------- */
  var SFS_USERS = [];

  function permsOfUserRow(u) {
    if (String(u.Role || '').toUpperCase() === 'ADMIN') return MODULES.map(function (m) { return m.key; });
    var p = u.Permissions;
    if (p === null || p === undefined || p === '') return MODULES.map(function (m) { return m.key; });
    if (typeof p === 'string') {
      var t = p.trim().toLowerCase();
      if (t === '*' || t === 'all') return MODULES.map(function (m) { return m.key; });
      if (t === 'none') return [];
      return t.split(/[,;|]/).map(function (x) { return x.trim(); });
    }
    return MODULES.filter(function (m) { return p[m.key] !== false && p[m.key] !== undefined; })
      .map(function (m) { return m.key; });
  }

  function badgesHtml(u) {
    if (String(u.Role || '').toUpperCase() === 'ADMIN') {
      return '<span class="sfs-badge full">Full access (Administrator)</span>';
    }
    var on = permsOfUserRow(u);
    return MODULES.map(function (m) {
      var has = on.indexOf(m.key) !== -1;
      return '<span class="sfs-badge' + (has ? '' : ' off') + '">' + (has ? '' : '\u2715 ') + esc(m.label) + '</span>';
    }).join('');
  }

  function moduleCheckboxesHtml(selected, idPrefix) {
    var on = selected || [];
    return '<div class="sfs-perm-grid" id="' + idPrefix + '_grid">' +
      MODULES.map(function (m) {
        var checked = on.indexOf(m.key) !== -1;
        return '<label class="sfs-chk"><input type="checkbox" id="' + idPrefix + '_' + m.key + '"' +
          (checked ? ' checked' : '') + '>' +
          '<span><b>' + esc(m.label) + '</b><small>' + esc(m.hint) + '</small></span></label>';
      }).join('') +
      '</div><div class="actions" style="gap:8px">' +
      '<button class="btn small" onclick="sfsCheckAll(\'' + idPrefix + '\',true)">Select all</button>' +
      '<button class="btn small" onclick="sfsCheckAll(\'' + idPrefix + '\',false)">Clear all</button>' +
      '</div>';
  }

  function readCheckboxes(idPrefix) {
    return MODULES.filter(function (m) {
      var el = document.getElementById(idPrefix + '_' + m.key);
      return el && el.checked;
    }).map(function (m) { return m.key; });
  }

  window.sfsCheckAll = function (idPrefix, value) {
    MODULES.forEach(function (m) {
      var el = document.getElementById(idPrefix + '_' + m.key);
      if (el) el.checked = !!value;
    });
  };

  /* Pages HTML for the Users & Roles screen */
  if (typeof pages !== 'undefined' && pages) {
    pages.users = function () {
      if (!isAdmin()) {
        return '<div class="wrap"><div class="panel"><h3>Users &amp; Staff</h3>' +
          '<p class="muted">Only an Administrator can manage staff accounts.</p></div></div>';
      }
      return '<div class="wrap">' +
        '<div class="panel-head"><h3>Users / Staff</h3>' +
        '<button class="btn primary" onclick="userForm()">+ Add Staff</button></div>' +
        '<div class="panel"><div class="table-wrap"><table><thead><tr>' +
        '<th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Module Access</th><th>Actions</th>' +
        '</tr></thead><tbody id="users"></tbody></table></div>' +
        '<p class="sfs-note">Tick a module to allow it, untick it to hide it for that staff member. ' +
        'Administrators always have every module.</p></div></div>';
    };
  }

  window.renderUsers = async function () {
    if (!isAdmin()) return;
    if (!document.getElementById('users')) return;

    var r = await api('listUsers');
    if (!r.ok) { toast(r.error || 'Could not load users.', true); return; }
    SFS_USERS = r.users || [];

    var rows = SFS_USERS.map(function (u) {
      var name = u.Name || u['Name'] || '';
      var user = u.Username || u['Username'] || '';
      var role = String(u.Role || 'STAFF').toUpperCase();
      var status = u.Status || 'Active';
      return '<tr>' +
        '<td>' + esc(name) + '</td>' +
        '<td>' + esc(user) + '</td>' +
        '<td>' + esc(role) + '</td>' +
        '<td>' + esc(status) + '</td>' +
        '<td>' + badgesHtml(u) + '</td>' +
        '<td>' +
        '<button class="btn small" onclick="sfsAccessForm(\'' + encodeURIComponent(user) + '\')">Module Access</button> ' +
        '<button class="btn small' + (status === 'Active' ? ' danger' : '') + '" onclick="toggleUser(\'' +
          encodeURIComponent(user) + '\',\'' + encodeURIComponent(status) + '\')">' +
          (status === 'Active' ? 'Disable' : 'Enable') + '</button>' +
        '</td></tr>';
    }).join('');

    var host = document.getElementById('users');
    var table = rows || '<tr><td colspan="6" class="empty">No staff accounts yet.</td></tr>';
    host.innerHTML = (host.tagName === 'TBODY')
      ? table
      : '<div class="table-wrap"><table><tbody>' + table + '</tbody></table></div>';
  };

  /* Edit the module access of an existing staff member */
  window.sfsAccessForm = function (usernameEnc) {
    var username = decodeURIComponent(usernameEnc);
    var u = SFS_USERS.filter(function (x) {
      return String(x.Username || '').toLowerCase() === username.toLowerCase();
    })[0] || {};
    var isUserAdmin = String(u.Role || '').toUpperCase() === 'ADMIN';

    modal('Module Access - ' + username,
      (isUserAdmin
        ? '<p class="sfs-note">This account is an <b>Administrator</b> and always has access to every module.</p>'
        : '<p class="sfs-note">Tick the modules this staff member is allowed to open. Unticked modules are hidden from the menu and blocked by the server.</p>') +
      moduleCheckboxesHtml(permsOfUserRow(u), 'sfsm') +
      '<div class="actions"><button class="btn primary" onclick="sfsSaveAccess(\'' +
        encodeURIComponent(username) + '\')">Save Access</button></div>');
  };

  window.sfsSaveAccess = async function (usernameEnc) {
    var username = decodeURIComponent(usernameEnc);
    var list = readCheckboxes('sfsm');
    var r = await api('setUserPermissions', { username: username, permissions: list.join(',') });
    if (!r.ok) { toast(r.error || 'Could not save access.', true); return; }
    closeModal();
    toast('Module access updated for ' + username + '.');
    renderUsers();
  };

  /* Add a new staff member (with module access) */
  window.userForm = function () {
    modal('Add Staff',
      '<div class="form-grid">' +
        '<label>Full Name<input id="un"></label>' +
        '<label>Username<input id="uu" autocomplete="off"></label>' +
        '<label>Password<input id="up" type="password" autocomplete="new-password"></label>' +
        '<label>Role<select id="ur" onchange="sfsRoleChanged()">' +
          '<option value="STAFF">STAFF</option><option value="ADMIN">ADMIN</option></select></label>' +
      '</div>' +
      '<p class="sfs-note" id="sfs_role_note">Choose which modules this staff member can open. ' +
      'Start from all ticked and untick what they should not see.</p>' +
      moduleCheckboxesHtml(MODULES.map(function (m) { return m.key; }), 'sfsn') +
      '<div class="actions"><button class="btn primary" onclick="saveUser()">Create Staff</button></div>');
  };

  window.sfsRoleChanged = function () {
    var role = (document.getElementById('ur') || {}).value;
    var note = document.getElementById('sfs_role_note');
    if (note) {
      note.innerHTML = (role === 'ADMIN')
        ? 'An <b>Administrator</b> always has access to every module - the tick boxes are ignored.'
        : 'Choose which modules this staff member can open. Start from all ticked and untick what they should not see.';
    }
  };

  window.saveUser = async function () {
    var name = (document.getElementById('un') || {}).value || '';
    var username = (document.getElementById('uu') || {}).value || '';
    var password = (document.getElementById('up') || {}).value || '';
    var role = (document.getElementById('ur') || {}).value || 'STAFF';

    if (!username.trim()) { toast('Username is required.', true); return; }
    if (!password) { toast('Password is required.', true); return; }

    var list = readCheckboxes('sfsn');

    var r = await api('saveUser', {
      name: name, username: username, password: password, role: role,
      permissions: list.join(',')
    });
    if (!r.ok) { toast(r.error || 'Could not create the staff account.', true); return; }

    closeModal();
    toast('Staff account "' + username + '" created.');
    showPage('users');
    renderUsers();
  };
})();
