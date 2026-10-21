/**
 * @file sync.js
 * @category Service
 * @description Google Drive AppData synchronization engine handling OAuth2 authentication, cloud backup upload, and restore.
 * @requires GoogleIdentityServices, js/db.js, js/ui.js
 */

(function () {
  'use strict';

  const GOOGLE_CLIENT_ID = '1092898676521-2eec766sc9i1lmtntbc77v3s7vnqk2ak.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
  const BACKUP_FILENAME = 'veroku-backup.json';
  const STORAGE_KEY_AUTH = 'veroku_google_sync_auth';
  const STORAGE_KEY_META = 'veroku_google_sync_meta';
  const STORAGE_KEY_TOKEN = 'veroku_google_sync_token';

  let tokenClient = null;
  let activeAccessToken = null;
  let tokenExpiresAt = 0;
  let currentTokenResolve = null;
  let currentTokenReject = null;

  /**
   * Retrieve saved user session from localStorage
   */
  function getSavedUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTH);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save user session to localStorage
   */
  function saveUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
  }

  /**
   * Retrieve cloud backup metadata (last sync date, file size)
   */
  function getCloudMeta() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_META);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save cloud backup metadata
   */
  function saveCloudMeta(meta) {
    if (meta) {
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
    } else {
      localStorage.removeItem(STORAGE_KEY_META);
    }
  }

  /**
   * Retrieve saved OAuth token and expiry from localStorage
   */
  function getSavedToken() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TOKEN);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save OAuth token and expiry to localStorage
   */
  function saveToken(tokenData) {
    if (tokenData) {
      localStorage.setItem(STORAGE_KEY_TOKEN, JSON.stringify(tokenData));
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  }

  /**
   * Invalidate and clear OAuth token from memory and localStorage
   */
  function clearToken() {
    activeAccessToken = null;
    tokenExpiresAt = 0;
    saveToken(null);
  }

  /**
   * Restore token from localStorage if not expired (with 60-second safety window)
   */
  function restoreToken() {
    const saved = getSavedToken();
    if (saved && saved.accessToken && saved.expiresAt && Date.now() < (saved.expiresAt - 60000)) {
      activeAccessToken = saved.accessToken;
      tokenExpiresAt = saved.expiresAt;
      return true;
    }
    if (saved) {
      clearToken();
    }
    return false;
  }

  /**
   * Initialize Google Token Client via Google Identity Services
   */
  function initClient() {
    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
      console.warn('Google Identity Services library not yet loaded.');
      return false;
    }

    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
          const resolve = currentTokenResolve;
          const reject = currentTokenReject;
          currentTokenResolve = null;
          currentTokenReject = null;

          if (tokenResponse && tokenResponse.access_token) {
            activeAccessToken = tokenResponse.access_token;
            // Token expires in expiresIn seconds (default 3599)
            tokenExpiresAt = Date.now() + ((tokenResponse.expires_in || 3600) * 1000);
            saveToken({ accessToken: activeAccessToken, expiresAt: tokenExpiresAt });

            try {
              const userInfo = await fetchUserProfile(activeAccessToken);
              saveUser(userInfo);
              if (resolve) resolve(activeAccessToken);
            } catch (err) {
              console.error('Failed to fetch user profile:', err);
              if (reject) reject(err);
            }
          } else if (tokenResponse && tokenResponse.error) {
            console.error('Google Auth Error:', tokenResponse);
            if (reject) reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }
        },
        error_callback: (err) => {
          console.error('GIS Error:', err);
          if (currentTokenReject) {
            const reject = currentTokenReject;
            currentTokenResolve = null;
            currentTokenReject = null;
            reject(err);
          }
        }
      });
    }

    return true;
  }

  /**
   * Request OAuth token via interactive popup or silent reuse
   */
  function requestToken(promptMode = '') {
    return new Promise((resolve, reject) => {
      // Check if we can restore from storage or if active token is valid
      if (!activeAccessToken) {
        restoreToken();
      }

      if (activeAccessToken && Date.now() < tokenExpiresAt - 60000) {
        resolve(activeAccessToken);
        return;
      }

      if (!initClient()) {
        reject(new Error('Google Identity Services library is not loaded. Check internet connection.'));
        return;
      }

      currentTokenResolve = resolve;
      currentTokenReject = reject;

      const requestConfig = { prompt: promptMode };
      const savedUser = getSavedUser();
      if (savedUser && savedUser.email) {
        requestConfig.hint = savedUser.email;
      }

      tokenClient.requestAccessToken(requestConfig);
    });
  }

  /**
   * Fetch user profile (avatar, name, email) from Google OAuth UserInfo endpoint
   */
  async function fetchUserProfile(token) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      clearToken();
    }
    if (!res.ok) throw new Error('Could not fetch user profile from Google');
    return await res.json();
  }

  /**
   * Search for existing backup file in the private AppData folder
   */
  async function findCloudBackup(token) {
    const query = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=1`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      clearToken();
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return (data.files && data.files.length > 0) ? data.files[0] : null;
  }

  /**
   * Upload current Veroku state to Google Drive AppData folder
   */
  async function uploadBackup() {
    const token = await requestToken();
    const state = window.getAppState ? window.getAppState() : null;
    if (!state) throw new Error('Unable to read local application state.');

    const jsonString = JSON.stringify(state, null, 2);
    const existingFile = await findCloudBackup(token);

    let result;
    if (existingFile) {
      // Update existing file content (PATCH)
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const res = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: jsonString
      });

      if (res.status === 401) {
        clearToken();
      }

      if (!res.ok) throw new Error(`Failed to update cloud backup (${res.status})`);
      result = await res.json();
    } else {
      // Create new file inside appDataFolder using multipart upload
      const metadata = {
        name: BACKUP_FILENAME,
        parents: ['appDataFolder'],
        mimeType: 'application/json'
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        jsonString +
        closeDelim;

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (res.status === 401) {
        clearToken();
      }

      if (!res.ok) throw new Error(`Failed to create cloud backup (${res.status})`);
      result = await res.json();
    }

    const meta = {
      lastSyncTime: new Date().toISOString(),
      fileId: result.id,
      sizeBytes: jsonString.length
    };
    saveCloudMeta(meta);
    return meta;
  }

  /**
   * Download and return backup JSON from Google Drive AppData folder
   */
  async function downloadBackup() {
    const token = await requestToken();
    const file = await findCloudBackup(token);

    if (!file) {
      throw new Error('No cloud backup found on this Google Drive account.');
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      clearToken();
    }

    if (!res.ok) throw new Error(`Failed to download cloud backup (${res.status})`);
    const parsed = await res.json();

    // Validate schema
    if (!parsed || typeof parsed !== 'object' || !parsed.vehicles) {
      throw new Error('Cloud backup file has invalid or corrupted data schema.');
    }

    const meta = {
      lastSyncTime: file.modifiedTime || new Date().toISOString(),
      fileId: file.id,
      sizeBytes: file.size || 0
    };
    saveCloudMeta(meta);

    return { data: parsed, meta };
  }

  /**
   * Disconnect and clear user session
   */
  function disconnect() {
    if (activeAccessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(activeAccessToken, () => {});
      } catch (err) {
        console.warn('Token revocation skipped:', err);
      }
    }
    clearToken();
    saveUser(null);
    saveCloudMeta(null);
  }

  // Restore persisted session token on startup if still valid
  restoreToken();

  // Public VerokuSync API
  window.VerokuSync = {
    getSavedUser,
    getCloudMeta,
    getSavedToken,
    signIn: () => requestToken('select_account'),
    uploadBackup,
    downloadBackup,
    disconnect,
    findCloudBackup: async () => {
      const token = await requestToken();
      return await findCloudBackup(token);
    }
  };
})();
