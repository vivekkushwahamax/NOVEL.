const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const NOVELS_FILE = path.join(DATA_DIR, 'novels.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Helpers to read/write JSON
function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// In-memory simple auth tokens
const activeSessions = new Set();
const SECRET_SALT = 'novel-hub-secret-2026';

function generateToken() {
  const token = crypto.randomBytes(24).toString('hex');
  activeSessions.add(token);
  return token;
}

function isAuthenticated(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return activeSessions.has(token);
  }
  return false;
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon'
};

// Parse JSON body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Safeguard max 15MB payload (for base64 poster uploads)
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Serve Static Files
function serveStatic(req, res, pathname) {
  let safePath = pathname;
  if (safePath === '/' || safePath === '') safePath = '/index.html';
  if (safePath === '/admin') safePath = '/admin.html';

  // Normalize and prevent directory traversal
  const resolvedPath = path.join(PUBLIC_DIR, path.normalize(safePath));
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 fallback: serve index.html for client-side navigation if not an asset
      if (!path.extname(safePath)) {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        return fs.readFile(indexPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404);
            return res.end('Page Not Found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
      }
      res.writeHead(404);
      return res.end('Not Found');
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // --- API ROUTES ---

  // 1. Auth: Login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const { password } = await parseBody(req);
      const settings = readJSON(SETTINGS_FILE, { adminPassword: 'admin' });
      if (password && password === settings.adminPassword) {
        const token = generateToken();
        return sendJSON(res, 200, { success: true, token, message: 'Login successful' });
      }
      return sendJSON(res, 401, { success: false, message: 'गलत पासवर्ड (Invalid password)' });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: err.message });
    }
  }

  // 2. Auth: Verify
  if (req.method === 'GET' && pathname === '/api/auth/verify') {
    return sendJSON(res, 200, { authenticated: isAuthenticated(req) });
  }

  // 3. Settings: Public GET
  if (req.method === 'GET' && pathname === '/api/settings') {
    const settings = readJSON(SETTINGS_FILE, {});
    const publicSettings = { ...settings };
    delete publicSettings.adminPassword; // Never expose password in public API
    return sendJSON(res, 200, publicSettings);
  }

  // 4. Settings: Update (Auth Required)
  if (req.method === 'PUT' && pathname === '/api/settings') {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    try {
      const updates = await parseBody(req);
      const settings = readJSON(SETTINGS_FILE, {});
      
      // Update fields
      if (updates.siteName) settings.siteName = updates.siteName;
      if (updates.tagline) settings.tagline = updates.tagline;
      if (updates.telegramChannelName) settings.telegramChannelName = updates.telegramChannelName;
      if (updates.telegramChannelLink) settings.telegramChannelLink = updates.telegramChannelLink;
      if (updates.telegramDiscussionLink) settings.telegramDiscussionLink = updates.telegramDiscussionLink;
      if (updates.bannerNotice !== undefined) settings.bannerNotice = updates.bannerNotice;
      if (updates.footerText) settings.footerText = updates.footerText;
      if (updates.newPassword && updates.newPassword.trim()) {
        settings.adminPassword = updates.newPassword.trim();
      }

      writeJSON(SETTINGS_FILE, settings);
      const publicSettings = { ...settings };
      delete publicSettings.adminPassword;
      return sendJSON(res, 200, { success: true, settings: publicSettings });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 5. Novels: GET all
  if (req.method === 'GET' && pathname === '/api/novels') {
    const novels = readJSON(NOVELS_FILE, []);
    return sendJSON(res, 200, novels);
  }

  // 6. Novels: GET single
  if (req.method === 'GET' && pathname.startsWith('/api/novels/')) {
    const id = pathname.replace('/api/novels/', '');
    const novels = readJSON(NOVELS_FILE, []);
    const novel = novels.find(n => n.id === id);
    if (!novel) return sendJSON(res, 404, { error: 'Novel not found' });
    return sendJSON(res, 200, novel);
  }

  // 7. Novels: Create (Auth Required)
  if (req.method === 'POST' && pathname === '/api/novels') {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    try {
      const novelData = await parseBody(req);
      const novels = readJSON(NOVELS_FILE, []);

      const newNovel = {
        id: 'novel-' + Date.now(),
        title: novelData.title || 'Untitled Novel',
        hindiTitle: novelData.hindiTitle || '',
        category: novelData.category || 'fantasy',
        poster: novelData.poster || '/uploads/default-poster.svg',
        description: novelData.description || '',
        genres: Array.isArray(novelData.genres) ? novelData.genres : (novelData.genres ? novelData.genres.split(',').map(s => s.trim()) : ['Fantasy']),
        status: novelData.status || 'Ongoing',
        chapterStatus: novelData.chapterStatus || 'Adhyay 1 Tak',
        latestChapter: parseInt(novelData.latestChapter, 10) || 1,
        telegramLink: novelData.telegramLink || '',
        audioSample: novelData.audioSample || '',
        featured: Boolean(novelData.featured),
        rating: parseFloat(novelData.rating) || 4.8,
        views: novelData.views || '1.0K',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      novels.unshift(newNovel);
      writeJSON(NOVELS_FILE, novels);
      return sendJSON(res, 201, { success: true, novel: newNovel });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 8. Novels: Fast Chapter Update (Auth Required)
  if (req.method === 'PATCH' && pathname.match(/^\/api\/novels\/[^/]+\/chapter$/)) {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    try {
      const parts = pathname.split('/');
      const id = parts[3];
      const { chapterStatus, latestChapter } = await parseBody(req);
      const novels = readJSON(NOVELS_FILE, []);
      const index = novels.findIndex(n => n.id === id);
      if (index === -1) return sendJSON(res, 404, { error: 'Novel not found' });

      if (chapterStatus !== undefined) novels[index].chapterStatus = chapterStatus;
      if (latestChapter !== undefined) novels[index].latestChapter = parseInt(latestChapter, 10);
      novels[index].updatedAt = new Date().toISOString();

      writeJSON(NOVELS_FILE, novels);
      return sendJSON(res, 200, { success: true, novel: novels[index] });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 9. Novels: Update (Auth Required)
  if (req.method === 'PUT' && pathname.startsWith('/api/novels/')) {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    try {
      const id = pathname.replace('/api/novels/', '');
      const updates = await parseBody(req);
      const novels = readJSON(NOVELS_FILE, []);
      const index = novels.findIndex(n => n.id === id);
      if (index === -1) return sendJSON(res, 404, { error: 'Novel not found' });

      // Apply updates
      novels[index] = {
        ...novels[index],
        ...updates,
        id: novels[index].id, // Prevent changing ID
        updatedAt: new Date().toISOString()
      };

      if (typeof updates.genres === 'string') {
        novels[index].genres = updates.genres.split(',').map(g => g.trim()).filter(Boolean);
      }

      writeJSON(NOVELS_FILE, novels);
      return sendJSON(res, 200, { success: true, novel: novels[index] });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 10. Novels: Delete (Auth Required)
  if (req.method === 'DELETE' && pathname.startsWith('/api/novels/')) {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    const id = pathname.replace('/api/novels/', '');
    let novels = readJSON(NOVELS_FILE, []);
    const initialLen = novels.length;
    novels = novels.filter(n => n.id !== id);
    if (novels.length === initialLen) return sendJSON(res, 404, { error: 'Novel not found' });

    writeJSON(NOVELS_FILE, novels);
    return sendJSON(res, 200, { success: true, message: 'Novel deleted' });
  }

  // 11. Poster Upload (Auth Required)
  if (req.method === 'POST' && pathname === '/api/upload') {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    try {
      const { base64Data, fileName } = await parseBody(req);
      if (!base64Data) return sendJSON(res, 400, { error: 'Missing image data' });

      // Match data URL prefix (e.g. data:image/png;base64,...)
      const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      let ext = 'png';
      let buffer;

      if (matches) {
        ext = matches[1].replace('jpeg', 'jpg').replace('+xml', '');
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const cleanFileName = `poster_${Date.now()}.${ext}`;
      const savePath = path.join(UPLOADS_DIR, cleanFileName);
      fs.writeFileSync(savePath, buffer);

      return sendJSON(res, 200, {
        success: true,
        url: `/uploads/${cleanFileName}`
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 12. Backup Export / Restore
  if (req.method === 'GET' && pathname === '/api/backup') {
    const novels = readJSON(NOVELS_FILE, []);
    const settings = readJSON(SETTINGS_FILE, {});
    const cleanSettings = { ...settings };
    delete cleanSettings.adminPassword;
    return sendJSON(res, 200, { exportDate: new Date().toISOString(), settings: cleanSettings, novels });
  }

  if (req.method === 'POST' && pathname === '/api/restore') {
    if (!isAuthenticated(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
    try {
      const data = await parseBody(req);
      if (Array.isArray(data.novels)) {
        writeJSON(NOVELS_FILE, data.novels);
      }
      return sendJSON(res, 200, { success: true, message: 'Data restored successfully' });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // Fallback: Static Files
  serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Hindi Novel Audio Hub is RUNNING!`);
  console.log(`🌐 Public Website: http://localhost:${PORT}`);
  console.log(`⚙️ Admin Panel:    http://localhost:${PORT}/admin`);
  console.log(`🔒 Admin Panel is Protected`);
  console.log(`=======================================================`);
});
