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
    // google login removed
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

  function setupCategories() {
    if (!postCategory || !postSubcategory) return;
    postCategory.innerHTML = CATEGORY_LABELS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    postCategory.addEventListener('change', () => populateSubcategories(postCategory.value));
    populateSubcategories(CATEGORY_LABELS[0][0]);
  }

  function populateSubcategories(categoryKey) {
    if (!postSubcategory) return;
    const subs = SUBCATEGORY_MAP[categoryKey] || [];
    postSubcategory.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
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
      // Hide all pre-login sections for a clean app shell view
      const hero = document.getElementById('hero');
      const skillsSection = document.getElementById('skills');
      if (hero) hero.classList.add('hidden');
      if (skillsSection) skillsSection.classList.add('hidden');
      appShell.classList.remove('hidden');
      createSkill.classList.add('hidden');
      profilePic.src = authState.photoUrl || '';
      profileName.textContent = authState.name || '';
      profileEmail.textContent = authState.email || '';
      renderPosts();
    } else {
      authOutEl.classList.remove('hidden');
      authInEl.classList.add('hidden');
      landing.classList.remove('hidden');
      const hero = document.getElementById('hero');
      const skillsSection = document.getElementById('skills');
      if (hero) hero.classList.remove('hidden');
      if (skillsSection) skillsSection.classList.remove('hidden');
      appShell.classList.add('hidden');
      createSkill.classList.add('hidden');
      profilePic.src = '';
      profileName.textContent = '';
      profileEmail.textContent = '';
    }
  }

  // ---------- Posts ----------
  const POSTS_KEY = 'unitedseeds.posts';
  let posts = loadFromStorage(POSTS_KEY, []);

  async function onCreatePost() {
    if (!authState) { openAuthModal('Sign in'); return; }
    const text = (postText.value || '').trim();
    if (!text) return;
    const post = {
      id: generateId('post'),
      text,
      category: postCategory ? postCategory.value : '',
      subcategory: postSubcategory ? postSubcategory.value : '',
      videoName: (postVideo && postVideo.files && postVideo.files[0]) ? postVideo.files[0].name : '',
      author: { name: authState.name, photoUrl: authState.photoUrl },
      createdAt: Date.now()
    };
    posts.unshift(post);
    saveToStorage(POSTS_KEY, posts);
    postText.value = '';
    renderPosts();

    // Additionally send to external API as per requirement
    try {
      const apiBase = 'https://united-seeds-118701076488.europe-central2.run.app/posts';
      // Map internal values to API contract
      const categoryKeyToLabel = new Map(CATEGORY_LABELS);
      const categoryLabel = categoryKeyToLabel.get(post.category) || post.category || '';
      const twoDigit = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return Math.floor(Math.random() * 100);
        return Math.abs(num) % 100; // 0..99
      };

      // If a video file is selected, upload to GCS using a signed URL first
      let uploadedVideoFullName = '';
      let uploadedVideoPublicUrl = '';
      const file = (postVideo && postVideo.files && postVideo.files[0]) ? postVideo.files[0] : null;
      if (file) {
        try {
          const up = await uploadVideoAndGetPublicUrl(file);
          uploadedVideoFullName = up.fullName || '';
          uploadedVideoPublicUrl = up.publicUrl || '';
        } catch (e) {
          console.error('Video upload failed, proceeding without video', e);
        }
      }

      const payload = {
        id: twoDigit(Math.floor(Date.now() / 1000)),
        userId: twoDigit(authState.userId ?? Math.floor(Math.random() * 1000000)),
        category: categoryLabel || '',
        subcategory: post.subcategory || '',
        // Send only the returned full name of the uploaded video as requested
        videoUrl: uploadedVideoFullName || '',
        postText: text,
        createdAt: new Date().toISOString()
      };
      const resp = await fetch(`${apiBase}`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        showToast('Your post has been submitted successfully.');
      }
      // Optional UX: notify success without blocking UI
      console.info('Post sent to API', payload);
    } catch (err) {
      console.error('Failed to send post to API', err);
      // Keep local success even if network fails
    }
  }

  function getFileExtension(name) {
    const idx = (name || '').lastIndexOf('.');
    if (idx === -1) return '';
    return name.slice(idx + 1).toLowerCase();
  }

  async function requestSignedUploadUrl(fileName, contentTypeHint) {
    const url = 'https://united-seeds-118701076488.europe-central2.run.app/api/v1/videos/upload-url';
    const body = {
      fileName: fileName,
      contentType: contentTypeHint
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'accept': '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('Failed to get signed upload URL');
    return resp.json();
  }

  async function uploadVideoAndGetPublicUrl(file) {
    const name = file.name || 'video';
    const ext = getFileExtension(name) || (file.type ? file.type.split('/')[1] : 'mp4');
    const hint = ext || 'mp4';
    const meta = await requestSignedUploadUrl(name, hint);
    const signedUrl = meta.uploadUrl || meta.signedUrl || meta.url;
    if (!signedUrl) throw new Error('Signed URL missing in response');
    const putResp = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
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
      `;
      frag.appendChild(el);
    });
    postsList.appendChild(frag);
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
      // Do not fetch remote posts here anymore
      // Reset remote selection and hide posts pagination on services
      currentRemoteCategory = '';
      currentRemotePage = 1;
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
  const pageSize = 10;

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
    const url = `https://united-seeds-118701076488.europe-central2.run.app/posts/category/${encodeURIComponent(apiCat)}?page=${page}&size=${pageSize}`;
    const resp = await fetch(url, { headers: { 'accept': '*/*' } });
    if (!resp.ok) throw new Error('Failed to fetch service posts');
    return resp.json();
  }

  async function fetchAndRenderRemotePosts() {
    if (!postsList || !currentRemoteCategory) return;
    postsList.innerHTML = '<div class="muted">Loading…</div>';
    try {
      const data = await fetchServicePosts(currentRemoteCategory, currentRemotePage);
      const arr = Array.isArray(data) ? data : [];
      renderRemotePosts(arr);
      updatePostsPagination(arr.length);
    } catch (e) {
      console.error(e);
      postsList.innerHTML = '<div class="muted">Failed to load posts.</div>';
      updatePostsPagination(0);
    }
  }

  function renderRemotePosts(items) {
    postsList.innerHTML = '';
    if (!items.length) {
      postsList.innerHTML = '<div class="muted">No posts in this category.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(p => {
      const el = document.createElement('div');
      el.className = 'post-card';
      el.innerHTML = `
        <div class="post-header">
          <div>
            <div class="owner-name">User ${escapeHtml(String(p.userId ?? ''))}</div>
            <div class="post-meta">${escapeHtml(String(p.category || ''))} ${p.subcategory ? '• ' + escapeHtml(String(p.subcategory)) : ''}</div>
          </div>
        </div>
        <div class="post-text">${escapeHtml(String(p.postText || ''))}</div>
        ${p.videoUrl ? `<div class="post-meta">Video: <a href="${escapeHtml(String(p.videoUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(p.videoUrl))}</a></div>` : ''}
        <div class="post-meta">${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</div>
      `;
      frag.appendChild(el);
    });
    postsList.appendChild(frag);
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
    postsPage.textContent = `Page ${currentRemotePage}`;
    postsPrev.disabled = currentRemotePage <= 1;
    postsNext.disabled = returnedCount < pageSize;
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
      currentRemotePage += 1;
      fetchAndRenderRemotePosts();
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
      alert('Facebook Login not configured. Set UNITEDSEEDS_FACEBOOK_APP_ID in index.html');
      return;
    }
    /* global FB */
    FB.login(function(response) {
      if (response && response.authResponse) {
        (async function() {
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


