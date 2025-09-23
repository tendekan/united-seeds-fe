(function() {
  'use strict';

  // ---------- Utilities ----------
  const STORAGE_KEYS = {
    auth: 'unitedseeds.auth',
    skills: 'unitedseeds.skills'
  };

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Failed to parse localStorage key', key, e);
      return fallback;
    }
  }

  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save localStorage key', key, e);
    }
  }

  function generateId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  function formatCurrency(amount) {
    const n = Number(amount || 0);
    return `$${n.toFixed(2)}`;
  }

  // ---------- App State ----------
  let authState = loadFromStorage(STORAGE_KEYS.auth, null);
  let skills = loadFromStorage(STORAGE_KEYS.skills, []);

  // ---------- DOM Elements ----------
  const yearEl = document.getElementById('year');
  const authOutEl = document.getElementById('auth-when-signed-out');
  const authInEl = document.getElementById('auth-when-signed-in');
  const btnOpenSignin = document.getElementById('btn-open-signin');
  const btnOpenSignup = document.getElementById('btn-open-signup');
  const btnSignout = document.getElementById('btn-signout');

  const profilePic = document.getElementById('profile-picture');
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');

  const landing = document.getElementById('landing');
  const createSkill = document.getElementById('create-skill');
  const skillForm = document.getElementById('skill-form');
  const skillTitle = document.getElementById('skill-title');
  const skillRate = document.getElementById('skill-rate');
  const skillDesc = document.getElementById('skill-description');
  const skillsList = document.getElementById('skills-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = null; // search removed
  const authModal = document.getElementById('auth-modal');
  const authModalClose = document.getElementById('auth-modal-close');
  const googleCalendarLogin = document.getElementById('google-calendar-login');
  const btnModalFacebook = document.getElementById('btn-modal-facebook');
  const authModalTitle = document.getElementById('auth-modal-title');
  const heroCta = document.getElementById('btn-hero-cta');
  const heroExplore = document.getElementById('btn-hero-secondary');
  const btnTileShare = document.getElementById('btn-tile-share');
  const btnTileLearn = document.getElementById('btn-tile-learn');
  const btnTileTip = document.getElementById('btn-tile-tip');

  // ---------- Initialization ----------
  function init() {
    yearEl.textContent = new Date().getFullYear();
    seedSkillsIfEmpty();
    renderAuthUI();
    renderSkills();
    attachEvents();
    initGoogle();
    initFacebook();
  }

  function seedSkillsIfEmpty() {
    if (Array.isArray(skills) && skills.length > 0) return;
    const now = Date.now();
    const minutes = (m) => m * 60 * 1000;
    const hours = (h) => h * 60 * 60 * 1000;
    const days = (d) => d * 24 * 60 * 60 * 1000;
    const seeded = [
      {
        id: generateId('skill'),
        title: 'Beginner JavaScript Mentoring',
        rate: 25,
        description: 'One-on-one sessions to learn JS fundamentals, DOM, and problem solving.',
        owner: { id: 'u_js_anna', name: 'Anna Morales', email: '', photoUrl: 'https://randomuser.me/api/portraits/women/68.jpg' },
        createdAt: now - hours(3),
        tags: ['JavaScript', 'DOM', 'Beginners'],
        tips: []
      },
      {
        id: generateId('skill'),
        title: 'Watercolor Painting Techniques',
        rate: 30,
        description: 'Learn washes, wet-on-wet, blending, and composition for relaxing art.',
        owner: { id: 'u_art_noah', name: 'Noah Bennett', email: '', photoUrl: 'https://randomuser.me/api/portraits/men/32.jpg' },
        createdAt: now - days(1) - minutes(25),
        tags: ['Watercolor', 'Art', 'Composition'],
        tips: []
      },
      {
        id: generateId('skill'),
        title: 'Financial Literacy for Teens',
        rate: 20,
        description: 'Budgeting, saving, and the basics of investing explained simply.',
        owner: { id: 'u_fin_sophia', name: 'Sophia Turner', email: '', photoUrl: 'https://randomuser.me/api/portraits/women/12.jpg' },
        createdAt: now - days(2) - hours(5),
        tags: ['Finance', 'Teens', 'Budgeting'],
        tips: []
      },
      {
        id: generateId('skill'),
        title: 'Gardening 101: Balcony to Backyard',
        rate: 18,
        description: 'Soil, sunlight, watering, and plant selection for any space.',
        owner: { id: 'u_garden_elinor', name: 'Elinor Hayes', email: '', photoUrl: 'https://randomuser.me/api/portraits/women/71.jpg' },
        createdAt: now - days(4) - hours(2),
        tags: ['Gardening', 'Sustainability', 'Outdoors'],
        tips: []
      },
      {
        id: generateId('skill'),
        title: 'Intro to Python for Data',
        rate: 35,
        description: 'Pandas, NumPy, and plotting for quick insights and reports.',
        owner: { id: 'u_data_ari', name: 'Ari Cohen', email: '', photoUrl: 'https://randomuser.me/api/portraits/men/41.jpg' },
        createdAt: now - days(6) - hours(8),
        tags: ['Python', 'Pandas', 'Data Viz'],
        tips: []
      }
    ];
    skills = seeded;
    saveToStorage(STORAGE_KEYS.skills, skills);
  }

  function attachEvents() {
    if (btnOpenSignin) btnOpenSignin.addEventListener('click', () => openAuthModal('Sign in'));
    if (btnOpenSignup) btnOpenSignup.addEventListener('click', () => openAuthModal('Sign up'));
    if (googleCalendarLogin) setupGoogleOAuthLink();
    if (btnModalFacebook) btnModalFacebook.addEventListener('click', onFacebookSignInClick);
    if (authModalClose) authModalClose.addEventListener('click', closeAuthModal);
    if (authModal) authModal.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute('data-close') === 'true') closeAuthModal();
    });
    if (btnSignout) {
      btnSignout.addEventListener('click', signOut);
    }
    if (skillForm) {
      skillForm.addEventListener('submit', onCreateSkill);
    }
    // search removed
    if (heroCta) heroCta.addEventListener('click', () => openAuthModal('Sign up'));
    if (heroExplore) heroExplore.addEventListener('click', () => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (btnTileShare) btnTileShare.addEventListener('click', () => {
      if (authState) {
        document.getElementById('create-skill')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        openAuthModal('Sign up');
      }
    });
    if (btnTileLearn) btnTileLearn.addEventListener('click', () => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (btnTileTip) btnTileTip.addEventListener('click', () => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function openAuthModal(mode) {
    if (authModalTitle) authModalTitle.textContent = `Continue to ${mode}`;
    authModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ---------- Auth UI ----------
  function renderAuthUI() {
    const signedIn = Boolean(authState);
    if (signedIn) {
      authOutEl.classList.add('hidden');
      authInEl.classList.remove('hidden');
      landing.classList.add('hidden');
      createSkill.classList.remove('hidden');
      profilePic.src = authState.photoUrl || '';
      profileName.textContent = authState.name || '';
      profileEmail.textContent = authState.email || '';
    } else {
      authOutEl.classList.remove('hidden');
      authInEl.classList.add('hidden');
      landing.classList.remove('hidden');
      createSkill.classList.add('hidden');
      profilePic.src = '';
      profileName.textContent = '';
      profileEmail.textContent = '';
    }
  }

  function signOut() {
    authState = null;
    saveToStorage(STORAGE_KEYS.auth, authState);
    renderAuthUI();
  }

  // ---------- Skills ----------
  function onCreateSkill(e) {
    e.preventDefault();
    if (!authState) return alert('Please sign in to share a skill.');
    const title = (skillTitle.value || '').trim();
    const rate = Number(skillRate.value || 0);
    const description = (skillDesc.value || '').trim();
    if (!title || !description) return;
    const newSkill = {
      id: generateId('skill'),
      title,
      rate,
      description,
      owner: {
        id: authState.userId,
        name: authState.name,
        email: authState.email,
        photoUrl: authState.photoUrl
      },
      createdAt: Date.now(),
      tips: [] // { by:{name, photoUrl}, amount, note, at }
    };
    skills.unshift(newSkill);
    saveToStorage(STORAGE_KEYS.skills, skills);
    skillForm.reset();
    renderSkills();
  }

  function getFilteredSkills() {
    const q = '';
    if (!q) return skills;
    return skills.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.owner?.name || '').toLowerCase().includes(q)
    );
  }

  function renderSkills() {
    const items = getFilteredSkills();
    skillsList.innerHTML = '';
    if (!items.length) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    const frag = document.createDocumentFragment();
    items.forEach(skill => {
      const card = document.createElement('div');
      card.className = 'skill-card';
      card.innerHTML = `
        <div class="owner">
          <img class="avatar" src="${skill.owner.photoUrl || getAvatarPlaceholder(skill.owner.name)}" alt="${skill.owner.name}">
          <div>
            <div class="owner-name">${escapeHtml(skill.owner.name || 'Anonymous')}</div>
            <div class="meta">${new Date(skill.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <div class="title">${escapeHtml(skill.title)}</div>
        <div class="description">${escapeHtml(skill.description)}</div>
        ${renderTags(skill.tags)}
        <div class="rate">Rate: ${formatCurrency(skill.rate)}/hr</div>
        <div class="tip">
          <input type="number" min="1" step="1" placeholder="Tip $" aria-label="Tip amount">
          <button class="btn btn-secondary">Tip</button>
        </div>
      `;
      const tipInput = card.querySelector('input');
      const tipBtn = card.querySelector('button');
      tipBtn.addEventListener('click', () => onTip(skill.id, Number(tipInput.value || 0)));
      frag.appendChild(card);
    });
    skillsList.appendChild(frag);
  }

  function onTip(skillId, amount) {
    if (!authState) { openAuthModal('Sign in'); return; }
    if (!amount || amount <= 0) return alert('Enter a valid tip amount.');
    const idx = skills.findIndex(s => s.id === skillId);
    if (idx === -1) return;
    skills[idx].tips.push({
      by: { name: authState.name, photoUrl: authState.photoUrl },
      amount,
      note: '',
      at: Date.now()
    });
    saveToStorage(STORAGE_KEYS.skills, skills);
    alert(`Thank you! You tipped ${formatCurrency(amount)} to ${skills[idx].owner.name}.`);
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"]+/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function getAvatarPlaceholder(name) {
    const initial = (name || 'U').trim()[0]?.toUpperCase() || 'U';
    // Use UI Avatars as a simple placeholder
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=1f2937&color=f8fafc&rounded=true&size=64`;
  }

  function renderTags(tags) {
    if (!tags || !tags.length) return '';
    const safe = tags.map(t => `<span class="tag">${escapeHtml(String(t))}</span>`).join('');
    return `<div class="tags">${safe}</div>`;
  }

  // ---------- Google OAuth (GIS) ----------
  let googleInited = false;
  function initGoogle() {
    const clientId = window.UNITEDSEEDS_GOOGLE_CLIENT_ID;
    if (!clientId || clientId.startsWith('YOUR_')) return; // not configured
    // Button uses One Tap style flow via popup token
    googleInited = true;
  }

  function setupGoogleOAuthLink() {
    // Prefer explicit config if provided
    const clientId = '118701076488-ftubu48jfl4tvk7dg6op1cs25kl7fl7i.apps.googleusercontent.com';
    const redirectUri = 'https://75e90f62a011.ngrok-free.app/oauth2callback';
    const scope = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    if (!googleCalendarLogin) return;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      access_type: 'offline',
      prompt: 'consent'
    }).toString();
    googleCalendarLogin.href = `${oauth2Endpoint}?${params}`;
  }

  async function fetchGoogleUser(accessToken) {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!resp.ok) throw new Error('Failed to fetch Google user');
    return resp.json();
  }

  // ---------- Facebook OAuth ----------
  let fbInited = false;
  function initFacebook() {
    const appId = window.UNITEDSEEDS_FACEBOOK_APP_ID;
    if (!appId || appId.startsWith('YOUR_')) return; // not configured
    if (fbInited) return;
    window.fbAsyncInit = function() {
      /* global FB */
      FB.init({
        appId: appId,
        cookie: true,
        xfbml: false,
        version: 'v21.0'
      });
      fbInited = true;
    };
    (function(d, s, id) {
      const fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) { fbInited = true; return; }
      const js = d.createElement(s); js.id = id; js.src = 'https://connect.facebook.net/en_US/sdk.js';
      fjs.parentNode.insertBefore(js, fjs);
    })(document, 'script', 'facebook-jssdk');
  }

  function onFacebookSignInClick() {
    const appId = window.UNITEDSEEDS_FACEBOOK_APP_ID;
    if (!appId || appId.startsWith('YOUR_')) {
      alert('Facebook Login not configured. Set UNITEDSEEDS_FACEBOOK_APP_ID in index.html');
      return;
    }
    /* global FB */
    FB.login(async (response) => {
      if (response.authResponse) {
        try {
          const user = await fetchFacebookUser();
          signInWithProfile({
            provider: 'facebook',
            userId: user.id,
            email: user.email || '',
            name: user.name,
            photoUrl: `https://graph.facebook.com/${user.id}/picture?type=large`
          });
        } catch (e) {
          console.error('FB user fetch failed', e);
          alert('Facebook sign-in failed.');
        }
      } else {
        console.warn('User cancelled FB login or did not fully authorize.');
      }
    }, { scope: 'public_profile,email' });
    closeAuthModal();
  }

  async function fetchFacebookUser() {
    return new Promise((resolve, reject) => {
      /* global FB */
      FB.api('/me', { fields: 'id,name,email' }, function(response) {
        if (!response || response.error) reject(response?.error || new Error('FB API error'));
        else resolve(response);
      });
    });
  }

  // ---------- Shared auth helper ----------
  function signInWithProfile(profile) {
    authState = profile;
    saveToStorage(STORAGE_KEYS.auth, authState);
    renderAuthUI();
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', init);
})();


