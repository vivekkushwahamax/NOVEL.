// ===================================================
// NOVEL VANI - ADMIN PANEL JS
// ===================================================

let authToken = localStorage.getItem('novel_admin_token') || '';
let novels = [];
let siteSettings = {};
let currentCategoryFilter = 'all';
let currentStatusFilter = 'all';
let adminSearchQuery = '';

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const adminPasswordInput = document.getElementById('adminPasswordInput');

const adminNovelsList = document.getElementById('adminNovelsList');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminCategoryFilter = document.getElementById('adminCategoryFilter');
const adminStatusFilter = document.getElementById('adminStatusFilter');

const admStatTotal = document.getElementById('admStatTotal');
const admStatOngoing = document.getElementById('admStatOngoing');
const admStatCompleted = document.getElementById('admStatCompleted');
const admStatChapters = document.getElementById('admStatChapters');

// Modals
const novelModal = document.getElementById('novelModal');
const novelModalHeading = document.getElementById('novelModalHeading');
const novelForm = document.getElementById('novelForm');
const novelModalCloseBtn = document.getElementById('novelModalCloseBtn');
const btnCancelNovelModal = document.getElementById('btnCancelNovelModal');
const btnAddNewNovel = document.getElementById('btnAddNewNovel');

const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const settingsModalCloseBtn = document.getElementById('settingsModalCloseBtn');
const btnCancelSettingsModal = document.getElementById('btnCancelSettingsModal');

const backupModal = document.getElementById('backupModal');
const btnOpenBackup = document.getElementById('btnOpenBackup');
const backupModalCloseBtn = document.getElementById('backupModalCloseBtn');
const btnDownloadBackup = document.getElementById('btnDownloadBackup');
const btnRestoreBackup = document.getElementById('btnRestoreBackup');
const backupFileInput = document.getElementById('backupFileInput');

const btnLogout = document.getElementById('btnLogout');
const toastNotice = document.getElementById('toastNotice');
const toastMsg = document.getElementById('toastMsg');
const toastIcon = document.getElementById('toastIcon');

// Form inputs
const formNovelId = document.getElementById('formNovelId');
const formTitle = document.getElementById('formTitle');
const formHindiTitle = document.getElementById('formHindiTitle');
const formCategory = document.getElementById('formCategory');
const formPosterUrl = document.getElementById('formPosterUrl');
const formPosterFileInput = document.getElementById('formPosterFileInput');
const formPosterPreview = document.getElementById('formPosterPreview');
const formStatus = document.getElementById('formStatus');
const formChapterStatus = document.getElementById('formChapterStatus');
const formLatestChapter = document.getElementById('formLatestChapter');
const formGenres = document.getElementById('formGenres');
const formTelegramLink = document.getElementById('formTelegramLink');
const formDescription = document.getElementById('formDescription');
const formFeatured = document.getElementById('formFeatured');

// Initial check
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    verifyAndInit();
  } else {
    showLogin();
  }
  setupEvents();
});

// Auth Verification
async function verifyAndInit() {
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.authenticated) {
      showDashboard();
      await loadData();
    } else {
      authToken = '';
      localStorage.removeItem('novel_admin_token');
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

function showLogin() {
  loginSection.style.display = 'flex';
  dashboardSection.style.display = 'none';
}

function showDashboard() {
  loginSection.style.display = 'none';
  dashboardSection.style.display = 'block';
}

// Load All Data
async function loadData() {
  await Promise.all([loadNovels(), loadSettings()]);
}

async function loadNovels() {
  try {
    const res = await fetch('/api/novels');
    novels = await res.json();
    updateMetrics();
    renderAdminNovels();
  } catch (err) {
    showToast('कहानियां लोड करने में त्रुटि', 'error');
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    siteSettings = await res.json();
  } catch (err) {
    console.error('Settings error:', err);
  }
}

function updateMetrics() {
  admStatTotal.textContent = novels.length;
  admStatOngoing.textContent = novels.filter(n => n.status === 'Ongoing').length;
  admStatCompleted.textContent = novels.filter(n => n.status === 'Completed').length;
  
  const totalChapters = novels.reduce((acc, n) => acc + (parseInt(n.latestChapter, 10) || 0), 0);
  admStatChapters.textContent = totalChapters.toLocaleString();
}

// Setup Event Listeners
function setupEvents() {
  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = adminPasswordInput.value.trim();
    if (!password) return;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        authToken = data.token;
        localStorage.setItem('novel_admin_token', authToken);
        showDashboard();
        await loadData();
        showToast('सफलतापूर्वक लॉगिन हो गए! स्वागत है।', 'success');
      } else {
        showToast(data.message || 'गलत पासवर्ड', 'error');
      }
    } catch (err) {
      showToast('लॉगिन विफल रहा: ' + err.message, 'error');
    }
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    authToken = '';
    localStorage.removeItem('novel_admin_token');
    showLogin();
    showToast('लॉगआउट कर दिया गया', 'success');
  });

  // Search and Filter
  adminSearchInput.addEventListener('input', (e) => {
    adminSearchQuery = e.target.value.toLowerCase().trim();
    renderAdminNovels();
  });

  adminStatusFilter.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    renderAdminNovels();
  });

  if (adminCategoryFilter) {
    adminCategoryFilter.addEventListener('change', (e) => {
      currentCategoryFilter = e.target.value;
      renderAdminNovels();
    });
  }

  // Add Novel Button
  btnAddNewNovel.addEventListener('click', () => {
    openNovelModal();
  });

  // Novel Modal Close
  novelModalCloseBtn.addEventListener('click', closeNovelModal);
  btnCancelNovelModal.addEventListener('click', closeNovelModal);

  // Settings Modal Open/Close
  btnOpenSettings.addEventListener('click', openSettingsModal);
  settingsModalCloseBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
  btnCancelSettingsModal.addEventListener('click', () => settingsModal.classList.remove('active'));

  // Backup Modal Open/Close
  btnOpenBackup.addEventListener('click', () => backupModal.classList.add('active'));
  backupModalCloseBtn.addEventListener('click', () => backupModal.classList.remove('active'));

  // Poster Image File Upload & Preview
  formPosterFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      formPosterPreview.src = base64Data;
      
      // Upload to server
      try {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ base64Data, fileName: file.name })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) {
          formPosterUrl.value = uploadData.url;
          formPosterPreview.src = uploadData.url;
          showToast('पोस्टर अपलोड हो गया!', 'success');
        }
      } catch (err) {
        showToast('इमेज अपलोड विफल', 'error');
      }
    };
    reader.readAsDataURL(file);
  });

  // Live URL preview
  formPosterUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      formPosterPreview.src = url;
    }
  });

  // Novel Form Submit (Create or Update)
  novelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = formNovelId.value;
    const isEdit = Boolean(id);

    const novelData = {
      title: formTitle.value.trim(),
      hindiTitle: formHindiTitle.value.trim(),
      category: formCategory.value,
      poster: formPosterUrl.value.trim() || '/uploads/rise-of-an-immortal.svg',
      status: formStatus.value,
      chapterStatus: formChapterStatus.value.trim(),
      latestChapter: parseInt(formLatestChapter.value, 10) || 1,
      genres: formGenres.value.split(',').map(s => s.trim()).filter(Boolean),
      telegramLink: formTelegramLink.value.trim(),
      description: formDescription.value.trim(),
      featured: formFeatured.checked
    };

    try {
      const url = isEdit ? `/api/novels/${id}` : '/api/novels';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(novelData)
      });

      const result = await res.json();
      if (res.ok) {
        showToast(isEdit ? 'कहानी सफलतापूर्वक अपडेट हो गई!' : 'नई कहानी सफलतापूर्वक जोड़ी गई!', 'success');
        closeNovelModal();
        await loadNovels();
      } else {
        showToast(result.error || 'त्रुटि हुई', 'error');
      }
    } catch (err) {
      showToast('सेव करने में समस्या: ' + err.message, 'error');
    }
  });

  // Settings Form Submit
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updates = {
      siteName: document.getElementById('setSiteName').value.trim(),
      tagline: document.getElementById('setTagline').value.trim(),
      telegramChannelName: document.getElementById('setTgChannelName').value.trim(),
      telegramChannelLink: document.getElementById('setTgChannelLink').value.trim(),
      telegramDiscussionLink: document.getElementById('setTgDiscussionLink').value.trim(),
      bannerNotice: document.getElementById('setBannerNotice').value.trim(),
      newPassword: document.getElementById('setNewPassword').value.trim()
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        showToast('वेबसाइट सेटिंग्स अपडेट हो गईं!', 'success');
        settingsModal.classList.remove('active');
        document.getElementById('setNewPassword').value = '';
        await loadSettings();
      } else {
        showToast('सेटिंग्स सेव नहीं हो सकीं', 'error');
      }
    } catch (err) {
      showToast('त्रुटि: ' + err.message, 'error');
    }
  });

  // Backup Download (Export)
  btnDownloadBackup.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hindi_audio_novels_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('बैकअप फ़ाइल डाउनलोड हो गई!', 'success');
    } catch (err) {
      showToast('डाउनलोड विफल: ' + err.message, 'error');
    }
  });

  // Restore Backup (Import)
  btnRestoreBackup.addEventListener('click', async () => {
    const file = backupFileInput.files[0];
    if (!file) {
      return showToast('कृपया पहले बैकअप JSON फ़ाइल चुनें', 'error');
    }

    if (!confirm('क्या आप सच में इस बैकअप को रिस्टोर करना चाहते हैं? इससे मौजूदा डेटा अपडेट हो जाएगा।')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(parsed)
        });
        const result = await res.json();
        if (result.success) {
          showToast('डेटा सफलतापूर्वक रिस्टोर हो गया!', 'success');
          backupModal.classList.remove('active');
          await loadNovels();
        } else {
          showToast('रिस्टोर विफल', 'error');
        }
      } catch (err) {
        showToast('अमान्य JSON फ़ाइल', 'error');
      }
    };
    reader.readAsText(file);
  });
}

// Render Admin Novels List
function renderAdminNovels() {
  let filtered = novels.filter(novel => {
    const matchesSearch = !adminSearchQuery ||
      (novel.title || '').toLowerCase().includes(adminSearchQuery) ||
      (novel.hindiTitle || '').toLowerCase().includes(adminSearchQuery) ||
      (novel.chapterStatus || '').toLowerCase().includes(adminSearchQuery);

    if (!matchesSearch) return false;

    if (currentCategoryFilter !== 'all' && (novel.category || 'fantasy') !== currentCategoryFilter) {
      return false;
    }

    if (currentStatusFilter === 'all') return true;
    return novel.status === currentStatusFilter;
  });

  if (filtered.length === 0) {
    adminNovelsList.innerHTML = `
      <div class="empty-state" style="padding: 40px;">
        <div class="empty-icon">📁</div>
        <h3>कोई कहानी नहीं मिली</h3>
        <p style="color:var(--text-muted); font-size:13.5px;">ऊपर '+ नई कहानी जोड़ें' बटन पर क्लिक करके पहली कहानी बनाएं।</p>
      </div>
    `;
    return;
  }

  adminNovelsList.innerHTML = filtered.map(novel => {
    const isCompleted = novel.status === 'Completed';
    const statusBg = isCompleted ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)';
    const statusColor = isCompleted ? '#fbbf24' : '#34d399';
    const tgLink = novel.telegramLink || '#';

    return `
      <div class="admin-novel-item" data-id="${novel.id}">
        <!-- Thumbnail -->
        <div class="item-thumb-wrap">
          <img src="${escapeHTML(novel.poster || '/uploads/rise-of-an-immortal.svg')}" alt="" class="item-thumb" onerror="this.src='/uploads/rise-of-an-immortal.svg'">
        </div>

        <!-- Info -->
        <div class="item-info">
          <div class="item-title-row">
            <span class="item-title">${escapeHTML(novel.title)}</span>
            <span class="admin-role-badge" style="background:${(novel.category === 'harem') ? 'rgba(236,72,153,0.15)' : 'rgba(0,242,254,0.15)'}; color:${(novel.category === 'harem') ? '#ec4899' : '#00f2fe'}; border-color:currentColor;">
              ${(novel.category === 'harem') ? '🔥 Harem / 18+' : '⚔️ Fantasy'}
            </span>
            ${novel.featured ? '<span style="color:#ffd700; font-size:12px; font-weight:800;">★ FEATURED</span>' : ''}
          </div>
          ${novel.hindiTitle ? `<div class="item-hindi-sub">${escapeHTML(novel.hindiTitle)}</div>` : ''}
          <div class="item-meta-row">
            <span>🏷️ ${(novel.genres || []).slice(0, 3).join(', ')}</span>
            <span>•</span>
            <a href="${escapeHTML(tgLink)}" target="_blank" style="color:var(--telegram-blue); text-decoration:underline;">टेलीग्राम लिंक ↗</a>
          </div>
        </div>

        <!-- Chapter Quick Updater -->
        <div class="chapter-quick-updater">
          <span class="chapter-current-badge" style="background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor}44;">
            ${isCompleted ? '💯' : '🟢'} ${escapeHTML(novel.chapterStatus || (isCompleted ? 'Complete' : 'Adhyay 1'))}
          </span>
          <div class="quick-counter-btns">
            ${!isCompleted ? `
              <button class="btn-counter-inc" onclick="quickIncrementChapter('${novel.id}')" title="1 चैप्टर आगे बढ़ाएं">
                +1 Adhyay (चैप्टर)
              </button>
            ` : `
              <span style="font-size:11.5px; color:#f59e0b; font-weight:700;">पूर्ण उपन्यास (Completed)</span>
            `}
          </div>
        </div>

        <!-- Actions -->
        <div class="item-actions-group">
          <button class="btn-item-action btn-item-edit" onclick="openNovelModal('${novel.id}')" title="एडिट करें">
            ✏️ एडिट
          </button>
          <button class="btn-item-action btn-item-del" onclick="deleteNovel('${novel.id}')" title="हटाएं">
            🗑️ हटाएं
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Quick Chapter Increment (+1 Chapter)
window.quickIncrementChapter = async function(novelId) {
  const novel = novels.find(n => n.id === novelId);
  if (!novel) return;

  const currentNum = parseInt(novel.latestChapter, 10) || 1;
  const nextNum = currentNum + 1;
  const nextStatus = `Adhyay ${nextNum} Tak`;

  try {
    const res = await fetch(`/api/novels/${novelId}/chapter`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        chapterStatus: nextStatus,
        latestChapter: nextNum
      })
    });

    if (res.ok) {
      novel.chapterStatus = nextStatus;
      novel.latestChapter = nextNum;
      updateMetrics();
      renderAdminNovels();
      showToast(`चैप्टर अपडेट हो गया: ${nextStatus}!`, 'success');
    } else {
      showToast('अपडेट विफल रहा', 'error');
    }
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  }
};

// Open Add / Edit Novel Modal
window.openNovelModal = function(novelId = '') {
  if (novelId) {
    // Edit existing
    const novel = novels.find(n => n.id === novelId);
    if (!novel) return;

    novelModalHeading.textContent = '✏️ कहानी संपादित करें (Edit Story)';
    formNovelId.value = novel.id;
    formTitle.value = novel.title || '';
    formHindiTitle.value = novel.hindiTitle || '';
    formCategory.value = novel.category || 'fantasy';
    formPosterUrl.value = novel.poster || '';
    formPosterPreview.src = novel.poster || '/uploads/rise-of-an-immortal.svg';
    formStatus.value = novel.status || 'Ongoing';
    formChapterStatus.value = novel.chapterStatus || '';
    formLatestChapter.value = novel.latestChapter || 1;
    formGenres.value = (novel.genres || []).join(', ');
    formTelegramLink.value = novel.telegramLink || '';
    formDescription.value = novel.description || '';
    formFeatured.checked = Boolean(novel.featured);
  } else {
    // Add new
    novelModalHeading.textContent = '➕ नई कहानी जोड़ें (Add Novel)';
    formNovelId.value = '';
    formTitle.value = '';
    formHindiTitle.value = '';
    formCategory.value = 'fantasy';
    formPosterUrl.value = '';
    formPosterPreview.src = '/uploads/rise-of-an-immortal.svg';
    formStatus.value = 'Ongoing';
    formChapterStatus.value = 'Adhyay 1 Tak';
    formLatestChapter.value = 1;
    formGenres.value = 'Cultivation, Action, Fantasy';
    formTelegramLink.value = siteSettings.telegramChannelLink || '';
    formDescription.value = '';
    formFeatured.checked = false;
  }

  novelModal.classList.add('active');
};

function closeNovelModal() {
  novelModal.classList.remove('active');
}

// Delete Novel
window.deleteNovel = async function(novelId) {
  const novel = novels.find(n => n.id === novelId);
  if (!novel) return;

  if (!confirm(`क्या आप वाकई "${novel.title}" को हटाना चाहते हैं? यह क्रिया वापस नहीं होगी।`)) {
    return;
  }

  try {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      novels = novels.filter(n => n.id !== novelId);
      updateMetrics();
      renderAdminNovels();
      showToast('कहानी हटा दी गई!', 'success');
    } else {
      showToast('कहानी हटाने में विफल', 'error');
    }
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  }
};

// Open Settings Modal
function openSettingsModal() {
  document.getElementById('setSiteName').value = siteSettings.siteName || '';
  document.getElementById('setTagline').value = siteSettings.tagline || '';
  document.getElementById('setTgChannelName').value = siteSettings.telegramChannelName || '';
  document.getElementById('setTgChannelLink').value = siteSettings.telegramChannelLink || '';
  document.getElementById('setTgDiscussionLink').value = siteSettings.telegramDiscussionLink || '';
  document.getElementById('setBannerNotice').value = siteSettings.bannerNotice || '';
  document.getElementById('setNewPassword').value = '';

  settingsModal.classList.add('active');
}

// Toast System
function showToast(message, type = 'success') {
  toastMsg.textContent = message;
  toastIcon.textContent = type === 'success' ? '✅' : '❌';
  toastNotice.className = `toast-notice show ${type}`;

  setTimeout(() => {
    toastNotice.classList.remove('show');
  }, 3500);
}

// Utility
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
