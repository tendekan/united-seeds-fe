'use strict';

// Load config.env synchronously and expose BACKEND_URL
let BACKEND_URL = 'https://united-seeds-118701076488.europe-central2.run.app';
try {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'config.env', false);
  xhr.send(null);
  if (xhr.status === 200) {
    const lines = xhr.responseText.split('\n');
    for (const line of lines) {
      if (line.startsWith('BACKEND_URL=')) {
        BACKEND_URL = line.split('=')[1].trim();
        break;
      }
    }
  }
} catch (e) {
  // fallback to default
}

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

function getAuthHeaders() {
  const headers = {};
  if (authState && authState.accessToken) {
    headers.Authorization = `Bearer ${authState.accessToken}`;
  }
  return headers;
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
  const appShell = document.getElementById('app-shell');
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
  const googleCalendarLogin = null; // removed
  const btnModalFacebook = document.getElementById('btn-modal-facebook');
  const btnModalGoogle = document.getElementById('btn-modal-google');
  const authModalTitle = document.getElementById('auth-modal-title');
  const heroCta = document.getElementById('btn-hero-cta');
  const heroExplore = document.getElementById('btn-hero-secondary');
  const btnTileShare = document.getElementById('btn-tile-share');
  const btnTileLearn = document.getElementById('btn-tile-learn');
  const btnTileTip = document.getElementById('btn-tile-tip');
  const navCreate = document.getElementById('nav-create');
  const navServices = document.getElementById('nav-services');
  const navDating = document.getElementById('nav-dating');
  const navSettings = document.getElementById('nav-settings');
  const composer = document.getElementById('composer');
  const postText = document.getElementById('post-text');
  const postVideo = document.getElementById('post-video');
  const btnPost = document.getElementById('btn-post');
  const postsList = document.getElementById('posts-list');
  const postsPagination = document.getElementById('posts-pagination');
  const postsPrev = document.getElementById('posts-prev');
  const postsNext = document.getElementById('posts-next');
  const postsPage = document.getElementById('posts-page');
  const servicesView = document.getElementById('services-view');
  const datingView = document.getElementById('dating-view');
  const servicesPosts = null;
  const svcPrev = null;
  const svcNext = null;
  const svcPage = null;
  const settingsView = document.getElementById('settings-view');
  const chkUseProfileDating = document.getElementById('opt-use-profile-dating');
  const settingsLanguage = document.getElementById('settings-language');
  const settingsCurrency = document.getElementById('settings-currency');
  const postCategory = document.getElementById('post-category');
  const postSubcategory = document.getElementById('post-subcategory');
  const toast = document.getElementById('toast');
  const globalSpinner = document.getElementById('global-spinner');

  // ---------- Initialization ----------
  function init() {
  // Clear all demo/cached data from localStorage on first load
  localStorage.removeItem('unitedseeds.auth');
  localStorage.removeItem('unitedseeds.skills');
  localStorage.removeItem('unitedseeds.posts');
  localStorage.removeItem('unitedseeds.settings');
  yearEl.textContent = new Date().getFullYear();
  renderAuthUI();
  if (skillsList && emptyState) renderSkills();
  attachEvents();
  // Set Google Client ID for OAuth2
  window.UNITEDSEEDS_GOOGLE_CLIENT_ID =
    '118701076488-ftubu48jfl4tvk7dg6op1cs25kl7fl7i.apps.googleusercontent.com';
  initGoogle();
  initFacebook();
  postsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-toggle-comments')) {
      toggleComments(e.target);
    } else if (e.target.classList.contains('btn-edit-comment')) {
      e.preventDefault();
      const commentId = e.target.getAttribute('data-comment-id');
      await handleEditComment(commentId);
    } else if (e.target.classList.contains('btn-delete-comment')) {
      e.preventDefault();
      const commentId = e.target.getAttribute('data-comment-id');
      await handleDeleteComment(commentId);
    }
  });

  postsList.addEventListener('change', async (e) => {
    const select = e.target.closest('.comment-sort');
    if (select) {
      const postCard = select.closest('.post-card');
      if (!postCard) return;
      const postId = postCard.dataset.postId;
      const newOrder = select.value === 'asc' ? 'asc' : 'desc';
      commentSortOrder[postId] = newOrder;
      if (!commentPaginationState[postId]) {
        commentPaginationState[postId] = { currentPage: 1, totalPages: 1, totalComments: 0 };
      } else {
        commentPaginationState[postId].currentPage = 1;
      }
      const commentsList = postCard.querySelector('.comments-list');
      commentsList.innerHTML = '<div class="muted">Зареждане на коментари...</div>';
      try {
        const state = commentPaginationState[postId];
        const data = await fetchComments(postId, state.currentPage, 5, newOrder);
        state.totalPages = data.totalPages;
        state.totalComments = data.total;
        renderComments(data.comments, commentsList, postId, state);
      } catch (error) {
        console.error('Failed to change sort order:', error);
        commentsList.innerHTML = '<div class="muted">Неуспешно зареждане на коментарите.</div>';
      }
    }
  });
  }


  function attachEvents() {
    if (btnOpenSignin) btnOpenSignin.addEventListener('click', () => openAuthModal('Влез'));
    if (btnOpenSignup) btnOpenSignup.addEventListener('click', () => openAuthModal('Регистрирай се'));
  if (btnModalGoogle) btnModalGoogle.addEventListener('click', onGoogleSignInClick);
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
    if (heroCta) heroCta.addEventListener('click', () => openAuthModal('Регистрирай се'));
    if (heroExplore) heroExplore.addEventListener('click', () => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (btnTileShare) btnTileShare.addEventListener('click', () => {
      if (authState) {
        document.getElementById('create-skill')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        openAuthModal('Регистрирай се');
      }
    });
    if (btnTileLearn) btnTileLearn.addEventListener('click', () => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (btnTileTip) btnTileTip.addEventListener('click', () => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (navCreate) navCreate.addEventListener('click', () => showSection('create'));
    if (navServices) navServices.addEventListener('click', () => showSection('services'));
    if (navDating) navDating.addEventListener('click', () => showSection('dating'));
    if (navSettings) navSettings.addEventListener('click', () => showSection('settings'));
    if (btnPost) btnPost.addEventListener('click', onCreatePost);
    setupCategories();
    setupServiceTileRouting();
    setupSettings();
  }

  const SETTINGS_KEY = 'unitedseeds.settings';
  function setupSettings() {
    const s = loadFromStorage(SETTINGS_KEY, {
      useProfileForDating: true,
      language: 'en',
      currency: 'EUR'
    });
    if (chkUseProfileDating) chkUseProfileDating.checked = !!s.useProfileForDating;
    if (settingsLanguage) settingsLanguage.value = s.language || 'en';
    if (settingsCurrency) settingsCurrency.value = s.currency || 'EUR';
    if (chkUseProfileDating) chkUseProfileDating.addEventListener('change', persistSettings);
    if (settingsLanguage) settingsLanguage.addEventListener('change', persistSettings);
    if (settingsCurrency) settingsCurrency.addEventListener('change', persistSettings);
  }

  function persistSettings() {
    const s = {
      useProfileForDating: chkUseProfileDating ? chkUseProfileDating.checked : true,
      language: settingsLanguage ? settingsLanguage.value : 'en',
      currency: settingsCurrency ? settingsCurrency.value : 'EUR'
    };
    saveToStorage(SETTINGS_KEY, s);
  }

  const CATEGORY_LABELS = [
    ['gardening', 'Gardening'],
    ['home-repairs', 'Home Repairs'],
    ['short-stays', 'Short-term stays'],
    ['long-stays', 'Long-term stays'],
    ['building', 'Building'],
    ['finance', 'Finance'],
    ['it-lessons', 'IT Lessons'],
    ['car-repairs', 'Car Repairs'],
    ['sport', 'Sport'],
    ['pets', 'Pets'],
    ['art', 'Art'],
    ['beauty', 'Beauty'],
    ['healthcare', 'Healthcare'],
    ['fashion', 'Fashion'],
    ['cooking', 'Cooking']
  ];

  const CATEGORY_LABELS_BG = {
    'gardening': 'Градинарство',
    'home-repairs': 'Домашни поправки',
    'short-stays': 'Кратки престои',
    'long-stays': 'Дългосрочни престои',
    'building': 'Строителство',
    'finance': 'Финанси',
    'it-lessons': 'ИТ уроци',
    'car-repairs': 'Ремонт на автомобили',
    'sport': 'Спорт',
    'pets': 'Домашни любимци',
    'art': 'Изкуство',
    'beauty': 'Красота',
    'healthcare': 'Здравеопазване',
    'fashion': 'Мода',
    'cooking': 'Готвене'
  };

  const SUBCATEGORY_MAP = {
    'gardening': ['Plants', 'Landscaping', 'Tools'],
    'home-repairs': ['Plumbing', 'Electrical', 'Painting'],
    'short-stays': ['Room', 'Studio', 'Apartment'],
    'long-stays': ['Room', 'House', 'Apartment'],
    'building': ['Renovation', 'Construction', 'Consulting'],
    'finance': ['Budgeting', 'Taxes', 'Investing'],
    'it-lessons': ['Programming', 'Office Tools', 'Cybersecurity'],
    'car-repairs': ['Engine', 'Tires', 'Diagnostics'],
    'sport': ['Fitness', 'Team Sports', 'Coaching'],
    'pets': ['Grooming', 'Training', 'Sitting'],
    'art': ['Painting', 'Drawing', 'Crafts'],
    'beauty': ['Makeup', 'Skincare', 'Hair'],
    'healthcare': ['Wellness', 'First Aid', 'Nutrition'],
    'fashion': ['Styling', 'Tailoring', 'Design'],
    'cooking': ['Baking', 'Meal Prep', 'World Cuisine']
  };

  const SUBCATEGORY_MAP_BG = {
    'gardening': {
      'Plants': 'Растения',
      'Landscaping': 'Озеленяване',
      'Tools': 'Инструменти'
    },
    'home-repairs': {
      'Plumbing': 'Водопровод',
      'Electrical': 'Електричество',
      'Painting': 'Боядисване'
    },
    'short-stays': {
      'Room': 'Стая',
      'Studio': 'Студио',
      'Apartment': 'Апартамент'
    },
    'long-stays': {
      'Room': 'Стая',
      'House': 'Къща',
      'Apartment': 'Апартамент'
    },
    'building': {
      'Renovation': 'Реновация',
      'Construction': 'Строителство',
      'Consulting': 'Консултации'
    },
    'finance': {
      'Budgeting': 'Бюджетиране',
      'Taxes': 'Данъци',
      'Investing': 'Инвестиции'
    },
    'it-lessons': {
      'Programming': 'Програмиране',
      'Office Tools': 'Офис инструменти',
      'Cybersecurity': 'Киберсигурност'
    },
    'car-repairs': {
      'Engine': 'Двигател',
      'Tires': 'Гуми',
      'Diagnostics': 'Диагностика'
    },
    'sport': {
      'Fitness': 'Фитнес',
      'Team Sports': 'Отборни спортове',
      'Coaching': 'Тренировки'
    },
    'pets': {
      'Grooming': 'Подстригване',
      'Training': 'Дресировка',
      'Sitting': 'Гледане'
    },
    'art': {
      'Painting': 'Рисуване',
      'Drawing': 'Чертане',
      'Crafts': 'Занаяти'
    },
    'beauty': {
      'Makeup': 'Грим',
      'Skincare': 'Грижа за кожата',
      'Hair': 'Коса'
    },
    'healthcare': {
      'Wellness': 'Здравословен начин на живот',
      'First Aid': 'Първа помощ',
      'Nutrition': 'Хранене'
    },
    'fashion': {
      'Styling': 'Стилизиране',
      'Tailoring': 'Шивачество',
      'Design': 'Дизайн'
    },
    'cooking': {
      'Baking': 'Печене',
      'Meal Prep': 'Приготвяне на храна',
      'World Cuisine': 'Световна кухня'
    }
  };

  function setupCategories() {
    if (!postCategory || !postSubcategory) return;
    postCategory.innerHTML = CATEGORY_LABELS.map(([value, label]) => `<option value="${value}">${CATEGORY_LABELS_BG[value] || label}</option>`).join('');
    postCategory.addEventListener('change', () => populateSubcategories(postCategory.value));
    populateSubcategories(CATEGORY_LABELS[0][0]);
  }

  function populateSubcategories(categoryKey) {
    if (!postSubcategory) return;
    const subs = SUBCATEGORY_MAP[categoryKey] || [];
    postSubcategory.innerHTML = subs.map(s => {
      const display = SUBCATEGORY_MAP_BG[categoryKey]?.[s] || s;
      return `<option value="${s}">${display}</option>`;
    }).join('');
  }

  function setupServiceTileRouting() {
    if (!servicesView) return;
    servicesView.addEventListener('click', (e) => {
      const tile = e.target.closest('.category-tile');
      if (!tile) return;
      const cat = tile.getAttribute('data-category');
      if (postCategory) {
        postCategory.value = cat;
        populateSubcategories(cat);
      }
      // Navigate to posts and fetch remote posts there
      showSection('posts');
      currentRemoteCategory = cat;
      currentRemotePage = 1;
      fetchAndRenderRemotePosts();
    });
  }

  function openAuthModal(mode) {
    if (authModalTitle) {
      if (mode === 'Влез') {
        authModalTitle.textContent = 'Влезни в системата';
      } else if (mode === 'Регистрирай се') {
        authModalTitle.textContent = 'Продължи към регистрация';
      } else {
        authModalTitle.textContent = `Продължи към ${mode}`;
      }
    }
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
      // Debug: Log authState and photo URL
      console.log('[DEBUG] authState:', authState);
      authOutEl.classList.add('hidden');
      authInEl.classList.remove('hidden');
      if (landing) landing.classList.add('hidden');
      // Hide all pre-login sections for a clean app shell view
      const hero = document.getElementById('hero');
      const skillsSection = document.getElementById('skills');
      if (hero) hero.classList.add('hidden');
      if (skillsSection) skillsSection.classList.add('hidden');
      if (appShell) appShell.classList.remove('hidden');
      if (createSkill) createSkill.classList.add('hidden');
      // Set profile picture with fallback
      if (authState.photoUrl) {
        console.log('[DEBUG] Using photoUrl:', authState.photoUrl);
        profilePic.src = authState.photoUrl;
        profilePic.alt = `Снимка на профила на ${authState.name || 'Потребител'}`;
      } else {
        const fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(authState.name || 'Потребител') + '&background=0D8ABC&color=fff&size=128';
        console.log('[DEBUG] Using fallback avatar:', fallbackUrl);
        profilePic.src = fallbackUrl;
        profilePic.alt = 'Аватар по подразбиране';
      }
      profileName.textContent = authState.name || 'Потребител';
      profileEmail.textContent = authState.email || '';
      renderPosts();
    } else {
      authOutEl.classList.remove('hidden');
      authInEl.classList.add('hidden');
      if (landing) landing.classList.remove('hidden');
      const hero = document.getElementById('hero');
      const skillsSection = document.getElementById('skills');
      if (hero) hero.classList.remove('hidden');
      if (skillsSection) skillsSection.classList.remove('hidden');
      if (appShell) appShell.classList.add('hidden');
      if (createSkill) createSkill.classList.add('hidden');
      profilePic.src = '';
      profileName.textContent = '';
      profileEmail.textContent = '';
    }
  }

  // ---------- Posts ----------
  const POSTS_KEY = 'unitedseeds.posts';
  let posts = loadFromStorage(POSTS_KEY, []);
  
  // ---------- Comments Pagination & Sort State ----------
  const commentPaginationState = {}; // { postId: { currentPage: 1, totalPages: 1, totalComments: 0 } }
  const commentSortOrder = {}; // { postId: 'desc' | 'asc' }

  async function onCreatePost() {
    if (!authState) { openAuthModal('Влез'); return; }
    const text = (postText.value || '').trim();
    if (!text) {
      if (postVideo) postVideo.value = '';
      return;
    }
    showGlobalSpinner(true);
    // Prepare local post but only add to UI after BE success
    const newLocalPost = {
      id: generateId('post'),
      text,
      category: postCategory ? postCategory.value : '',
      subcategory: postSubcategory ? postSubcategory.value : '',
      videoName: (postVideo && postVideo.files && postVideo.files[0]) ? postVideo.files[0].name : '',
      author: { name: authState.name, photoUrl: authState.photoUrl },
      createdAt: Date.now()
    };

    // Additionally send to external API as per requirement
    try {
  const apiBase = BACKEND_URL + '/posts';
      // Map internal values to API contract
      const categoryKeyToLabel = new Map(CATEGORY_LABELS);
      const categoryLabel = categoryKeyToLabel.get(newLocalPost.category) || newLocalPost.category || '';
      const twoDigit = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return Math.floor(Math.random() * 100);
        return Math.abs(num) % 100; // 0..99
      };

      // If a video file is selected, upload to GCS using a signed URL first
      let uploadedVideoFullName = '';
      const file = (postVideo && postVideo.files && postVideo.files[0]) ? postVideo.files[0] : null;
      if (file) {
        try {
          const up = await uploadVideoAndGetPublicUrl(file);
          uploadedVideoFullName = up.fullName || '';
        } catch (e) {
          console.error('Video upload failed', e);
          showToast('Video upload failed. Your post was not submitted.');
          return; // do not proceed with post creation if video upload fails
        }
      }

      const payload = {
  id: twoDigit(Math.floor(Date.now() / 1000)),
  // Shorten userId to fit Java long (max 19 digits, signed)
  userId: (() => {
    let raw = authState.userId ?? Math.floor(Math.random() * 1000000);
    let str = String(raw).replace(/\D/g, ''); // digits only
    if (str.length > 18) str = str.slice(-18); // keep last 18 digits
    return str;
  })(),
  facebookName: authState.name || '',
        category: categoryLabel || '',
        subcategory: newLocalPost.subcategory || '',
        // Send only the returned full name of the uploaded video as requested
        videoUrl: uploadedVideoFullName || '',
        postText: text,
        createdAt: new Date().toISOString()
      };
      const resp = await fetch(`${apiBase}`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        // Update local store and UI only on success
        posts.unshift(newLocalPost);
        saveToStorage(POSTS_KEY, posts);
        postText.value = '';
        renderPosts();
        showToast('Вашата публикация беше изпратена успешно.');
      }
      // Optional UX: notify success without blocking UI
      console.info('Post sent to API', payload);
    } catch (err) {
      console.error('Failed to send post to API', err);
      showToast('Неуспешно изпращане на публикацията. Моля, опитайте отново.');
    } finally {
      if (postVideo) postVideo.value = '';
      showGlobalSpinner(false);
    }
  }

  function getFileExtension(name) {
    const idx = (name || '').lastIndexOf('.');
    if (idx === -1) return '';
    return name.slice(idx + 1).toLowerCase();
  }

  function resolveVideoMimeType(fileName, fallbackType) {
    const ext = getFileExtension(fileName);
    const map = {
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'qt': 'video/quicktime',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      'avi': 'video/x-msvideo',
      'm4v': 'video/x-m4v',
      'mpeg': 'video/mpeg',
      'mpg': 'video/mpeg',
      '3gp': 'video/3gpp',
      '3gpp': 'video/3gpp',
      'ogg': 'video/ogg'
    };
    return map[ext] || (fallbackType || 'application/octet-stream');
  }

  async function requestSignedUploadUrl(fileName, contentTypeHint) {
  const url = BACKEND_URL + '/api/v1/videos/upload-url';
    const body = {
      fileName: fileName,
      contentType: contentTypeHint
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'accept': '*/*', 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('Failed to get signed upload URL');
    return resp.json();
  }

  async function uploadVideoAndGetPublicUrl(file) {
    const name = file.name || 'video';
    const mime = resolveVideoMimeType(name, file.type);
    const meta = await requestSignedUploadUrl(name, mime);
    const signedUrl = meta.uploadUrl || meta.signedUrl || meta.url;
    if (!signedUrl) throw new Error('Signed URL missing in response');
    const putResp = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: file
    });
    if (!putResp.ok) throw new Error('Upload to GCS failed');
    // Return both fullName (blob key/path) and public URL if provided
    return {
      fullName: meta.fullName || meta.fileName || '',
      publicUrl: meta.publicUrl || signedUrl.split('?')[0]
    };
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  function renderPosts() {
    if (!postsList) return;
    postsList.innerHTML = '';
    const frag = document.createDocumentFragment();
    posts.forEach(p => {
      const el = document.createElement('div');
      el.className = 'post-card';
      el.innerHTML = `
        <div class="post-header">
          <img class="avatar" src="${p.author.photoUrl || getAvatarPlaceholder(p.author.name)}" alt="${p.author.name}">
          <div>
            <div class="owner-name">${escapeHtml(p.author.name)}</div>
            <div class="post-meta">${new Date(p.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <div class="post-text">${escapeHtml(p.text)}</div>
        ${p.category ? `<div class="tags"><span class="tag">${escapeHtml(p.category)}</span>${p.subcategory ? `<span class=\"tag\">${escapeHtml(p.subcategory)}</span>` : ''}</div>` : ''}
        ${p.videoName ? `<div class="post-meta">Attached video: ${escapeHtml(p.videoName)}</div>` : ''}
        <div class="post-actions">
          <button class="btn btn-secondary btn-sm btn-toggle-comments">Коментари</button>
        </div>
        <div class="comments-section hidden">
          <div class="comments-controls">
            <label>
              <span>Подреди:</span>
              <select class="comment-sort">
                <option value="desc">Най-нови първо</option>
                <option value="asc">Най-стари първо</option>
              </select>
            </label>
          </div>
          <div class="comments-list"></div>
          <form class="comment-form">
            <input type="text" class="comment-input" placeholder="Напиши коментар...">
            <button type="submit" class="btn btn-sm">Публикувай</button>
          </form>
        </div>
      `;
      el.setAttribute('data-post-id', p.id);
      frag.appendChild(el);
    });
    postsList.appendChild(frag);
  }

  async function toggleComments(button) {
    const postCard = button.closest('.post-card');
    const commentsSection = postCard.querySelector('.comments-section');
    const commentsList = postCard.querySelector('.comments-list');
    const postId = postCard.dataset.postId;

    const isHidden = commentsSection.classList.toggle('hidden');

    if (!isHidden) {
      // Initialize pagination state if not exists
      if (!commentPaginationState[postId]) {
        commentPaginationState[postId] = { currentPage: 1, totalPages: 1, totalComments: 0 };
      }
      if (!commentSortOrder[postId]) {
        commentSortOrder[postId] = 'desc';
      }
      const sortSelect = commentsSection.querySelector('.comment-sort');
      if (sortSelect) {
        sortSelect.value = commentSortOrder[postId];
      }
      // Always reload comments when opening
      commentsList.innerHTML = '<div class="muted">Зареждане на коментари...</div>';
      try {
        const state = commentPaginationState[postId];
        const sortOrder = commentSortOrder[postId] || 'desc';
        const data = await fetchComments(postId, state.currentPage, 5, sortOrder);
        state.totalPages = data.totalPages;
        state.totalComments = data.total;
        renderComments(data.comments, commentsList, postId, state);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
        commentsList.innerHTML = '<div class="muted">Неуспешно зареждане на коментарите.</div>';
      }
    }
  }

  async function fetchComments(postId, page = 1, size = 5, sortOrder = 'desc') {
    const url = `${BACKEND_URL}/posts/${postId}/comments?page=${page}&size=${size}&sortOrder=${sortOrder}`;
    const resp = await fetch(url, { headers: { 'accept': '*/*', ...getAuthHeaders() } });
    if (!resp.ok) throw new Error('Failed to fetch comments');
    const data = await resp.json();
    
    // Handle array response (legacy format)
    if (Array.isArray(data)) {
      const totalPages = Math.ceil(data.length / size);
      return { comments: data, total: data.length, totalPages: totalPages };
    }
    
    // Handle backend response format: { comments: [...], total: number, totalPages: number }
    const comments = data.comments || [];
    const total = data.total || 0;
    const totalPages = data.totalPages || (total > 0 ? Math.ceil(total / size) : 1);
    
    return {
      comments: comments,
      total: total,
      totalPages: totalPages
    };
  }

  function renderComments(comments, commentsListEl, postId, paginationState) {
    commentsListEl.innerHTML = '';
    if (!comments.length) {
      commentsListEl.innerHTML = '<div class="muted">Все още няма коментари.</div>';
      // Still show pagination if there are pages
      if (paginationState && paginationState.totalPages > 1) {
        renderCommentPagination(commentsListEl.parentElement, postId, paginationState);
      }
      return;
    }

    const frag = document.createDocumentFragment();
    comments.forEach(comment => {
      const el = document.createElement('div');
      el.className = 'comment-card';
      el.setAttribute('data-comment-id', comment.id);
      const authorName = comment.authorName || comment.userName || 'Потребител';
      // Check if current user owns this comment - compare both userId and userName
      const isOwner = authState && (
        (comment.userId && String(comment.userId) === String(authState.userId)) ||
        (comment.userName && comment.userName === authState.name) ||
        (comment.authorName && comment.authorName === authState.name)
      );
      
      el.innerHTML = `
        <div class="comment-content">
          <div class="comment-header">
            <div class="comment-author">${escapeHtml(authorName)}</div>
            ${isOwner ? `
              <div class="comment-actions">
                <button class="btn-link btn-edit-comment" data-comment-id="${comment.id}" title="Редактирай">✏️</button>
                <button class="btn-link btn-delete-comment" data-comment-id="${comment.id}" title="Изтрий">🗑️</button>
              </div>
            ` : ''}
          </div>
          <div class="comment-text" data-comment-text="${comment.id}">${escapeHtml(comment.commentText)}</div>
          <div class="comment-meta">${comment.createdAt ? new Date(comment.createdAt).toLocaleString('bg-BG') : ''}</div>
        </div>
      `;
      frag.appendChild(el);
    });
    commentsListEl.appendChild(frag);
    
    // Render pagination if needed
    if (paginationState && paginationState.totalPages > 1) {
      renderCommentPagination(commentsListEl.parentElement, postId, paginationState);
    } else {
      // Remove pagination if it exists
      const existingPagination = commentsListEl.parentElement.querySelector('.comments-pagination');
      if (existingPagination) {
        existingPagination.remove();
      }
    }
  }
  
  function renderCommentPagination(commentsSection, postId, paginationState) {
    // Remove existing pagination
    const existing = commentsSection.querySelector('.comments-pagination');
    if (existing) existing.remove();
    
    const paginationEl = document.createElement('div');
    paginationEl.className = 'comments-pagination';
    paginationEl.innerHTML = `
      <button class="btn btn-secondary btn-sm btn-comments-prev" ${paginationState.currentPage <= 1 ? 'disabled' : ''}>Предишна</button>
      <span class="muted" style="margin: 0 8px;">Страница ${paginationState.currentPage} от ${paginationState.totalPages}</span>
      <button class="btn btn-secondary btn-sm btn-comments-next" ${paginationState.currentPage >= paginationState.totalPages ? 'disabled' : ''}>Следваща</button>
    `;
    
    // Insert before comment form
    const commentForm = commentsSection.querySelector('.comment-form');
    commentsSection.insertBefore(paginationEl, commentForm);
    
    // Add event listeners
    const prevBtn = paginationEl.querySelector('.btn-comments-prev');
    const nextBtn = paginationEl.querySelector('.btn-comments-next');
    
    prevBtn.addEventListener('click', async () => {
      if (paginationState.currentPage > 1) {
        paginationState.currentPage--;
        const commentsList = commentsSection.querySelector('.comments-list');
        commentsList.innerHTML = '<div class="muted">Зареждане на коментари...</div>';
        try {
          const sortOrder = commentSortOrder[postId] || 'desc';
          const data = await fetchComments(postId, paginationState.currentPage, 5, sortOrder);
          paginationState.totalPages = data.totalPages;
          paginationState.totalComments = data.total;
          renderComments(data.comments, commentsList, postId, paginationState);
        } catch (error) {
          console.error('Failed to fetch comments:', error);
          commentsList.innerHTML = '<div class="muted">Неуспешно зареждане на коментарите.</div>';
        }
      }
    });
    
    nextBtn.addEventListener('click', async () => {
      if (paginationState.currentPage < paginationState.totalPages) {
        paginationState.currentPage++;
        const commentsList = commentsSection.querySelector('.comments-list');
        commentsList.innerHTML = '<div class="muted">Зареждане на коментари...</div>';
        try {
          const sortOrder = commentSortOrder[postId] || 'desc';
          const data = await fetchComments(postId, paginationState.currentPage, 5, sortOrder);
          paginationState.totalPages = data.totalPages;
          paginationState.totalComments = data.total;
          renderComments(data.comments, commentsList, postId, paginationState);
        } catch (error) {
          console.error('Failed to fetch comments:', error);
          commentsList.innerHTML = '<div class="muted">Неуспешно зареждане на коментарите.</div>';
        }
      }
    });
  }

  postsList.addEventListener('submit', (e) => {
    const form = e.target.closest('.comment-form');
    if (form) {
      e.preventDefault();
      onCommentSubmit(form);
    }
  });

  async function onCommentSubmit(form) {
    const postCard = form.closest('.post-card');
    const postId = postCard.dataset.postId;
    const input = form.querySelector('.comment-input');
    const text = input.value.trim();

    if (!text) return;

    if (!authState) {
      openAuthModal('Влез');
      return;
    }

    try {
      const url = `${BACKEND_URL}/comments`;
      const userId = (() => {
        let raw = authState.userId ?? Math.floor(Math.random() * 1000000);
        let str = String(raw).replace(/\D/g, ''); // digits only
        if (str.length > 18) str = str.slice(-18); // keep last 18 digits
        return str;
      })();

      const payload = {
        postId: Number(postId),
        userId: Number(userId),
        commentText: text,
        userName: authState.name
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error('Failed to post comment');
      }
      const respData = await resp.json();

      // Ensure the response includes userId for ownership checks
      const newCommentForRender = { 
        ...respData,
        userId: respData.userId || userId,
        authorName: authState.name,
        userName: authState.name
      };

      const commentsList = postCard.querySelector('.comments-list');
      
      // Reset to first page and reload comments
      if (!commentPaginationState[postId]) {
        commentPaginationState[postId] = { currentPage: 1, totalPages: 1, totalComments: 0 };
      }
      commentPaginationState[postId].currentPage = 1;
      
      // Reload comments to show the new one
      commentsList.innerHTML = '<div class="muted">Зареждане на коментари...</div>';
      try {
        const state = commentPaginationState[postId];
        const sortOrder = commentSortOrder[postId] || 'desc';
        const data = await fetchComments(postId, state.currentPage, 5, sortOrder);
        state.totalPages = data.totalPages;
        state.totalComments = data.total;
        renderComments(data.comments, commentsList, postId, state);
      } catch (error) {
        console.error('Failed to reload comments:', error);
      }
      
      input.value = '';
      showToast('Вашият коментар беше публикуван.');

    } catch (error) {
      console.error('Failed to submit comment:', error);
      showToast('Неуспешно изпращане на коментар.');
    }
  }

  async function handleEditComment(commentId) {
    const commentCard = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (!commentCard) return;
    
    const commentTextEl = commentCard.querySelector('[data-comment-text]');
    const currentText = commentTextEl.textContent;
    
    // Create edit input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'comment-input';
    editInput.value = currentText;
    editInput.style.width = '100%';
    editInput.style.marginTop = '8px';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-sm';
    saveBtn.textContent = 'Запази';
    saveBtn.style.marginTop = '8px';
    saveBtn.style.marginRight = '8px';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = 'Отказ';
    cancelBtn.style.marginTop = '8px';
    
    const originalText = commentTextEl.innerHTML;
    commentTextEl.innerHTML = '';
    commentTextEl.appendChild(editInput);
    commentTextEl.appendChild(saveBtn);
    commentTextEl.appendChild(cancelBtn);
    editInput.focus();
    
    const cleanup = () => {
      commentTextEl.innerHTML = originalText;
    };
    
    saveBtn.addEventListener('click', async () => {
      const newText = editInput.value.trim();
      if (!newText) {
        showToast('Коментарът не може да бъде празен.');
        return;
      }
      
      try {
        await updateComment(commentId, newText);
        commentTextEl.innerHTML = escapeHtml(newText);
        showToast('Коментарът беше обновен.');
      } catch (error) {
        console.error('Failed to update comment:', error);
        showToast('Неуспешно обновяване на коментар.');
        cleanup();
      }
    });
    
    cancelBtn.addEventListener('click', cleanup);
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    });
  }

  async function handleDeleteComment(commentId) {
    if (!confirm('Сигурни ли сте, че искате да изтриете този коментар?')) {
      return;
    }
    
    try {
      await deleteComment(commentId);
      const commentCard = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (commentCard) {
        const postCard = commentCard.closest('.post-card');
        const postId = postCard.dataset.postId;
        const commentsList = postCard.querySelector('.comments-list');
        const commentsSection = postCard.querySelector('.comments-section');
        
        // Reload comments
        commentsList.innerHTML = '<div class="muted">Зареждане на коментари...</div>';
        const state = commentPaginationState[postId] || { currentPage: 1, totalPages: 1, totalComments: 0 };
        const sortOrder = commentSortOrder[postId] || 'desc';
        const data = await fetchComments(postId, state.currentPage, 5, sortOrder);
        state.totalPages = data.totalPages;
        state.totalComments = data.total;
        renderComments(data.comments, commentsList, postId, state);
        
        showToast('Коментарът беше изтрит.');
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      showToast('Неуспешно изтриване на коментар.');
    }
  }

  async function updateComment(commentId, newText) {
    const url = `${BACKEND_URL}/comments/${commentId}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ commentText: newText })
    });
    if (!resp.ok) throw new Error('Failed to update comment');
    return resp.json();
  }

  async function deleteComment(commentId) {
    const url = `${BACKEND_URL}/comments/${commentId}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'accept': '*/*',
        ...getAuthHeaders()
      }
    });
    if (!resp.ok) throw new Error('Failed to delete comment');
  }

  function filterByCategory(categoryKey) {
    // Show posts section
    if (composer) composer.classList.add('hidden');
    if (servicesView) servicesView.classList.add('hidden');
    if (postsList) postsList.classList.remove('hidden');
    // Simple filter: reorder posts so matching category appear first
    const [match, rest] = posts.reduce((acc, p) => {
      (p.category === categoryKey ? acc[0] : acc[1]).push(p);
      return acc;
    }, [[], []]);
    postsList.innerHTML = '';
    const frag = document.createDocumentFragment();
    [...match, ...rest].forEach(p => {
      const el = document.createElement('div');
      el.className = 'post-card';
      el.innerHTML = `
        <div class="post-header">
          <img class="avatar" src="${p.author.photoUrl || getAvatarPlaceholder(p.author.name)}" alt="${p.author.name}">
          <div>
            <div class="owner-name">${escapeHtml(p.author.name)}</div>
            <div class="post-meta">${new Date(p.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <div class="post-text">${escapeHtml(p.text)}</div>
        ${p.category ? `<div class="tags"><span class="tag">${escapeHtml(p.category)}</span>${p.subcategory ? `<span class=\"tag\">${escapeHtml(p.subcategory)}</span>` : ''}</div>` : ''}
      `;
      frag.appendChild(el);
    });
    postsList.appendChild(frag);
  }

  function showSection(section) {
    // default hidden
    if (composer) composer.classList.add('hidden');
    if (servicesView) servicesView.classList.add('hidden');
    if (datingView) datingView.classList.add('hidden');
    if (settingsView) settingsView.classList.add('hidden');
    if (postsList) postsList.classList.add('hidden');
    if (postsPagination) postsPagination.classList.add('hidden');

    if (section === 'create') {
      if (composer) composer.classList.remove('hidden');
    } else if (section === 'services') {
  if (servicesView) servicesView.classList.remove('hidden');
  // Reset remote selection and hide posts pagination on services
  currentRemoteCategory = '';
  currentRemotePage = 1;
  totalRemotePages = 1;
  totalRemotePosts = 0;
  if (postsPagination) postsPagination.classList.add('hidden');
    } else if (section === 'dating') {
      if (datingView) datingView.classList.remove('hidden');
    } else if (section === 'settings') {
      if (settingsView) settingsView.classList.remove('hidden');
    } else {
      if (postsList) postsList.classList.remove('hidden');
      if (currentRemoteCategory) {
        fetchAndRenderRemotePosts();
      } else {
        if (postsPagination) postsPagination.classList.add('hidden');
      }
    }
  }

  // ---------- Remote Posts (Posts page) with Pagination ----------
  let currentRemoteCategory = '';
  let currentRemotePage = 1;
  const pageSize = 5;
  // Track the highest page reached and if last page was reached
  let totalRemotePosts = 0;
  let totalRemotePages = 1;

  function getCategoryLabelFromKey(key) {
    const map = new Map(CATEGORY_LABELS);
    return map.get(key) || key;
  }

  function getApiCategoryParam(key) {
    // The API expects capitalized labels like "Finance"
    const label = getCategoryLabelFromKey(key);
    return label;
  }

  async function fetchServicePosts(categoryKey, page) {
    const apiCat = getApiCategoryParam(categoryKey);
  const url = `${BACKEND_URL}/posts/category/${encodeURIComponent(apiCat)}?page=${page}&size=${pageSize}`;
    const resp = await fetch(url, { headers: { 'accept': '*/*', ...getAuthHeaders() } });
    if (!resp.ok) throw new Error('Failed to fetch service posts');
    return resp.json();
  }

  async function fetchAndRenderRemotePosts() {
    if (!postsList || !currentRemoteCategory) return;
    postsList.innerHTML = '<div class="muted">Зарежда се…</div>';
    try {
      const data = await fetchServicePosts(currentRemoteCategory, currentRemotePage);
      // Expect data to be { posts: [...], total: number }
      let arr = [];
      if (Array.isArray(data)) {
        arr = data;
        totalRemotePosts = arr.length;
        totalRemotePages = 1;
      } else {
        arr = Array.isArray(data.posts) ? data.posts : [];
        totalRemotePosts = typeof data.total === 'number' ? data.total : arr.length;
        totalRemotePages = Math.max(1, Math.ceil(totalRemotePosts / pageSize));
      }
      renderRemotePosts(arr);
      updatePostsPagination(arr.length);
    } catch (e) {
      console.error(e);
      postsList.innerHTML = '<div class="muted">Неуспешно зареждане на публикациите.</div>';
      updatePostsPagination(0);
    }
  }

  function renderRemotePosts(items) {
    postsList.innerHTML = '';
    if (!items.length) {
      postsList.innerHTML = '<div class="muted">Няма публикации в тази категория.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(p => {
      const el = document.createElement('div');
      el.className = 'post-card';
      el.innerHTML = `
        <div class="post-header">
          <div>
            <div class="owner-name">${escapeHtml(String(p.facebookName || p.userId || ''))}</div>
            <div class="post-meta">${escapeHtml(String(p.category || ''))} ${p.subcategory ? '• ' + escapeHtml(String(p.subcategory)) : ''}</div>
          </div>
        </div>
        <div class="post-text">${escapeHtml(String(p.postText || ''))}</div>
        <div class="post-media"></div>
        <div class="post-meta">${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</div>
        <div class="post-actions">
          <button class="btn btn-secondary btn-sm btn-toggle-comments">Коментари</button>
        </div>
        <div class="comments-section hidden">
          <div class="comments-controls">
            <label>
              <span>Подреди:</span>
              <select class="comment-sort">
                <option value="desc">Най-нови първо</option>
                <option value="asc">Най-стари първо</option>
              </select>
            </label>
          </div>
          <div class="comments-list"></div>
          <form class="comment-form">
            <input type="text" class="comment-input" placeholder="Напиши коментар...">
            <button type="submit" class="btn btn-sm">Публикувай</button>
          </form>
        </div>
      `;
      el.setAttribute('data-post-id', p.id);

      const fileName = (p.videoUrl || p.videoLink || '').toString().trim();
      if (fileName) {
        attachSignedVideoToCard(el.querySelector('.post-media'), fileName).catch(err => {
          console.error('Failed to attach video', err);
        });
      }
      frag.appendChild(el);
    });
    postsList.appendChild(frag);
  }

  async function requestSignedDownloadUrl(fileName) {
  const url = BACKEND_URL + '/api/v1/videos/download-url';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'accept': '*/*', 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ fileName })
    });
    if (!resp.ok) throw new Error('Failed to get signed download URL');
    return resp.json();
  }

  async function attachSignedVideoToCard(container, fileName) {
    if (!container) return;
    container.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:#64748b;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke="#cbd5e1" stroke-width="3"></circle><path d="M22 12a10 10 0 0 1-10 10" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"></path></svg><span>Зарежда се видео…</span></div>';
    try {
      const meta = await requestSignedDownloadUrl(fileName);
      const signed = meta.downloadUrl || meta.signedUrl || meta.url;
      if (!signed) throw new Error('No signed URL in response');
      const vResp = await fetch(signed);
      if (!vResp.ok) throw new Error('Video download failed');
      const blob = await vResp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const vid = document.createElement('video');
      vid.controls = true;
      vid.src = objectUrl;
      vid.style.width = '360px';
      vid.style.maxWidth = '100%';
      vid.style.height = 'auto';
      vid.style.borderRadius = '8px';
      vid.style.display = 'block';
      vid.preload = 'metadata';
      container.innerHTML = '';
      container.appendChild(vid);
    } catch (e) {
      container.innerHTML = '<div class="muted">Не може да се зареди видеото.</div>';
      throw e;
    }
  }

  function showGlobalSpinner(show) {
    if (!globalSpinner) return;
    if (show) {
      globalSpinner.classList.remove('hidden');
      globalSpinner.setAttribute('aria-hidden', 'false');
    } else {
      globalSpinner.classList.add('hidden');
      globalSpinner.setAttribute('aria-hidden', 'true');
    }
  }

  function updatePostsPagination(returnedCount) {
    if (!postsPagination || !postsPrev || !postsNext || !postsPage) return;
    // Show only when a remote category is selected from Services
    if (!currentRemoteCategory) {
      postsPagination.classList.add('hidden');
      return;
    }
    if (returnedCount === 0) {
      postsPagination.classList.add('hidden');
      return;
    } else {
      postsPagination.classList.remove('hidden');
    }
    // Use totalRemotePages for total pages
    postsPage.textContent = `Страница ${currentRemotePage} от ${totalRemotePages}`;
    // Disable both arrows if only one page
    if (totalRemotePages === 1) {
      postsPrev.disabled = true;
      postsNext.disabled = true;
    } else {
      postsPrev.disabled = currentRemotePage <= 1;
      postsNext.disabled = currentRemotePage >= totalRemotePages;
    }
  }

  if (postsPrev) {
    postsPrev.addEventListener('click', () => {
      if (currentRemotePage > 1) {
        currentRemotePage -= 1;
        fetchAndRenderRemotePosts();
      }
    });
  }

  if (postsNext) {
    postsNext.addEventListener('click', () => {
      if (currentRemotePage < totalRemotePages) {
        currentRemotePage += 1;
        fetchAndRenderRemotePosts();
      }
    });
  }

  // Ensure pagination hidden by default until a category is chosen
  if (postsPagination) postsPagination.classList.add('hidden');

  function signOut() {
    authState = null;
    saveToStorage(STORAGE_KEYS.auth, authState);
    renderAuthUI();
  }

  // ---------- Skills ----------
  function onCreateSkill(e) {
    e.preventDefault();
    if (!authState) return alert('Моля, влезте, за да споделите умение.');
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
        id: String(authState.userId),
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
    if (!authState) { openAuthModal('Влез'); return; }
    if (!amount || amount <= 0) return alert('Въведете валидна сума за бакшиш.');
    const idx = skills.findIndex(s => s.id === skillId);
    if (idx === -1) return;
    skills[idx].tips.push({
      by: { name: authState.name, photoUrl: authState.photoUrl },
      amount,
      note: '',
      at: Date.now()
    });
    saveToStorage(STORAGE_KEYS.skills, skills);
    alert(`Благодарим! Дадохте бакшиш от ${formatCurrency(amount)} на ${skills[idx].owner.name}.`);
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
    if (googleInited) return;
    // Preload Google Identity Services if needed (SDK loaded in index.html)
    googleInited = true;
  }

  function onGoogleSignInClick() {
    const clientId = window.UNITEDSEEDS_GOOGLE_CLIENT_ID;
    if (!clientId || clientId.startsWith('YOUR_')) {
      alert('Google входът не е конфигуриран. Задайте UNITEDSEEDS_GOOGLE_CLIENT_ID в app.js');
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      alert('Google Identity Services SDK не е зареден.');
      return;
    }
    // Use Google Identity Services to get access token
    window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          try {
            const user = await fetchGoogleUser(tokenResponse.access_token);
            signInWithProfile({
              provider: 'google',
              userId: user.sub,
              email: user.email || '',
              name: user.name,
              photoUrl: user.picture,
              accessToken: tokenResponse.access_token
            });
            closeAuthModal();
          } catch (e) {
            console.error('Google user fetch failed', e);
            alert('Входът с Google не беше успешен.');
          }
        } else {
          alert('Входът с Google беше отменен или неуспешен.');
        }
      }
    }).requestAccessToken();
  }

// google oauth link removed

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
      alert('Facebook входът не е конфигуриран. Задайте UNITEDSEEDS_FACEBOOK_APP_ID в index.html');
      return;
    }
    /* global FB */
    FB.login(function(response) {
      if (response && response.authResponse) {
        (async function() {
          try {
            const user = await fetchFacebookUser();
            const accessToken = response.authResponse.accessToken;
            // Fetch the user's picture using the Graph API and access token
            const pictureUrl = await fetchFacebookPicture(user.id, accessToken);
            signInWithProfile({
              provider: 'facebook',
              userId: user.id,
              email: user.email || '',
              name: user.name,
              photoUrl: pictureUrl,
              accessToken: accessToken
            });
  // Fetch Facebook user picture using Graph API and access token
  async function fetchFacebookPicture(userId, accessToken) {
    try {
      const resp = await fetch(`https://graph.facebook.com/${userId}/picture?type=large&redirect=false&access_token=${accessToken}`);
      const data = await resp.json();
      if (data && data.data && data.data.url) {
        return data.data.url;
      }
      return '';
    } catch (e) {
      console.error('Failed to fetch Facebook picture', e);
      return '';
    }
  }
          } catch (e) {
            console.error('FB user fetch failed', e);
            alert('Входът с Facebook не беше успешен.');
          }
        })();
      } else {
        console.warn('User cancelled FB login or did not fully authorize.');
      }
    }, { scope: 'public_profile' });
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


