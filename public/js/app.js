// ===================================================
// MR NOVEL EXPLAINER - PUBLIC CATALOG JS
// ===================================================

let allNovels = [];
let siteSettings = {};
let currentCategory = 'all'; // 'all', 'harem', 'fantasy'
let currentStatus = 'all';   // 'all', 'Ongoing', 'Completed'
let currentSort = 'updated';
let searchQuery = '';
let currentLang = localStorage.getItem('site_lang') || 'hi'; // 'hi' or 'en'

// Helper to get element safely
function $(id) {
  return document.getElementById(id);
}

// Initialize Application
async function initApp() {
  console.log('Initializing Mr Novel Explainer Hub...');
  try {
    await loadSettings();
  } catch (e) {
    console.warn('Settings load error:', e);
  }

  try {
    await loadNovels();
  } catch (e) {
    console.error('Novels load error:', e);
  }

  setupEventListeners();
}

// Auto-run when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Load Settings from API with static fallback
async function loadSettings() {
  try {
    let res = await fetch('/api/settings');
    if (!res.ok) res = await fetch('/data/settings.json');
    if (!res.ok) return;
    siteSettings = await res.json();
    applySettings(siteSettings);
  } catch (err) {
    try {
      const res = await fetch('/data/settings.json');
      if (res.ok) {
        siteSettings = await res.json();
        applySettings(siteSettings);
      }
    } catch (e) {
      console.warn('Error loading settings:', err);
    }
  }
}

function applySettings(settings) {
  if (settings.siteName) {
    document.title = `${settings.siteName} - ऑल नोवेल्स हिंदी AI ऑडियो`;
    document.querySelectorAll('.brand-name-text').forEach(el => el.textContent = settings.siteName);
  }
  
  if (settings.tagline) {
    const taglineEl = $('siteTagline');
    if (taglineEl) taglineEl.textContent = settings.tagline;
  }

  if (settings.bannerNotice) {
    const noticeEl = $('noticeStripText');
    if (noticeEl) {
      noticeEl.innerHTML = `📢 <strong>${escapeHTML(settings.bannerNotice)}</strong> <a href="${settings.telegramChannelLink || 'https://t.me/'}" class="tg-channel-link" target="_blank">चैनल जॉइन करें &rarr;</a>`;
    }
  }

  if (settings.telegramChannelLink) {
    document.querySelectorAll('.tg-channel-link').forEach(a => a.href = settings.telegramChannelLink);
  }

  if (settings.telegramDiscussionLink) {
    document.querySelectorAll('.tg-group-link').forEach(a => a.href = settings.telegramDiscussionLink);
  }

  if (settings.telegramChannelName) {
    document.querySelectorAll('.tg-channel-name').forEach(el => el.textContent = settings.telegramChannelName);
  }

  if (settings.footerText) {
    const footerEl = $('footerText');
    if (footerEl) footerEl.textContent = settings.footerText;
  }
}

// Load Novels from API with static fallback
async function loadNovels() {
  const grid = $('novelsGrid');
  try {
    let res = await fetch('/api/novels');
    if (!res.ok) {
      res = await fetch('/data/novels.json');
    }
    if (!res.ok) throw new Error('API returned status ' + res.status);
    allNovels = await res.json();
    console.log(`Successfully fetched ${allNovels.length} novels.`);

    updateStatsCounter();
    renderNovels();
  } catch (err) {
    try {
      const fallback = await fetch('/data/novels.json');
      if (fallback.ok) {
        allNovels = await fallback.json();
        updateStatsCounter();
        renderNovels();
        return;
      }
    } catch (e) {}
    console.error('Error loading novels:', err);
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3 class="empty-title">कहानियां लोड नहीं हो सकीं</h3>
          <p class="empty-sub">कृपया पेज को रीफ्रेश करें (Ctrl+F5) या सर्वर चालू होने की प्रतीक्षा करें।</p>
        </div>
      `;
    }
  }
}

// Update Top Stats Counter
function updateStatsCounter() {
  const totalCountEl = $('statTotalNovels');
  const ongoingCountEl = $('statOngoingNovels');
  const completedCountEl = $('statCompletedNovels');

  const countCatAllEl = $('countCatAll');
  const countCatHaremEl = $('countCatHarem');
  const countCatFantasyEl = $('countCatFantasy');

  const total = allNovels.length;
  const ongoing = allNovels.filter(n => n.status === 'Ongoing').length;
  const completed = allNovels.filter(n => n.status === 'Completed').length;
  const haremCount = allNovels.filter(n => (n.category || '').toLowerCase() === 'harem').length;
  const fantasyCount = allNovels.filter(n => (n.category || '').toLowerCase() === 'fantasy').length;

  if (totalCountEl) totalCountEl.textContent = total;
  if (ongoingCountEl) ongoingCountEl.textContent = ongoing;
  if (completedCountEl) completedCountEl.textContent = completed;

  if (countCatAllEl) countCatAllEl.textContent = total;
  if (countCatHaremEl) countCatHaremEl.textContent = haremCount;
  if (countCatFantasyEl) countCatFantasyEl.textContent = fantasyCount;
}

// Event Listeners
function setupEventListeners() {
  const searchInput = $('searchInput');
  const sortSelect = $('sortSelect');
  const categoryTabs = $('categoryTabs');
  const subStatusPills = $('subStatusPills');
  const langToggleBtn = $('langToggleBtn');
  const modalCloseBtn = $('modalCloseBtn');
  const detailsModal = $('detailsModal');

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderNovels();
    });
  }

  // Sort
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderNovels();
    });
  }

  // 2 Main Category Tabs (Harem vs Fantasy vs All)
  if (categoryTabs) {
    categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab-btn');
      if (!tab) return;

      document.querySelectorAll('.cat-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.cat || 'all';
      renderNovels();
    });
  }

  // Sub-Status Pills (Ongoing vs Completed)
  if (subStatusPills) {
    subStatusPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.sub-pill-btn');
      if (!pill) return;

      document.querySelectorAll('.sub-pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStatus = pill.dataset.status || 'all';
      renderNovels();
    });
  }

  // Language Switcher Toggle
  if (langToggleBtn) {
    updateLangUI();
    langToggleBtn.addEventListener('click', () => {
      currentLang = currentLang === 'hi' ? 'en' : 'hi';
      localStorage.setItem('site_lang', currentLang);
      updateLangUI();
      renderNovels();
    });
  }

  // Modal close
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (detailsModal) {
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailsModal && detailsModal.classList.contains('active')) {
      closeModal();
    }
  });
}

// Filter and Sort Novels
function getFilteredNovels() {
  let filtered = allNovels.filter(novel => {
    // 1. Category Filter (harem vs fantasy vs all)
    const novelCat = (novel.category || 'fantasy').toLowerCase();
    if (currentCategory !== 'all' && novelCat !== currentCategory) {
      return false;
    }

    // 2. Sub-Status Filter (Ongoing vs Completed vs all)
    if (currentStatus !== 'all' && novel.status !== currentStatus) {
      return false;
    }

    // 3. Search match
    if (searchQuery) {
      const titleMatch = (novel.title || '').toLowerCase().includes(searchQuery);
      const hindiMatch = (novel.hindiTitle || '').toLowerCase().includes(searchQuery);
      const descMatch = (novel.description || '').toLowerCase().includes(searchQuery);
      const genresMatch = (novel.genres || []).some(g => g.toLowerCase().includes(searchQuery));
      const statusMatch = (novel.chapterStatus || '').toLowerCase().includes(searchQuery);

      if (!titleMatch && !hindiMatch && !descMatch && !genresMatch && !statusMatch) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (currentSort === 'updated') {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }
    if (currentSort === 'chapters') {
      return (b.latestChapter || 0) - (a.latestChapter || 0);
    }
    if (currentSort === 'rating') {
      return (b.rating || 0) - (a.rating || 0);
    }
    if (currentSort === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return 0;
  });

  return filtered;
}

function updateLangUI() {
  const langFlag = $('langFlag');
  const langLabel = $('langLabel');
  if (!langFlag || !langLabel) return;
  if (currentLang === 'en') {
    langFlag.textContent = '🇬🇧';
    langLabel.textContent = 'English';
  } else {
    langFlag.textContent = '🇮🇳';
    langLabel.textContent = 'हिंदी';
  }
}

// Render Novels Cards
function renderNovels() {
  const grid = $('novelsGrid');
  const countBadge = $('novelCountBadge');
  if (!grid) {
    console.error('novelsGrid element not found in DOM!');
    return;
  }

  const filtered = getFilteredNovels();
  const isEn = currentLang === 'en';
  if (countBadge) {
    countBadge.textContent = isEn ? `${filtered.length} Stories` : `${filtered.length} कहानियां`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">${isEn ? 'No Stories Found' : 'कोई कहानी नहीं मिली'}</h3>
        <p class="empty-sub">${isEn ? 'Try another keyword or filter.' : 'कृपया अलग कीवर्ड या फ़िल्टर चुनकर पुनः खोजें।'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(novel => {
    const isCompleted = novel.status === 'Completed';
    const statusClass = isCompleted ? 'completed' : 'ongoing';
    const statusIcon = isCompleted ? '💯' : '🟢';
    const tgLink = novel.telegramLink || siteSettings.telegramChannelLink || 'https://t.me/MrNovelExplainer';

    const genresHtml = (novel.genres || []).slice(0, 3).map(g => `<span class="genre-tag">${escapeHTML(g)}</span>`).join('');
    const descriptionText = isEn 
      ? (novel.descriptionEn || novel.description || 'Hindi Audio Novel available on Telegram.') 
      : (novel.description || 'हिंदी ऑडियो उपन्यास - टेलीग्राम पर उपलब्ध।');

    const posterUrl = escapeHTML(novel.poster || '/uploads/default-poster.svg');

    return `
      <div class="novel-card" data-id="${novel.id}">
        <div class="card-poster-wrap" onclick="openDetailsModal('${novel.id}')">
          <img src="${posterUrl}" alt="${escapeHTML(novel.title)}" class="card-poster-img" loading="lazy" onerror="this.onerror=null; this.src='/uploads/default-poster.svg';">
          
          ${(novel.category === 'harem') 
            ? `<div class="card-cat-badge harem">🔥 18+ HAREM</div>` 
            : `<div class="card-cat-badge fantasy">⚔️ FANTASY</div>`}
          
          ${novel.featured ? `<div class="featured-star">★ FEATURED</div>` : ''}

          <div class="chapter-badge ${statusClass}">
            <span>${statusIcon} ${escapeHTML(novel.chapterStatus || (isCompleted ? 'Complete' : 'Ongoing'))}</span>
            <span style="opacity: 0.9;">🎧 HD Audio</span>
          </div>
        </div>

        <div class="card-body">
          <div class="genres-list">${genresHtml}</div>
          <h3 class="card-title" title="${escapeHTML(novel.title)}">${escapeHTML(novel.title)}</h3>
          ${novel.hindiTitle && novel.hindiTitle !== novel.title ? `<div class="card-hindi-title">${escapeHTML(novel.hindiTitle)}</div>` : ''}
          <p class="card-description">${escapeHTML(descriptionText)}</p>

          <div class="card-actions">
            <a href="${escapeHTML(tgLink)}" target="_blank" class="btn-card-listen" title="${isEn ? 'Listen on Telegram' : 'टेलीग्राम पर सुनें'}">
              <span>🎧 ${isEn ? 'Listen on Telegram' : 'टेलीग्राम पर सुनें'}</span>
            </a>
            <button class="btn-card-details" onclick="openDetailsModal('${novel.id}')" title="${isEn ? 'Details' : 'विवरण देखें'}">
              ℹ️ ${isEn ? 'Details' : 'विवरण'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Modal functions
window.openDetailsModal = function(novelId) {
  const novel = allNovels.find(n => n.id === novelId);
  if (!novel) return;

  const isEn = currentLang === 'en';
  const isCompleted = novel.status === 'Completed';
  const tgLink = novel.telegramLink || siteSettings.telegramChannelLink || 'https://t.me/MrNovelExplainer';
  const genresHtml = (novel.genres || []).map(g => `<span class="genre-tag" style="font-size:12px; padding:4px 10px;">${escapeHTML(g)}</span>`).join('');

  const shareText = encodeURIComponent(`सुनिए "${novel.title}" हिंदी AI ऑडियो में!\nलेटेस्ट स्टेटस: ${novel.chapterStatus}\nटेलीग्राम लिंक: ${tgLink}`);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;

  const posterImg = $('modalPosterImg');
  if (posterImg) {
    posterImg.src = novel.poster || '/uploads/default-poster.svg';
    posterImg.onerror = () => { posterImg.src = '/uploads/default-poster.svg'; };
  }

  const modalTitle = $('modalTitle');
  if (modalTitle) modalTitle.textContent = novel.title;

  const modalHindiTitle = $('modalHindiTitle');
  if (modalHindiTitle) modalHindiTitle.textContent = (novel.hindiTitle && novel.hindiTitle !== novel.title) ? novel.hindiTitle : '';
  
  const chapterTag = $('modalChapterTag');
  if (chapterTag) {
    chapterTag.className = `modal-chapter-tag ${isCompleted ? 'completed' : 'ongoing'}`;
    chapterTag.style.background = isCompleted ? '#f59e0b' : '#10b981';
    chapterTag.style.color = '#fff';
    chapterTag.textContent = `${isCompleted ? '💯' : '🟢'} ${novel.chapterStatus || (isCompleted ? 'Complete' : 'Ongoing')}`;
  }

  const modalGenres = $('modalGenres');
  if (modalGenres) modalGenres.innerHTML = genresHtml;
  
  const descText = isEn 
    ? (novel.descriptionEn || novel.description || 'Full audio episodes available on our Telegram channel.')
    : (novel.description || 'इस उपन्यास की हिंदी ऑडियो हमारे टेलीग्राम चैनल पर अपलोड की जा रही है। नवीनतम अध्यायों को सुनने के लिए नीचे दिए गए बटन पर क्लिक करें।');
    
  const modalDesc = $('modalDescription');
  if (modalDesc) modalDesc.textContent = descText;

  // Audio sample check
  const audioContainer = $('modalAudioSampleWrap');
  if (audioContainer) {
    if (novel.audioSample) {
      audioContainer.style.display = 'block';
      audioContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-weight:700; font-size:13px; color:var(--accent-cyan);">🎵 ${isEn ? 'Sample Audio Player:' : 'सैंपल ऑडियो प्लेयर:'}</div>
        <audio controls style="width: 100%;">
          <source src="${escapeHTML(novel.audioSample)}" type="audio/mpeg">
          Audio not supported.
        </audio>
      `;
    } else {
      audioContainer.style.display = 'none';
      audioContainer.innerHTML = '';
    }
  }

  const listenBtn = $('modalListenBtn');
  if (listenBtn) {
    listenBtn.href = tgLink;
    listenBtn.innerHTML = `<span>🎧 ${isEn ? 'Listen All Episodes on Telegram' : 'टेलीग्राम पर सभी एपिसोड सुनें'}</span>`;
  }

  const shareBtn = $('modalShareBtn');
  if (shareBtn) {
    shareBtn.href = whatsappUrl;
    shareBtn.innerHTML = `<span>💬 ${isEn ? 'Share with Friends' : 'दोस्तों के साथ शेयर करें'}</span>`;
  }

  const detailsModal = $('detailsModal');
  if (detailsModal) {
    detailsModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function() {
  const detailsModal = $('detailsModal');
  if (detailsModal) {
    detailsModal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
