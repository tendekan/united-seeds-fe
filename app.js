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

(function () {
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

  // Centralized fetch wrapper that handles token expiration
  async function authenticatedFetch(url, options = {}) {
    const response = await fetch(url, options);

    // Check if the response is 401 Unauthorized
    if (response.status === 401) {
      console.warn('Token expired or unauthorized. Logging out user.');

      // Clear auth state and redirect to login
      authState = null;
      saveToStorage(STORAGE_KEYS.auth, authState);
      resetLikeCaches();
      renderAuthUI();

      // Show a toast message to inform the user
      showToast('Вашата сесия е изтекла. Моля, влезте отново.', 'error');

      // Optionally open the auth modal
      if (typeof openAuthModal === 'function') {
        setTimeout(() => openAuthModal('Влез'), 500);
      }
    }

    return response;
  }

  function generateId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  function formatCurrency(amount) {
    const n = Number(amount || 0);
    return `$${n.toFixed(2)}`;
  }

  function buildLikesLabel(count) {
    const safeCount = Number(count) || 0;
    const noun = safeCount === 1 ? 'човек' : 'човека';
    return `Харесано от <span class="like-count-badge">${safeCount}</span> ${noun}`;
  }

  function getSafeUserId() {
    if (!authState) return null;
    const raw = authState.serverUserId ?? authState.userId ?? '';
    const normalized = normalizeUserId(raw);
    if (normalized) return normalized;
    return String(Math.floor(Math.random() * 1000000));
  }

  function canUseBackendId(id) {
    return /^[0-9]+$/.test(String(id || '').trim());
  }

  function normalizeUserId(id) {
    if (id === undefined || id === null) return '';
    return String(id);
  }

  function updateStoredCanonicalUserId(rawId) {
    if (!authState) return;
    const normalized = normalizeUserId(rawId);
    if (!normalized || authState.serverUserId === normalized) return;
    authState.serverUserId = normalized;
    saveToStorage(STORAGE_KEYS.auth, authState);
  }

  // ---------- App State ----------
  let authState = loadFromStorage(STORAGE_KEYS.auth, null);
  let skills = loadFromStorage(STORAGE_KEYS.skills, []);
  const postLikeState = {};
  const postCommentCountState = {};
  const postRetweetState = {};
  const commentLikeState = {};
  const postOwnerCache = {};
  const postDataCache = {};
  const profilePhotoCache = {};
  const profilePhotoPending = {};
  let activeProfileUserId = null;
  let activeProfileData = null;
  let activeProfileDisplayName = '';
  let isViewingOwnProfile = false;
  let isProfileEditing = false;

  function resetLikeCaches() {
    Object.keys(postLikeState).forEach(key => delete postLikeState[key]);
    Object.keys(postCommentCountState).forEach(key => delete postCommentCountState[key]);
    Object.keys(postRetweetState).forEach(key => delete postRetweetState[key]);
    Object.keys(commentLikeState).forEach(key => delete commentLikeState[key]);
    Object.keys(postOwnerCache).forEach(key => delete postOwnerCache[key]);
    clearProfilePhotoCache();
  }

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
  const profilePhotoDisplay = document.getElementById('profile-photo-display');
  const profilePhotoUpload = document.getElementById('profile-photo-upload');

  const profilePhotoActions = document.getElementById('profile-photo-actions');

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
  const navProfile = document.getElementById('nav-profile');
  const navCreate = document.getElementById('nav-create');
  const navServices = document.getElementById('nav-services');
  const navDating = document.getElementById('nav-dating');
  const navSettings = document.getElementById('nav-settings');
  const profileView = document.getElementById('profile-view');
  const profileViewName = document.getElementById('profile-view-name');
  const profileViewMeta = document.getElementById('profile-view-meta');
  const btnProfileRefresh = document.getElementById('btn-profile-refresh');
  const profileSummary = document.getElementById('profile-summary');
  const profileBioDisplay = document.getElementById('profile-bio-display');
  const profileDobDisplay = document.getElementById('profile-dob-display');
  const profileResidencyDisplay = document.getElementById('profile-residency-display');
  const btnProfileEdit = document.getElementById('btn-profile-edit');
  const btnProfileSave = document.getElementById('btn-save-profile');
  const btnProfileCancel = document.getElementById('btn-cancel-profile');
  const profileEditActions = document.getElementById('profile-edit-actions');
  const profileBioInput = document.getElementById('profile-bio-input');
  const profileDobInput = document.getElementById('profile-dob-input');
  const profileResidencyInput = document.getElementById('profile-residency-input');
  const profilePostsList = document.getElementById('profile-posts-list');
  const profileRetweetsList = document.getElementById('profile-retweets-list');
  const profilePostsCount = document.getElementById('profile-posts-count');
  const profileRetweetsCount = document.getElementById('profile-retweets-count');
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
  const likesModal = document.getElementById('likes-modal');
  const likesModalClose = document.getElementById('likes-modal-close');
  const likesModalTitle = document.getElementById('likes-modal-title');
  const likesModalBody = document.getElementById('likes-modal-body');
  const photoModal = document.getElementById('photo-modal');
  const photoModalClose = document.getElementById('photo-modal-close');
  const photoModalImg = document.getElementById('photo-modal-img');

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
    attachPostEventDelegation(postsList);
    attachPostEventDelegation(profilePostsList);
    attachPostEventDelegation(profileRetweetsList);
  }


  function attachEvents() {
    if (btnOpenSignin) btnOpenSignin.addEventListener('click', () => openAuthModal('Влез'));
    if (btnOpenSignup) btnOpenSignup.addEventListener('click', () => openAuthModal('Регистрирай се'));
    if (navProfile) navProfile.addEventListener('click', onNavigateToOwnProfile);
    if (btnModalGoogle) btnModalGoogle.addEventListener('click', onGoogleSignInClick);
    if (btnModalFacebook) btnModalFacebook.addEventListener('click', onFacebookSignInClick);
    if (authModalClose) authModalClose.addEventListener('click', closeAuthModal);
    if (authModal) authModal.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute('data-close') === 'true') closeAuthModal();
    });
    if (likesModalClose) likesModalClose.addEventListener('click', closeLikesModal);
    if (likesModal) likesModal.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute('data-close') === 'true') closeLikesModal();
    });
    if (photoModalClose) photoModalClose.addEventListener('click', closePhotoModal);
    if (photoModal) photoModal.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute('data-close') === 'true') closePhotoModal();
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
    if (btnProfileEdit) btnProfileEdit.addEventListener('click', enterProfileEditMode);
    if (btnProfileSave) btnProfileSave.addEventListener('click', onProfileSave);
    if (btnProfileCancel) btnProfileCancel.addEventListener('click', () => {
      exitProfileEditMode();
      if (activeProfileData) {
        renderProfileView(activeProfileData);
      }
    });
    if (btnProfileRefresh) btnProfileRefresh.addEventListener('click', () => {
      if (activeProfileUserId) {
        openProfile(activeProfileUserId, { displayName: activeProfileDisplayName, forceReload: true });
      }
    });
    if (profilePhotoDisplay) profilePhotoDisplay.addEventListener('click', onProfilePhotoClick);
    if (profilePhotoUpload) profilePhotoUpload.addEventListener('change', onProfilePhotoSelected);

    setupCategories();
    setupServiceTileRouting();
    setupSettings();
    attachPostEventDelegation(postsList);
    attachPostEventDelegation(profilePostsList);
    attachPostEventDelegation(profileRetweetsList);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('.user-profile-link');
    if (!link) return;
    event.preventDefault();
    const userId = link.dataset.userRawId || link.dataset.userId;
    const encodedName = link.dataset.userName || '';
    const displayName = encodedName ? decodeURIComponent(encodedName) : link.textContent;
    if (userId) {
      openProfile(userId, { displayName, forceReload: true });
    } else {
      showToast('Профилът не е наличен.', 'error');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (target && target.classList && target.classList.contains('user-profile-link')) {
      event.preventDefault();
      target.click();
    }
  });

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

  function attachPostEventDelegation(root) {
    if (!root || root.__hasPostEvents) return;
    root.__hasPostEvents = true;
    root.addEventListener('click', handlePostRootClick);
    root.addEventListener('change', handlePostRootChange);
    root.addEventListener('submit', handlePostRootSubmit);
  }

  async function handlePostRootClick(event) {
    const root = event.currentTarget;
    const target = event.target;

    const toggleBtn = closestInRoot(target, '.btn-toggle-comments', root);
    if (toggleBtn) {
      event.preventDefault();
      toggleComments(toggleBtn);
      return;
    }

    const editBtn = closestInRoot(target, '.btn-edit-comment', root);
    if (editBtn) {
      event.preventDefault();
      await handleEditComment(editBtn.getAttribute('data-comment-id'));
      return;
    }

    const deleteBtn = closestInRoot(target, '.btn-delete-comment', root);
    if (deleteBtn) {
      event.preventDefault();
      await handleDeleteComment(deleteBtn.getAttribute('data-comment-id'));
      return;
    }

    const postLikeBtn = closestInRoot(target, '.btn-like-post', root);
    if (postLikeBtn) {
      event.preventDefault();
      await onPostLikeClick(postLikeBtn);
      return;
    }

    const retweetBtn = closestInRoot(target, '.btn-retweet-post', root);
    if (retweetBtn) {
      event.preventDefault();
      await onRetweetButtonClick(retweetBtn);
      return;
    }

    const editPostBtn = closestInRoot(target, '.btn-edit-post', root);
    if (editPostBtn) {
      event.preventDefault();
      await onPostEditClick(editPostBtn);
      return;
    }

    const deletePostBtn = closestInRoot(target, '.btn-delete-post', root);
    if (deletePostBtn) {
      event.preventDefault();
      await onPostDeleteClick(deletePostBtn);
      return;
    }

    const viewPostLikesBtn = closestInRoot(target, '.btn-view-post-likes', root);
    if (viewPostLikesBtn) {
      event.preventDefault();
      await showPostLikesModal(viewPostLikesBtn.dataset.postId);
      return;
    }

    const viewCommentLikesBtn = closestInRoot(target, '.btn-view-comment-likes', root);
    if (viewCommentLikesBtn) {
      event.preventDefault();
      await showCommentLikesModal(viewCommentLikesBtn.dataset.commentId);
      return;
    }

    const commentLikeBtn = closestInRoot(target, '.btn-like-comment', root);
    if (commentLikeBtn) {
      event.preventDefault();
      await onCommentLikeClick(commentLikeBtn);
    }
  }

  async function handlePostRootChange(event) {
    const root = event.currentTarget;
    const select = closestInRoot(event.target, '.comment-sort', root);
    if (!select) return;
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
      updatePostStatsDisplay(postId, { comments: state.totalComments });
    } catch (error) {
      console.error('Failed to change sort order:', error);
      commentsList.innerHTML = '<div class="muted">Неуспешно зареждане на коментарите.</div>';
    }
  }

  function handlePostRootSubmit(event) {
    const root = event.currentTarget;
    const form = closestInRoot(event.target, '.comment-form', root);
    if (!form) return;
    event.preventDefault();
    onCommentSubmit(form);
  }

  function closestInRoot(start, selector, root) {
    if (!start) return null;
    const el = start.closest(selector);
    return el && root.contains(el) ? el : null;
  }

  // ---------- Profiles ----------
  function onNavigateToOwnProfile() {
    if (!authState) {
      openAuthModal('Влез');
      return;
    }
    const userId = getSafeUserId();
    if (!userId) {
      showToast('Неуспешно зареждане на профила.', 'error');
      return;
    }
    activeProfileDisplayName = authState.name || '';
    openProfile(userId, { displayName: activeProfileDisplayName, forceReload: true });
  }

  async function openProfile(userId, { displayName = '', forceReload = false, skipCanonicalSync = false, keepLoadingState = false } = {}) {
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      showToast('Профилът не е наличен.', 'error');
      return;
    }
    const viewerId = normalizeUserId(getSafeUserId());
    const isOwnRequest = viewerId && viewerId === normalizedId;
    activeProfileUserId = normalizedId;
    if (displayName) {
      activeProfileDisplayName = displayName;
    } else if (isOwnRequest) {
      activeProfileDisplayName = authState?.name || '';
    } else {
      activeProfileDisplayName = '';
    }
    showSection('profile');
    if (!keepLoadingState) {
      setProfileLoadingState();
    }
    if (activeProfileData && !forceReload && normalizeUserId(activeProfileData.userId) === normalizedId) {
      renderProfileView(activeProfileData);
      return;
    }
    try {
      const profile = await fetchUserProfile(normalizedId);
      const canonicalId = normalizeUserId(profile?.userId);
      if (!skipCanonicalSync && canonicalId && canonicalId !== normalizedId) {
        activeProfileUserId = canonicalId;
        if (isOwnRequest) {
          updateStoredCanonicalUserId(canonicalId);
        }
        await openProfile(canonicalId, {
          displayName: activeProfileDisplayName || displayName,
          forceReload: true,
          skipCanonicalSync: true,
          keepLoadingState: true
        });
        return;
      }
      if (isOwnRequest && canonicalId) {
        updateStoredCanonicalUserId(canonicalId);
      }
      activeProfileUserId = canonicalId || normalizedId;
      activeProfileData = profile;
      renderProfileView(profile);
    } catch (error) {
      console.error('Failed to load profile', error);
      setProfileErrorState();
      showToast('Неуспешно зареждане на профила.', 'error');
    }
  }

  async function fetchUserProfile(userId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/users/${userId}/profile`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch profile');
    return resp.json();
  }

  async function updateUserProfile(userId, payload) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/users/${userId}/profile`, {
      method: 'PUT',
      headers: { 'accept': '*/*', 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Failed to update profile');
    return resp.json();
  }

  function syncProfileInputs(source) {
    if (profileBioInput) profileBioInput.value = source?.bio || '';
    if (profileDobInput) profileDobInput.value = source?.dateOfBirth || '';
    if (profileResidencyInput) profileResidencyInput.value = source?.residency || '';
  }

  function updateProfileEditControls() {
    if (profileSummary) profileSummary.classList.toggle('is-editing', isProfileEditing);
    if (profileEditActions) profileEditActions.classList.toggle('hidden', !isProfileEditing);
    if (btnProfileEdit) btnProfileEdit.classList.toggle('hidden', !isViewingOwnProfile || isProfileEditing);
  }

  function setProfileEditingState(enabled) {
    isProfileEditing = Boolean(enabled);
    updateProfileEditControls();
  }

  function enterProfileEditMode() {
    if (!isViewingOwnProfile) {
      showToast('Можете да редактирате само своя профил.', 'error');
      return;
    }
    syncProfileInputs(activeProfileData);
    setProfileEditingState(true);
  }

  function exitProfileEditMode() {
    setProfileEditingState(false);
  }

  async function onProfileSave(event) {
    if (event) event.preventDefault();
    if (!authState) {
      openAuthModal('Влез');
      return;
    }
    if (!isViewingOwnProfile) {
      showToast('Можете да редактирате само своя профил.', 'error');
      return;
    }
    const targetUserId = normalizeUserId(activeProfileUserId || activeProfileData?.userId || getSafeUserId());
    if (!targetUserId) {
      showToast('Профилът не е наличен.', 'error');
      return;
    }
    const payload = {
      bio: (profileBioInput?.value || '').trim(),
      dateOfBirth: profileDobInput?.value || null,
      residency: (profileResidencyInput?.value || '').trim()
    };
    showGlobalSpinner(true);
    try {
      const updated = await updateUserProfile(targetUserId, payload);
      activeProfileUserId = normalizeUserId(updated?.userId || targetUserId);
      activeProfileData = updated;
      renderProfileView(updated);
      showToast('Профилът беше обновен.');
      exitProfileEditMode();
    } catch (error) {
      console.error('Failed to update profile', error);
      showToast('Неуспешно обновяване на профила.', 'error');
    } finally {
      showGlobalSpinner(false);
    }
  }

  function renderProfileView(profile) {
    if (!profileView) return;
    const userId = profile?.userId ? String(profile.userId) : activeProfileUserId;
    const normalizedProfileId = normalizeUserId(userId);
    if (!activeProfileDisplayName && authState && userId && normalizeUserId(getSafeUserId()) === normalizedProfileId) {
      activeProfileDisplayName = authState.name || '';
    }
    const heading = activeProfileDisplayName ||
      profile?.posts?.[0]?.facebookName ||
      (userId ? `Потребител ${userId}` : 'Профил');
    if (profileViewName) profileViewName.textContent = heading;
    if (profileViewMeta) profileViewMeta.textContent = userId ? `ID: ${userId}` : '';
    if (profileBioDisplay) profileBioDisplay.textContent = profile?.bio?.trim() || 'Няма биография.';
    if (profileDobDisplay) profileDobDisplay.textContent = profile?.dateOfBirth ? formatProfileDate(profile.dateOfBirth) : '-';
    if (profileResidencyDisplay) profileResidencyDisplay.textContent = profile?.residency?.trim() || '-';
    const isOwnProfile = normalizeUserId(getSafeUserId()) === normalizedProfileId;
    isViewingOwnProfile = isOwnProfile;
    if (isOwnProfile) {
      updateStoredCanonicalUserId(userId);
    } else if (isProfileEditing) {
      exitProfileEditMode();
    }
    updateProfileEditControls();
    displayProfilePhoto(userId, isOwnProfile);
    if (isProfileEditing) {
      syncProfileInputs(profile);
    }
    const posts = Array.isArray(profile?.posts) ? profile.posts : [];
    const retweets = Array.isArray(profile?.retweets) ? profile.retweets : [];
    if (profilePostsCount) profilePostsCount.textContent = posts.length ? `${posts.length} общо` : 'Няма публикации';
    if (profileRetweetsCount) profileRetweetsCount.textContent = retweets.length ? `${retweets.length} общо` : 'Няма споделяния';
    renderProfilePostsList(posts);
    renderProfileRetweetsList(retweets);
  }

  function renderProfilePostsList(items) {
    renderProfilePostEntries(profilePostsList, items, 'Все още няма публикувано съдържание.');
  }

  function renderProfileRetweetsList(items) {
    renderProfilePostEntries(profileRetweetsList, items, 'Няма споделени публикации.', true);
  }

  function renderProfilePostEntries(container, entries, emptyMessage, isRetweet = false) {
    if (!container) return;
    if (!entries || !entries.length) {
      container.innerHTML = `<div class="muted">${emptyMessage}</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    const idsNeedingHydration = [];
    entries.forEach(entry => {
      const card = buildProfilePostCard(entry, isRetweet);
      frag.appendChild(card);
      const hasCount = typeof entry?.commentCount === 'number' || Array.isArray(entry?.comments);
      const postId = (entry?.post || entry || {}).id;
      if (!hasCount && postId) idsNeedingHydration.push(postId);
    });
    container.innerHTML = '';
    container.appendChild(frag);
    initializePostLikeButtons(container);
    initializePostRetweetButtons(container);
    idsNeedingHydration.forEach(id => hydratePostCommentCount(id));
    hydrateUserAvatars(container);
  }

  function buildProfilePostCard(entry, forceRetweetBadge = false) {
    const envelope = entry || {};
    const post = envelope.post || envelope;
    const canLike = canUseBackendId(post.id);
    const likeAttrs = canLike ? '' : 'disabled title="Харесванията са налични само за публикации от сървъра"';
    const ownerId = String(post.userId || '');
    const currentUserId = getSafeUserId();
    const isOwnPost = ownerId && currentUserId && ownerId === currentUserId;
    const retweetAttrs = (!canLike || isOwnPost)
      ? 'disabled title="Не можете да споделяте собствена публикация"'
      : '';
    rememberPostOwner(post.id, ownerId);
    cachePostData({ ...post, userId: ownerId });
    const authorMarkup = buildUserProfileLabel(post.facebookName || post.userId || 'Потребител', ownerId, 'owner-name');
    const stats = buildPostStats(envelope);
    const retweetInfo = forceRetweetBadge || envelope.retweet
      ? `<div class="retweet-badge">${envelope.retweetedAt ? `Споделено на ${formatDateTimeSafe(envelope.retweetedAt)}` : 'Споделено'}</div>`
      : '';
    const categoryBG = translateCategoryToBG(post.category || '');
    const subcategoryBG = translateSubcategoryToBG(post.category, post.subcategory);
    const categoryLine = `${escapeHtml(categoryBG)}${subcategoryBG ? ' • ' + escapeHtml(subcategoryBG) : ''}`;
    const el = document.createElement('div');
    el.className = 'post-card';
    el.setAttribute('data-post-id', post.id);
    if (ownerId) el.dataset.ownerId = ownerId;
    const ownerActions = canLike && isOwnPost ? buildPostOwnerActions(post.id) : '';
    el.innerHTML = `
      <div class="post-header">
        ${authorMarkup}
        <div class="post-meta">${formatDateTimeSafe(post.createdAt)}</div>
      </div>
      ${retweetInfo}
      <div class="post-text">${escapeHtml(post.postText || '')}</div>
      <div class="post-media"></div>
      ${stats}
      <div class="post-meta">${categoryLine}</div>
      ${ownerActions}
      <div class="post-actions">
        <button class="btn btn-secondary btn-sm btn-like-post" data-post-id="${post.id}" ${likeAttrs}>
          <span class="like-heart" aria-hidden="true">♡</span>
          <span class="like-label">Харесай</span>
        </button>
        <button class="btn btn-secondary btn-sm btn-retweet-post" data-post-id="${post.id}" ${retweetAttrs}>
          <span class="retweet-icon" aria-hidden="true">⟳</span>
          <span class="retweet-label">Сподели</span>
          <span class="retweet-count-badge">${safeCount(envelope.shareCount ?? 0)}</span>
        </button>
        <button class="btn-link btn-view-post-likes" data-post-id="${post.id}" ${likeAttrs}>
          ${buildLikesLabel(envelope.likeCount ?? (envelope.likes?.length ?? 0))}
        </button>
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
    const mediaContainer = el.querySelector('.post-media');
    const videoFile = post.videoUrl || post.videoLink || '';
    if (mediaContainer && videoFile) {
      attachSignedVideoToCard(mediaContainer, videoFile).catch(err => console.error('Failed to attach profile video', err));
    } else if (mediaContainer) {
      mediaContainer.remove();
    }
    return el;
  }

  function buildPostStats(entry, overrides = {}) {
    const base = entry?.post || entry || {};
    const postId = base.id ?? entry?.id ?? '';
    const likeCount = safeCount(
      overrides.likes ??
      entry?.likeCount ??
      (Array.isArray(entry?.likes) ? entry.likes.length : undefined) ??
      postLikeState[postId]?.count ??
      0
    );
    const commentCount = safeCount(
      overrides.comments ??
      entry?.commentCount ??
      (Array.isArray(entry?.comments) ? entry.comments.length : undefined) ??
      postCommentCountState[postId] ??
      0
    );
    const shareCount = safeCount(
      overrides.shares ??
      entry?.shareCount ??
      postRetweetState[postId]?.count ??
      0
    );
    const text = formatStatsText(likeCount, commentCount, shareCount);
    return `
      <div class="post-meta post-stats" data-post-id="${postId}" data-likes="${likeCount}" data-comments="${commentCount}" data-shares="${shareCount}">
        ${text}
      </div>
    `;
  }

  function formatStatsText(likes, comments, shares) {
    return `Харесвания: ${likes} • Коментари: ${comments} • Споделяния: ${shares}`;
  }

  function updatePostStatsDisplay(postId, counts = {}) {
    if (!postId) return;
    const nodes = document.querySelectorAll(`.post-stats[data-post-id="${postId}"]`);
    nodes.forEach(node => {
      if (counts.likes !== undefined) node.dataset.likes = String(safeCount(counts.likes));
      if (counts.comments !== undefined) node.dataset.comments = String(safeCount(counts.comments));
      if (counts.shares !== undefined) node.dataset.shares = String(safeCount(counts.shares));
      const likes = Number(node.dataset.likes || 0);
      const comments = Number(node.dataset.comments || 0);
      const shares = Number(node.dataset.shares || 0);
      node.textContent = formatStatsText(likes, comments, shares);
    });
    if (counts.comments !== undefined) postCommentCountState[postId] = safeCount(counts.comments);
  }

  function buildPostOwnerActions(postId) {
    if (!canCurrentUserModifyPost(postId)) return '';
    return `
      <div class="post-owner-actions">
        <button class="btn-post-action btn-edit-post" data-post-id="${postId}">✏️ Редактирай</button>
        <button class="btn-post-action btn-delete-post" data-post-id="${postId}">🗑️ Изтрий</button>
      </div>
    `;
  }

  function safeCount(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  async function hydratePostCommentCount(postId) {
    if (!postId || !canUseBackendId(postId)) return;
    if (postCommentCountState[postId] !== undefined) {
      updatePostStatsDisplay(postId, { comments: postCommentCountState[postId] });
      return;
    }
    try {
      const count = await fetchCommentCountOnly(postId);
      postCommentCountState[postId] = count;
      updatePostStatsDisplay(postId, { comments: count });
    } catch (error) {
      console.warn('Failed to hydrate comment count for post', postId, error);
    }
  }

  function setProfileLoadingState() {
    isViewingOwnProfile = false;
    setProfileEditingState(false);
    if (profileBioDisplay) profileBioDisplay.textContent = 'Зареждане...';
    if (profileDobDisplay) profileDobDisplay.textContent = '...';
    if (profileResidencyDisplay) profileResidencyDisplay.textContent = '...';
    if (profilePostsList) profilePostsList.innerHTML = '<div class="muted">Зарежда се…</div>';
    if (profileRetweetsList) profileRetweetsList.innerHTML = '<div class="muted">Зарежда се…</div>';
  }

  function setProfileErrorState() {
    isViewingOwnProfile = false;
    setProfileEditingState(false);
    if (profileBioDisplay) profileBioDisplay.textContent = 'Няма данни.';
    if (profileDobDisplay) profileDobDisplay.textContent = '-';
    if (profileResidencyDisplay) profileResidencyDisplay.textContent = '-';
    if (profilePostsList) profilePostsList.innerHTML = '<div class="muted">Неуспешно зареждане на публикациите.</div>';
    if (profileRetweetsList) profileRetweetsList.innerHTML = '<div class="muted">Неуспешно зареждане на споделянията.</div>';
  }

  function formatProfileDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('bg-BG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateTimeSafe(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('bg-BG');
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

  // Helper functions to translate category/subcategory to Bulgarian
  function translateCategoryToBG(categoryKey) {
    if (!categoryKey) return '';
    // First try to find by key
    if (CATEGORY_LABELS_BG[categoryKey]) {
      return CATEGORY_LABELS_BG[categoryKey];
    }
    // If it's already a display label (English), try to find the key
    const entry = CATEGORY_LABELS.find(([key, label]) => label === categoryKey);
    if (entry) {
      return CATEGORY_LABELS_BG[entry[0]] || categoryKey;
    }
    return categoryKey;
  }

  function translateSubcategoryToBG(categoryKey, subcategoryValue) {
    if (!subcategoryValue || !categoryKey) return '';

    // Normalize category key - it might be "Finance" instead of "finance"
    let normalizedCategoryKey = categoryKey;

    // If categoryKey is not in SUBCATEGORY_MAP_BG, try to find it by English label
    if (!SUBCATEGORY_MAP_BG[categoryKey]) {
      const entry = CATEGORY_LABELS.find(([key, label]) =>
        label.toLowerCase() === categoryKey.toLowerCase()
      );
      if (entry) {
        normalizedCategoryKey = entry[0];
      }
    }

    // Try to find the translation
    const translations = SUBCATEGORY_MAP_BG[normalizedCategoryKey];
    if (translations && translations[subcategoryValue]) {
      return translations[subcategoryValue];
    }
    return subcategoryValue;
  }


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
    maybeUnlockBodyScroll();
  }

  function openLikesModal(title) {
    if (!likesModal) return;
    if (likesModalTitle && title) {
      likesModalTitle.textContent = title;
    }
    likesModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLikesModal() {
    if (!likesModal) return;
    likesModal.classList.add('hidden');
    maybeUnlockBodyScroll();
  }

  function maybeUnlockBodyScroll() {
    const authHidden = !authModal || authModal.classList.contains('hidden');
    const likesHidden = !likesModal || likesModal.classList.contains('hidden');
    const photoHidden = !photoModal || photoModal.classList.contains('hidden');
    if (authHidden && likesHidden && photoHidden) {
      document.body.style.overflow = '';
    }
  }

  function setLikesModalContent(html) {
    if (!likesModalBody) return;
    likesModalBody.innerHTML = html;
  }

  function openPhotoModal(url) {
    if (!photoModal || !photoModalImg || !url) return;
    photoModalImg.src = url;
    photoModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePhotoModal() {
    if (!photoModal) return;
    photoModal.classList.add('hidden');
    if (photoModalImg) photoModalImg.removeAttribute('src');
    maybeUnlockBodyScroll();
  }

  function onProfilePhotoClick() {
    if (!profilePhotoDisplay) return;
    if (profilePhotoDisplay.dataset.hasPhoto !== 'true') return;
    const url = profilePhotoDisplay.dataset.photoUrl || profilePhotoDisplay.src;
    if (!url) return;
    openPhotoModal(url);
  }

  function renderLikesModalList(items) {
    if (!likesModalBody) return;
    if (!items || !items.length) {
      likesModalBody.innerHTML = '<div class="like-empty">Все още няма харесвания.</div>';
      return;
    }
    const safeItems = items.map(item => {
      const name = (item?.userName || '').trim() || `Потребител${item?.userId ? ' #' + item.userId : ''}`;
      const label = buildUserProfileLabel(name, item?.userId, 'like-name');
      return { label };
    });
    likesModalBody.innerHTML = safeItems.map(item => `<div class="like-user">${item.label}</div>`).join('');
    hydrateUserAvatars(likesModalBody);
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
      // Set profile picture with fallback
      const fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(authState.name || 'Потребител') + '&background=0D8ABC&color=fff&size=128';
      profilePic.alt = `Снимка на профила на ${authState.name || 'Потребител'}`;

      // Set initial/fallback
      profilePic.src = fallbackUrl;

      // Try to get from backend/cache
      const currentUserId = getSafeUserId();
      if (currentUserId) {
        // Enable auto-updates via hydrateUserAvatars
        profilePic.dataset.userAvatar = currentUserId;
        profilePic.dataset.avatarFallback = fallbackUrl;

        ensureProfilePhoto(currentUserId).then(url => {
          if (url) {
            profilePic.src = url;
          }
        });
      }
      profileName.textContent = authState.name || 'Потребител';
      profileEmail.textContent = authState.email || '';
      renderPosts();
      onNavigateToOwnProfile();
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
    const safeUserId = getSafeUserId();
    showGlobalSpinner(true);
    // Prepare local post but only add to UI after BE success
    const newLocalPost = {
      id: generateId('post'),
      text,
      category: postCategory ? postCategory.value : '',
      subcategory: postSubcategory ? postSubcategory.value : '',
      videoName: (postVideo && postVideo.files && postVideo.files[0]) ? postVideo.files[0].name : '',
      author: {
        name: authState.name,
        photoUrl: authState.photoUrl,
        userId: safeUserId,
        id: safeUserId
      },
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
          showToast('Video upload failed. Your post was not submitted.', 'error');
          return; // do not proceed with post creation if video upload fails
        }
      }

      const payload = {
        id: twoDigit(Math.floor(Date.now() / 1000)),
        userId: safeUserId || undefined,
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
      showToast('Неуспешно изпращане на публикацията. Моля, опитайте отново.', 'error');
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

  function showToast(message, variant = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.style.setProperty('--toast-bg', variant === 'error' ? '#E3655B' : '#388E3C');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  function renderPosts() {
    if (!postsList) return;
    postsList.innerHTML = '';

    if (!posts.length) {
      postsList.innerHTML = '<div class="muted">Все още няма публикации. Започнете, като създадете първата си публикация.</div>';
    }

    const frag = document.createDocumentFragment();
    const currentUserId = getSafeUserId();
    posts.forEach(p => {
      const el = document.createElement('div');
      el.className = 'post-card';
      const canLike = canUseBackendId(p.id);
      const ownerId = String(p.author?.userId || p.author?.id || authState?.userId || '');
      const isOwnPost = ownerId && currentUserId && ownerId === currentUserId;
      const likeButtonAttrs = canLike ? '' : 'disabled title="Харесванията са налични само за публикации от сървъра"';
      const retweetButtonAttrs = (!canLike || isOwnPost)
        ? 'disabled title="Не можете да споделяте собствена публикация"'
        : '';
      rememberPostOwner(p.id, ownerId);
      cachePostData({
        id: p.id,
        userId: ownerId,
        category: p.category,
        subcategory: p.subcategory,
        postText: p.postText ?? p.text ?? '',
        facebookName: p.author?.name || '',
        createdAt: p.createdAt
      });
      if (ownerId) el.dataset.ownerId = ownerId;
      const authorMarkup = buildUserProfileLabel(p.author?.name, ownerId, 'owner-name');
      const shareCount = safeCount(p.shareCount ?? 0);
      const stats = buildPostStats(p);
      const ownerActions = canLike && isOwnPost ? buildPostOwnerActions(p.id) : '';
      el.innerHTML = `
        <div class="post-header">
          ${authorMarkup}
          <div class="post-meta">${new Date(p.createdAt).toLocaleString()}</div>
        </div>
        <div class="post-text">${escapeHtml(p.text)}</div>
        ${p.category ? `<div class="tags"><span class="tag">${escapeHtml(translateCategoryToBG(p.category))}</span>${p.subcategory ? `<span class=\"tag\">${escapeHtml(translateSubcategoryToBG(p.category, p.subcategory))}</span>` : ''}</div>` : ''}
        ${p.videoName ? `<div class="post-meta">Attached video: ${escapeHtml(p.videoName)}</div>` : ''}
        ${stats}
        ${ownerActions}
        <div class="post-actions">
          <button class="btn btn-secondary btn-sm btn-like-post" data-post-id="${p.id}" ${likeButtonAttrs}>
            <span class="like-heart" aria-hidden="true">♡</span>
            <span class="like-label">Харесай</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-retweet-post" data-post-id="${p.id}" ${retweetButtonAttrs}>
            <span class="retweet-icon" aria-hidden="true">⟳</span>
            <span class="retweet-label">Сподели</span>
            <span class="retweet-count-badge">${shareCount}</span>
          </button>
          <button class="btn-link btn-view-post-likes" data-post-id="${p.id}" ${likeButtonAttrs}>
            ${buildLikesLabel(0)}
          </button>
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
    if (postsPagination) postsPagination.classList.add('hidden');
    initializePostLikeButtons(postsList);
    initializePostRetweetButtons(postsList);
    posts.forEach(p => hydratePostCommentCount(p.id));
    hydrateUserAvatars(postsList);
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
        updatePostStatsDisplay(postId, { comments: state.totalComments });
        updatePostStatsDisplay(postId, { comments: state.totalComments });
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
      const authorMarkup = buildUserProfileLabel(authorName, comment.userId, 'comment-author');
      // Check if current user owns this comment - compare both userId and userName
      const isOwner = authState && (
        (comment.userId && String(comment.userId) === String(authState.userId)) ||
        (comment.userName && comment.userName === authState.name) ||
        (comment.authorName && comment.authorName === authState.name)
      );
      const canLikeComment = canUseBackendId(comment.id);
      const commentLikeAttrs = canLikeComment ? '' : 'disabled title="Коментарът не е синхронизиран."';

      el.innerHTML = `
        <div class="comment-content">
          <div class="comment-header">
            ${authorMarkup}
            ${isOwner ? `
              <div class="comment-actions">
                <button class="btn-link btn-edit-comment" data-comment-id="${comment.id}" title="Редактирай">✏️</button>
                <button class="btn-link btn-delete-comment" data-comment-id="${comment.id}" title="Изтрий">🗑️</button>
              </div>
            ` : ''}
          </div>
          <div class="comment-text" data-comment-text="${comment.id}">${escapeHtml(comment.commentText)}</div>
          <div class="comment-footer">
            <div class="comment-footer-actions">
              <button class="btn-link btn-like-comment" data-comment-id="${comment.id}" ${commentLikeAttrs}>
                <span class="like-heart" aria-hidden="true">♡</span>
                <span class="like-label">Харесай</span>
              </button>
              <button class="btn-link btn-view-comment-likes" data-comment-id="${comment.id}" ${commentLikeAttrs}>
                ${buildLikesLabel(0)}
              </button>
            </div>
            <div class="comment-meta">${comment.createdAt ? new Date(comment.createdAt).toLocaleString('bg-BG') : ''}</div>
          </div>
        </div>
      `;
      frag.appendChild(el);
    });
    commentsListEl.appendChild(frag);
    initializeCommentLikeButtons(commentsListEl);
    hydrateUserAvatars(commentsListEl);

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
          updatePostStatsDisplay(postId, { comments: paginationState.totalComments });
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
          updatePostStatsDisplay(postId, { comments: paginationState.totalComments });
        } catch (error) {
          console.error('Failed to fetch comments:', error);
          commentsList.innerHTML = '<div class="muted">Неуспешно зареждане на коментарите.</div>';
        }
      }
    });
  }

  // ---------- Likes (Posts & Comments) ----------
  function initializePostLikeButtons(root) {
    if (!root) return;
    const buttons = root.querySelectorAll('.btn-like-post');
    buttons.forEach(btn => hydratePostLikeButton(btn));
  }

  function initializeCommentLikeButtons(root) {
    if (!root) return;
    const buttons = root.querySelectorAll('.btn-like-comment');
    buttons.forEach(btn => hydrateCommentLikeButton(btn));
  }

  async function hydratePostLikeButton(button) {
    if (!button) return;
    const postId = button.dataset.postId;
    if (!canUseBackendId(postId)) {
      applyPostLikeStateToButton(button, postLikeState[postId] || { count: 0, liked: false });
      return;
    }
    try {
      const state = await fetchPostLikeState(postId);
      postLikeState[postId] = state;
      applyPostLikeStateToButton(button, state);
    } catch (error) {
      console.error('Failed to hydrate post likes:', error);
    }
  }

  async function hydrateCommentLikeButton(button) {
    if (!button) return;
    const commentId = button.dataset.commentId;
    if (!canUseBackendId(commentId)) {
      applyCommentLikeStateToButton(button, commentLikeState[commentId] || { count: 0, liked: false });
      return;
    }
    try {
      const state = await fetchCommentLikeState(commentId);
      commentLikeState[commentId] = state;
      applyCommentLikeStateToButton(button, state);
    } catch (error) {
      console.error('Failed to hydrate comment likes:', error);
    }
  }

  async function refreshPostLikeButton(postId, button) {
    if (!button || !canUseBackendId(postId)) return;
    const state = await fetchPostLikeState(postId);
    postLikeState[postId] = state;
    applyPostLikeStateToButton(button, state);
  }

  async function refreshCommentLikeButton(commentId, button) {
    if (!button || !canUseBackendId(commentId)) return;
    const state = await fetchCommentLikeState(commentId);
    commentLikeState[commentId] = state;
    applyCommentLikeStateToButton(button, state);
  }

  function applyPostLikeStateToButton(button, state = { count: 0, liked: false }) {
    updateLikeButtonVisual(button, state);
    updatePostLikeCountDisplay(button.dataset.postId, state.count);
    updatePostStatsDisplay(button.dataset.postId, { likes: state.count });
  }

  function applyCommentLikeStateToButton(button, state = { count: 0, liked: false }) {
    updateLikeButtonVisual(button, state);
    updateCommentLikeCountDisplay(button.dataset.commentId, state.count);
  }

  function updateLikeButtonVisual(button, state) {
    if (!button) return;
    const labelEl = button.querySelector('.like-label');
    const count = Number(state?.count) || 0;
    if (labelEl) labelEl.textContent = state?.liked ? 'Харесано' : 'Харесай';
    button.classList.toggle('is-liked', Boolean(state?.liked));
  }

  function updatePostLikeCountDisplay(postId, count) {
    if (!postId) return;
    const cards = document.querySelectorAll(`.post-card[data-post-id="${postId}"]`);
    cards.forEach(card => {
      const button = card.querySelector('.btn-view-post-likes');
      if (button) {
        button.innerHTML = buildLikesLabel(count);
      }
    });
  }

  function updateCommentLikeCountDisplay(commentId, count) {
    if (!commentId) return;
    const card = document.querySelector(`.comment-card[data-comment-id="${commentId}"]`);
    if (!card) return;
    const button = card.querySelector('.btn-view-comment-likes');
    if (button) {
      button.innerHTML = buildLikesLabel(count);
    }
  }

  async function onPostLikeClick(button) {
    if (!button) return;
    const postId = button.dataset.postId;
    if (!canUseBackendId(postId)) {
      showToast('Тази публикация все още не може да бъде харесана.', 'error');
      return;
    }
    if (!authState) {
      openAuthModal('Влез');
      return;
    }
    button.disabled = true;
    try {
      const currentlyLiked = postLikeState[postId]?.liked;
      if (currentlyLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      await refreshPostLikeButton(postId, button);
    } catch (error) {
      console.error('Failed to toggle post like:', error);
      showToast('Неуспешно обновяване на харесването.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function onCommentLikeClick(button) {
    if (!button) return;
    const commentId = button.dataset.commentId;
    if (!canUseBackendId(commentId)) {
      showToast('Този коментар не е наличен за харесване.', 'error');
      return;
    }
    if (!authState) {
      openAuthModal('Влез');
      return;
    }
    button.disabled = true;
    try {
      const currentlyLiked = commentLikeState[commentId]?.liked;
      if (currentlyLiked) {
        await unlikeComment(commentId);
      } else {
        await likeComment(commentId);
      }
      await refreshCommentLikeButton(commentId, button);
    } catch (error) {
      console.error('Failed to toggle comment like:', error);
      showToast('Неуспешно обновяване на харесването.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function fetchPostLikeState(postId) {
    const countPromise = fetchPostLikesCount(postId);
    const likedPromise = authState ? hasUserLikedPost(postId) : Promise.resolve(false);
    const [count, liked] = await Promise.all([countPromise, likedPromise]);
    return { count, liked };
  }

  async function fetchCommentLikeState(commentId) {
    const countPromise = fetchCommentLikesCount(commentId);
    const likedPromise = authState ? hasUserLikedComment(commentId) : Promise.resolve(false);
    const [count, liked] = await Promise.all([countPromise, likedPromise]);
    return { count, liked };
  }

  async function showPostLikesModal(postId) {
    if (!canUseBackendId(postId)) {
      showToast('Харесванията са налични само за публикации от сървъра.', 'error');
      return;
    }
    openLikesModal('Хора, които харесаха публикацията');
    setLikesModalContent('<div class="muted small">Зарежда се...</div>');
    try {
      const likes = await fetchPostLikes(postId);
      renderLikesModalList(likes);
    } catch (error) {
      console.error('Failed to load post likes', error);
      setLikesModalContent('<div class="like-empty">Неуспешно зареждане на харесванията.</div>');
    }
  }

  async function showCommentLikesModal(commentId) {
    if (!canUseBackendId(commentId)) {
      showToast('Харесванията са налични само за коментари от сървъра.', 'error');
      return;
    }
    openLikesModal('Хора, които харесаха коментара');
    setLikesModalContent('<div class="muted small">Зарежда се...</div>');
    try {
      const likes = await fetchCommentLikes(commentId);
      renderLikesModalList(likes);
    } catch (error) {
      console.error('Failed to load comment likes', error);
      setLikesModalContent('<div class="like-empty">Неуспешно зареждане на харесванията.</div>');
    }
  }

  async function fetchPostLikeCount(postId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}/likes/count`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch post like count');
    const data = await resp.json();
    return Number(data) || 0;
  }

  async function fetchCommentLikeCount(commentId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/comments/${commentId}/likes/count`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch comment like count');
    const data = await resp.json();
    return Number(data) || 0;
  }

  async function fetchPostLikes(postId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}/likes`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch post likes');
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  }

  async function fetchCommentLikes(commentId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/comments/${commentId}/likes`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch comment likes');
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  }

  async function fetchCommentCountOnly(postId) {
    const url = `${BACKEND_URL}/posts/${postId}/comments?page=1&size=1&sortOrder=desc`;
    const resp = await authenticatedFetch(url, { headers: { 'accept': '*/*', ...getAuthHeaders() } });
    if (!resp.ok) throw new Error('Failed to fetch comment count');
    const data = await resp.json();
    if (Array.isArray(data)) return data.length;
    if (typeof data.total === 'number') return data.total;
    if (Array.isArray(data.comments)) return data.comments.length;
    return 0;
  }

  async function hasUserLikedPost(postId) {
    const userId = getSafeUserId();
    if (!userId) return false;
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}/likes/user/${userId}`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to check post like');
    return Boolean(await resp.json());
  }

  async function hasUserLikedComment(commentId) {
    const userId = getSafeUserId();
    if (!userId) return false;
    const resp = await authenticatedFetch(`${BACKEND_URL}/comments/${commentId}/likes/user/${userId}`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to check comment like');
    return Boolean(await resp.json());
  }

  async function likePost(postId) {
    const userId = getSafeUserId();
    if (!userId) throw new Error('Missing user id');
    const params = new URLSearchParams({
      userId: userId,
      userName: authState?.name || 'Потребител'
    });
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}/likes?${params.toString()}`, {
      method: 'POST',
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to like post');
  }

  async function unlikePost(postId) {
    const userId = getSafeUserId();
    if (!userId) throw new Error('Missing user id');
    const params = new URLSearchParams({ userId: userId });
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}/likes?${params.toString()}`, {
      method: 'DELETE',
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to unlike post');
  }

  // ---------- Retweets ----------
  function initializePostRetweetButtons(root) {
    if (!root) return;
    const buttons = root.querySelectorAll('.btn-retweet-post');
    buttons.forEach(btn => hydratePostRetweetButton(btn));
  }

  async function hydratePostRetweetButton(button) {
    if (!button) return;
    const postId = button.dataset.postId;
    if (!canUseBackendId(postId)) {
      applyPostRetweetStateToButton(button, postRetweetState[postId] || { count: 0, retweeted: false });
      return;
    }
    try {
      const state = await fetchPostRetweetState(postId);
      postRetweetState[postId] = state;
      applyPostRetweetStateToButton(button, state);
    } catch (error) {
      console.error('Failed to hydrate retweet state:', error);
    }
  }

  async function refreshPostRetweetButton(postId, button) {
    if (!button || !canUseBackendId(postId)) return;
    const state = await fetchPostRetweetState(postId);
    postRetweetState[postId] = state;
    applyPostRetweetStateToButton(button, state);
  }

  function applyPostRetweetStateToButton(button, state = { count: 0, retweeted: false }) {
    if (!button) return;
    const label = button.querySelector('.retweet-label');
    const countBadge = button.querySelector('.retweet-count-badge');
    if (label) label.textContent = state?.retweeted ? 'Споделено' : 'Сподели';
    if (countBadge) countBadge.textContent = Number(state?.count) || 0;
    button.classList.toggle('is-retweeted', Boolean(state?.retweeted));
    updatePostStatsDisplay(button.dataset.postId, { shares: state?.count ?? 0 });
  }

  async function onRetweetButtonClick(button) {
    if (!button) return;
    const postId = button.dataset.postId;
    if (!canUseBackendId(postId)) {
      showToast('Споделянето е налично само за публикации от сървъра.', 'error');
      return;
    }
    if (!authState) {
      openAuthModal('Влез');
      return;
    }
    const userId = getSafeUserId();
    if (!userId) {
      showToast('Неуспешно споделяне.', 'error');
      return;
    }
    button.disabled = true;
    try {
      const alreadyRetweeted = postRetweetState[postId]?.retweeted;
      if (alreadyRetweeted) {
        await undoRetweet(postId, userId);
      } else {
        await retweetPost(postId, userId);
      }
      await refreshPostRetweetButton(postId, button);
      const normalizedViewerId = normalizeUserId(userId);
      const shouldRefreshProfile = normalizedViewerId &&
        normalizeUserId(activeProfileUserId) === normalizedViewerId &&
        profileView &&
        !profileView.classList.contains('hidden');
      if (shouldRefreshProfile) {
        openProfile(normalizedViewerId, { displayName: activeProfileDisplayName, forceReload: true });
      }
    } catch (error) {
      console.error('Failed to toggle retweet:', error);
      showToast('Неуспешно споделяне.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function fetchPostRetweetState(postId) {
    const countPromise = fetchPostRetweetCount(postId);
    const retweetedPromise = authState ? hasUserRetweetedPost(postId) : Promise.resolve(false);
    const [count, retweeted] = await Promise.all([countPromise, retweetedPromise]);
    updatePostStatsDisplay(postId, { shares: count });
    return { count, retweeted };
  }

  async function fetchPostRetweetCount(postId) {
    const resp = await fetch(`${BACKEND_URL}/posts/${postId}/retweets/count`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch retweet count');
    const data = await resp.json();
    return Number(data) || 0;
  }

  async function hasUserRetweetedPost(postId) {
    const userId = getSafeUserId();
    if (!userId) return false;
    const resp = await fetch(`${BACKEND_URL}/posts/${postId}/retweets/user/${userId}`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to check retweet state');
    return Boolean(await resp.json());
  }

  async function retweetPost(postId, userIdOverride) {
    const userId = normalizeUserId(userIdOverride || getSafeUserId());
    if (!userId) throw new Error('Missing user id');
    const resp = await sendRetweetRequest(postId, userId, 'POST');
    if (!resp.ok) throw new Error('Failed to retweet post');
  }

  async function undoRetweet(postId, userIdOverride) {
    const userId = normalizeUserId(userIdOverride || getSafeUserId());
    if (!userId) throw new Error('Missing user id');
    const resp = await sendRetweetRequest(postId, userId, 'DELETE');
    if (!resp.ok) throw new Error('Failed to undo retweet');
  }

  async function sendRetweetRequest(postId, userId, method) {
    const params = new URLSearchParams({ userId });
    const url = `${BACKEND_URL}/posts/${postId}/retweets?${params.toString()}`;
    const headers = {
      'accept': '*/*',
      ...getAuthHeaders()
    };
    let body;
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ userId });
    }
    return fetch(url, {
      method,
      headers,
      body
    });
  }

  async function onPostEditClick(button) {
    const postId = button?.dataset?.postId;
    if (!postId) return;
    if (!canCurrentUserModifyPost(postId)) {
      showToast('Не можете да редактирате тази публикация.', 'error');
      return;
    }
    const card = button.closest('.post-card');
    if (!card || card.dataset.postEditing === 'true') return;
    try {
      const existing = await ensurePostData(postId);
      startInlinePostEdit(card, postId, existing, button);
    } catch (error) {
      console.error('Failed to edit post', error);
      showToast('Неуспешно обновяване на публикацията.', 'error');
    }
  }

  async function onPostDeleteClick(button) {
    const postId = button?.dataset?.postId;
    if (!postId) return;
    if (!canCurrentUserModifyPost(postId)) {
      showToast('Не можете да изтриете тази публикация.', 'error');
      return;
    }
    if (!confirm('Сигурни ли сте, че искате да изтриете тази публикация?')) {
      return;
    }
    try {
      await deletePostRequest(postId);
      syncLocalPostDelete(postId);
      clearPostCaches(postId);
      removePostCardsFromDom(postId);
      showToast('Публикацията беше изтрита.');
      refreshPostContextsAfterChange();
    } catch (error) {
      console.error('Failed to delete post', error);
      showToast('Неуспешно изтриване на публикацията.', 'error');
    }
  }

  async function likeComment(commentId) {
    const userId = getSafeUserId();
    if (!userId) throw new Error('Missing user id');
    const params = new URLSearchParams({
      userId: userId,
      userName: authState?.name || 'Потребител'
    });
    const resp = await authenticatedFetch(`${BACKEND_URL}/comments/${commentId}/likes?${params.toString()}`, {
      method: 'POST',
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to like comment');
  }

  async function unlikeComment(commentId) {
    const userId = getSafeUserId();
    if (!userId) throw new Error('Missing user id');
    const params = new URLSearchParams({
      userId: userId
    });
    const resp = await authenticatedFetch(`${BACKEND_URL}/comments/${commentId}/likes?${params.toString()}`, {
      method: 'DELETE',
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to unlike comment');
  }

  // post comment submit delegation handled via attachPostEventDelegation

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
      const userId = getSafeUserId();

      const payload = {
        postId: Number(postId),
        userId: userId,
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
        updatePostStatsDisplay(postId, { comments: state.totalComments });
      } catch (error) {
        console.error('Failed to reload comments:', error);
      }

      input.value = '';
      showToast('Вашият коментар беше публикуван.');

    } catch (error) {
      console.error('Failed to submit comment:', error);
      showToast('Неуспешно изпращане на коментар.', 'error');
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
        showToast('Коментарът не може да бъде празен.', 'error');
        return;
      }

      try {
        await updateComment(commentId, newText);
        commentTextEl.innerHTML = escapeHtml(newText);
        showToast('Коментарът беше обновен.');
      } catch (error) {
        console.error('Failed to update comment:', error);
        showToast('Неуспешно обновяване на коментар.', 'error');
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
      showToast('Неуспешно изтриване на коментар.', 'error');
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

  async function updatePostRequest(postId, payload) {
    const resp = await fetch(`${BACKEND_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Failed to update post');
    return resp.json();
  }

  async function deletePostRequest(postId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'accept': '*/*',
        ...getAuthHeaders()
      }
    });
    if (!resp.ok) throw new Error('Failed to delete post');
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
        ${p.category ? `<div class="tags"><span class="tag">${escapeHtml(translateCategoryToBG(p.category))}</span>${p.subcategory ? `<span class=\"tag\">${escapeHtml(translateSubcategoryToBG(p.category, p.subcategory))}</span>` : ''}</div>` : ''}
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
    if (profileView) profileView.classList.add('hidden');
    if (postsList) postsList.classList.add('hidden');
    if (postsPagination) postsPagination.classList.add('hidden');

    if (section === 'create') {
      if (composer) composer.classList.remove('hidden');
    } else if (section === 'profile') {
      if (profileView) profileView.classList.remove('hidden');
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
    const currentUserId = getSafeUserId();
    items.forEach(p => {
      const el = document.createElement('div');
      el.className = 'post-card';
      const canLike = canUseBackendId(p.id);
      const ownerId = String(p.userId || '');
      const isOwnPost = ownerId && currentUserId && ownerId === currentUserId;
      const likeButtonAttrs = canLike ? '' : 'disabled title="Харесванията са налични само за публикации от сървъра"';
      const retweetButtonAttrs = (!canLike || isOwnPost)
        ? 'disabled title="Не можете да споделяте собствена публикация"'
        : '';
      rememberPostOwner(p.id, ownerId);
      cachePostData({ ...p, userId: ownerId });
      if (ownerId) el.dataset.ownerId = ownerId;
      const authorMarkup = buildUserProfileLabel(p.facebookName || p.userId || 'Потребител', ownerId, 'owner-name');
      const shareCount = safeCount(p.shareCount ?? 0);
      const stats = buildPostStats(p);
      const ownerActions = isOwnPost ? buildPostOwnerActions(p.id) : '';
      el.innerHTML = `
        <div class="post-header">
          ${authorMarkup}
          <div class="post-meta">${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</div>
        </div>
        <div class="post-text">${escapeHtml(String(p.postText || ''))}</div>
        <div class="post-media"></div>
        ${stats}
        <div class="post-meta">${escapeHtml(translateCategoryToBG(String(p.category || '')))} ${p.subcategory ? '• ' + escapeHtml(translateSubcategoryToBG(p.category, String(p.subcategory))) : ''}</div>
        ${ownerActions}
        <div class="post-actions">
          <button class="btn btn-secondary btn-sm btn-like-post" data-post-id="${p.id}" ${likeButtonAttrs}>
            <span class="like-heart" aria-hidden="true">♡</span>
            <span class="like-label">Харесай</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-retweet-post" data-post-id="${p.id}" ${retweetButtonAttrs}>
            <span class="retweet-icon" aria-hidden="true">⟳</span>
            <span class="retweet-label">Сподели</span>
            <span class="retweet-count-badge">${shareCount}</span>
          </button>
          <button class="btn-link btn-view-post-likes" data-post-id="${p.id}" ${likeButtonAttrs}>
            ${buildLikesLabel(0)}
          </button>
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
    initializePostLikeButtons(postsList);
    initializePostRetweetButtons(postsList);
    items.forEach(p => hydratePostCommentCount(p.id));
    hydrateUserAvatars(postsList);
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
    resetLikeCaches();
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

  function escapeAttribute(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return (str || '').replace(/[&<>"']/g, c => map[c] || c);
  }

  function buildUserProfileLabel(name, userId, className = 'owner-name') {
    const safeName = escapeHtml(name || 'Потребител');
    const avatar = buildUserAvatarImg(userId, name);
    if (!userId) {
      return `<span class="user-chip">${avatar}<span class="user-chip-label ${className}">${safeName}</span></span>`;
    }
    const rawId = String(userId);
    const encodedName = encodeURIComponent(name || '');
    return `
      <span class="user-chip">
        ${avatar}
        <button type="button" class="user-profile-link ${className}" data-user-id="${escapeAttribute(rawId)}" data-user-raw-id="${escapeAttribute(rawId)}" data-user-name="${encodedName}">
          ${safeName}
        </button>
      </span>
    `;
  }

  function rememberPostOwner(postId, ownerId) {
    if (!postId || !ownerId) return;
    postOwnerCache[postId] = ownerId;
  }

  function getPostOwnerId(postId) {
    if (!postId) return null;
    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (card && card.dataset.ownerId) return card.dataset.ownerId;
    if (postOwnerCache[postId]) return postOwnerCache[postId];
    if (postDataCache[postId]?.userId) return postDataCache[postId].userId;
    return null;
  }

  function isCurrentUserPostOwner(postId) {
    const owner = getPostOwnerId(postId);
    const current = getSafeUserId();
    return owner && current && owner === current;
  }

  function canCurrentUserModifyPost(postId) {
    return canUseBackendId(postId) && isCurrentUserPostOwner(postId);
  }

  function cachePostData(post) {
    if (!post || post.id === undefined || post.id === null) return;
    postDataCache[post.id] = { ...post };
  }

  function getCachedPostData(postId) {
    return postDataCache[postId];
  }

  async function ensurePostData(postId) {
    if (postDataCache[postId]) return postDataCache[postId];
    const data = await fetchSinglePost(postId);
    cachePostData(data);
    rememberPostOwner(postId, data?.userId);
    return data;
  }

  async function fetchSinglePost(postId) {
    const resp = await authenticatedFetch(`${BACKEND_URL}/posts/${postId}`, {
      headers: { 'accept': '*/*', ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to fetch post');
    return resp.json();
  }

  function buildPostUpdatePayload(base = {}, overrides = {}) {
    return {
      id: base.id,
      userId: base.userId ?? getSafeUserId(),
      category: base.category || '',
      subcategory: base.subcategory || '',
      videoUrl: base.videoUrl || '',
      postText: overrides.postText ?? base.postText ?? base.text ?? '',
      facebookName: base.facebookName || base.userName || authState?.name || '',
      createdAt: base.createdAt || new Date().toISOString()
    };
  }
  function extractProfilePictureUrl(payload, depth = 0) {
    if (!payload || depth > 4) return '';
    if (typeof payload === 'string') return payload.trim();
    if (Array.isArray(payload)) {
      for (const entry of payload) {
        const nested = extractProfilePictureUrl(entry, depth + 1);
        if (nested) return nested;
      }
      return '';
    }
    if (typeof payload === 'object') {
      const candidateKeys = [
        'pictureFullUrl',
        'pictureUrl',
        'url',
        'imageUrl',
        'photoUrl',
        'href',
        'link',
        'signedUrl',
        'picture',
        'src'
      ];
      for (const key of candidateKeys) {
        if (typeof payload[key] === 'string' && payload[key].trim()) {
          return payload[key].trim();
        }
      }
      for (const value of Object.values(payload)) {
        const nested = extractProfilePictureUrl(value, depth + 1);
        if (nested) return nested;
      }
    }
    return '';
  }

  async function ensureProfilePhoto(userId) {
    if (!userId) return null;
    if (profilePhotoCache[userId] !== undefined) return profilePhotoCache[userId];
    if (!profilePhotoPending[userId]) {
      profilePhotoPending[userId] = (async () => {
        try {
          const resp = await fetch(`${BACKEND_URL}/users/${userId}/profile/picture`, {
            headers: { accept: 'application/json', ...getAuthHeaders() }
          });
          if (!resp.ok) throw new Error('Failed to fetch profile photo');
          const data = await resp.json().catch(() => null);
          const url = extractProfilePictureUrl(data);
          profilePhotoCache[userId] = url || null;
          return url || null;
        } catch (error) {
          profilePhotoCache[userId] = null;
          return null;
        } finally {
          delete profilePhotoPending[userId];
        }
      })();
    }
    return profilePhotoPending[userId];
  }

  function invalidateProfilePhoto(userId) {
    if (!userId) return;
    const existing = profilePhotoCache[userId];
    if (existing && typeof existing === 'string' && existing.startsWith('blob:')) {
      URL.revokeObjectURL(existing);
    }
    delete profilePhotoCache[userId];
  }

  function clearProfilePhotoCache() {
    Object.keys(profilePhotoCache).forEach(id => invalidateProfilePhoto(id));
  }

  function hydrateUserAvatars(root = document) {
    if (!root) return;
    const imgs = root.querySelectorAll('img[data-user-avatar]');
    imgs.forEach(img => {
      const userId = img.dataset.userAvatar;
      if (!userId) return;
      if (profilePhotoCache[userId] !== undefined) {
        if (profilePhotoCache[userId]) img.src = profilePhotoCache[userId];
        else if (img.dataset.avatarFallback) img.src = img.dataset.avatarFallback;
        return;
      }
      if (img.dataset.avatarLoading === 'true') return;
      img.dataset.avatarLoading = 'true';
      ensureProfilePhoto(userId)
        .then(url => {
          if (url) {
            img.src = url;
          } else if (img.dataset.avatarFallback) {
            img.src = img.dataset.avatarFallback;
          }
        })
        .finally(() => {
          img.dataset.avatarLoading = '';
        });
    });
  }

  async function displayProfilePhoto(userId, isOwnProfile) {
    if (!profilePhotoDisplay) return;
    profilePhotoDisplay.dataset.hasPhoto = '';
    profilePhotoDisplay.dataset.photoUrl = '';
    if (!userId) {
      profilePhotoDisplay.src = getAvatarPlaceholder(activeProfileDisplayName || '');
      updateProfilePhotoControls(isOwnProfile);
      return;
    }
    const cached = profilePhotoCache[userId];
    if (cached) {
      profilePhotoDisplay.src = cached;
      profilePhotoDisplay.dataset.hasPhoto = 'true';
      profilePhotoDisplay.dataset.photoUrl = cached;
      updateProfilePhotoControls(isOwnProfile);
      return;
    }
    profilePhotoDisplay.src = getAvatarPlaceholder(activeProfileDisplayName || '');
    try {
      const url = await ensureProfilePhoto(userId);
      if (url) {
        profilePhotoDisplay.src = url;
        profilePhotoDisplay.dataset.hasPhoto = 'true';
        profilePhotoDisplay.dataset.photoUrl = url;
      } else {
        profilePhotoDisplay.dataset.hasPhoto = '';
        profilePhotoDisplay.dataset.photoUrl = '';
      }
    } catch (error) {
      profilePhotoDisplay.dataset.hasPhoto = '';
      profilePhotoDisplay.dataset.photoUrl = '';
    }
    updateProfilePhotoControls(isOwnProfile);
  }

  function updateProfilePhotoControls(isOwnProfile) {
    if (profilePhotoActions) profilePhotoActions.classList.toggle('hidden', !isOwnProfile);
  }

  async function onProfilePhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const userId = getSafeUserId();
    if (!userId) return;
    if (normalizeUserId(activeProfileUserId) !== normalizeUserId(userId)) {
      showToast('Можете да променяте само своята снимка.', 'error');
      event.target.value = '';
      return;
    }
    showGlobalSpinner(true);
    try {
      const result = await uploadProfilePhoto(userId, file);
      const newPhotoUrl = result?.pictureFullUrl || result?.pictureUrl || null;
      if (newPhotoUrl) {
        profilePhotoCache[userId] = newPhotoUrl;
      } else {
        invalidateProfilePhoto(userId);
      }
      await displayProfilePhoto(userId, true);
      hydrateUserAvatars(document);
      showToast('Снимката беше обновена.');
    } catch (error) {
      console.error('Failed to upload profile photo', error);
      showToast('Неуспешно качване на снимката.', 'error');
    } finally {
      showGlobalSpinner(false);
      event.target.value = '';
    }
  }

  function normalizeUploadTicket(ticket) {
    if (!ticket || typeof ticket !== 'object') return {};
    const uploadUrl = ticket.uploadUrl || ticket.signedUrl || ticket.url;
    const method = ticket.method || ticket.httpMethod || 'PUT';
    const uploadHeaders = ticket.headers || ticket.uploadHeaders || {};
    const pictureFullUrl = ticket.pictureFullUrl || ticket.fullUrl || ticket.originalUrl;
    const pictureUrl = pictureFullUrl || ticket.pictureUrl || ticket.photoUrl || ticket.publicUrl || ticket.downloadUrl;
    return { uploadUrl, method, uploadHeaders, pictureUrl, pictureFullUrl };
  }

  async function requestProfilePhotoUploadUrl(userId, fileName, contentType) {
    const payload = {
      fileName: fileName || `profile-${Date.now()}`,
      contentType: contentType || 'application/octet-stream'
    };
    const resp = await fetch(`${BACKEND_URL}/users/${userId}/profile/picture/upload-url`, {
      method: 'POST',
      headers: { accept: '*/*', 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Failed to obtain upload URL');
    return resp.json();
  }

  async function uploadFileToSignedUrl(url, file, contentType, method = 'PUT', extraHeaders = {}) {
    if (!url) throw new Error('Missing signed URL');
    const headers = { ...extraHeaders };
    if (contentType && !headers['Content-Type']) {
      headers['Content-Type'] = contentType;
    }
    const resp = await fetch(url, {
      method: method || 'PUT',
      headers,
      body: file
    });
    if (!resp.ok) throw new Error('Failed to upload file to signed URL');
  }

  function inferContentType(file) {
    if (file?.type) return file.type;
    return 'application/octet-stream';
  }

  function sanitizeFileName(name, contentType) {
    if (name && typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed) {
        const safe = trimmed.replace(/[^\w.\-]+/g, '_');
        if (safe) return safe;
      }
    }
    const ext = (contentType && contentType.split('/')[1]) || 'bin';
    return `profile-${Date.now()}.${ext}`;
  }

  async function uploadProfilePhoto(userId, file) {
    if (!file) throw new Error('Missing file');
    const contentType = inferContentType(file);
    const fileName = sanitizeFileName(file.name, contentType);
    const ticketResponse = await requestProfilePhotoUploadUrl(userId, fileName, contentType);
    const { uploadUrl, method, uploadHeaders, pictureUrl, pictureFullUrl } = normalizeUploadTicket(ticketResponse);
    if (!uploadUrl) throw new Error('Backend did not return upload URL');
    await uploadFileToSignedUrl(uploadUrl, file, contentType, method, uploadHeaders);
    return { pictureUrl: pictureFullUrl || pictureUrl || null, pictureFullUrl: pictureFullUrl || pictureUrl || null };
  }

  async function deleteProfilePhoto(userId) {
    const resp = await fetch(`${BACKEND_URL}/users/${userId}/profile/picture`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    if (!resp.ok) throw new Error('Failed to delete profile photo');
  }

  function updatePostTextInDom(postId, newText) {
    if (!postId) return;
    document.querySelectorAll(`.post-card[data-post-id="${postId}"] .post-text`).forEach(el => {
      el.textContent = newText;
    });
    if (postDataCache[postId]) {
      postDataCache[postId].postText = newText;
      postDataCache[postId].text = newText;
    }
  }

  function removePostCardsFromDom(postId) {
    document.querySelectorAll(`.post-card[data-post-id="${postId}"]`).forEach(card => card.remove());
  }

  function clearPostCaches(postId) {
    delete postDataCache[postId];
    delete postOwnerCache[postId];
    delete postLikeState[postId];
    delete postRetweetState[postId];
    delete postCommentCountState[postId];
    delete commentPaginationState[postId];
    delete commentSortOrder[postId];
  }

  function syncLocalPostEdit(postId, newText) {
    const idx = posts.findIndex(p => String(p.id) === String(postId));
    if (idx !== -1) {
      posts[idx].text = newText;
      posts[idx].postText = newText;
      saveToStorage(POSTS_KEY, posts);
    }
  }

  function syncLocalPostDelete(postId) {
    const idx = posts.findIndex(p => String(p.id) === String(postId));
    if (idx !== -1) {
      posts.splice(idx, 1);
      saveToStorage(POSTS_KEY, posts);
    }
  }

  function refreshPostContextsAfterChange() {
    if (currentRemoteCategory) {
      fetchAndRenderRemotePosts();
    } else if (postsList) {
      renderPosts();
    }
    if (profileView && !profileView.classList.contains('hidden') && activeProfileUserId) {
      openProfile(activeProfileUserId, { displayName: activeProfileDisplayName, forceReload: true });
    }
  }

  function startInlinePostEdit(card, postId, existingData, triggerBtn) {
    const textEl = card.querySelector('.post-text');
    if (!textEl) return;
    const currentText = existingData?.postText || existingData?.text || textEl.textContent || '';
    card.dataset.postEditing = 'true';
    if (triggerBtn) triggerBtn.disabled = true;

    const textarea = document.createElement('textarea');
    textarea.className = 'post-edit-textarea';
    textarea.value = currentText;

    const actions = document.createElement('div');
    actions.className = 'post-edit-actions';
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'btn btn-sm';
    btnSave.textContent = 'Запази';
    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'btn btn-secondary btn-sm';
    btnCancel.textContent = 'Откажи';
    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);

    const originalContent = textEl.innerHTML;
    textEl.innerHTML = '';
    textEl.appendChild(textarea);
    textEl.appendChild(actions);
    textarea.focus();

    const cleanup = (newText) => {
      card.dataset.postEditing = '';
      if (triggerBtn) triggerBtn.disabled = false;
      if (newText !== undefined) {
        textEl.textContent = newText;
      } else {
        textEl.innerHTML = originalContent;
      }
    };

    btnCancel.addEventListener('click', () => cleanup());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    });

    btnSave.addEventListener('click', async () => {
      const trimmed = textarea.value.trim();
      if (!trimmed) {
        showToast('Публикацията не може да бъде празна.', 'error');
        return;
      }
      if (trimmed === currentText.trim()) {
        cleanup(currentText);
        return;
      }
      btnSave.disabled = true;
      btnCancel.disabled = true;
      try {
        const payload = buildPostUpdatePayload(existingData, { postText: trimmed });
        const updated = await updatePostRequest(postId, payload);
        cachePostData(updated || payload);
        updatePostTextInDom(postId, trimmed);
        syncLocalPostEdit(postId, trimmed);
        cleanup(trimmed);
        showToast('Публикацията беше обновена.');
        refreshPostContextsAfterChange();
      } catch (error) {
        console.error('Failed to edit post', error);
        showToast('Неуспешно обновяване на публикацията.', 'error');
        cleanup(currentText);
      }
    });
  }

  function getAvatarPlaceholder(name) {
    const initial = (name || 'U').trim()[0]?.toUpperCase() || 'U';
    // Use UI Avatars as a simple placeholder
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=1f2937&color=f8fafc&rounded=true&size=64`;
  }

  function buildUserAvatarImg(userId, name, className = 'user-avatar-thumb') {
    const fallback = getAvatarPlaceholder(name);
    if (!userId) {
      return `<img class="${className}" src="${fallback}" alt="${escapeHtml(name || 'Потребител')}">`;
    }
    const cached = profilePhotoCache[userId];
    const src = cached || fallback;
    return `<img class="${className}" src="${src}" alt="${escapeHtml(name || 'Потребител')}" data-user-avatar="${escapeAttribute(String(userId))}" data-avatar-fallback="${fallback}">`;
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
    window.fbAsyncInit = function () {
      /* global FB */
      FB.init({
        appId: appId,
        cookie: true,
        xfbml: false,
        version: 'v21.0'
      });
      fbInited = true;
    };
    (function (d, s, id) {
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
    FB.login(function (response) {
      if (response && response.authResponse) {
        (async function () {
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
      FB.api('/me', { fields: 'id,name,email' }, function (response) {
        if (!response || response.error) reject(response?.error || new Error('FB API error'));
        else resolve(response);
      });
    });
  }

  // ---------- Shared auth helper ----------
  function signInWithProfile(profile) {
    const canonicalId = normalizeUserId(profile.serverUserId ?? profile.userId);
    authState = {
      ...profile,
      serverUserId: canonicalId || profile.serverUserId
    };
    if (!authState.userId && canonicalId) {
      authState.userId = canonicalId;
    }
    saveToStorage(STORAGE_KEYS.auth, authState);
    resetLikeCaches();
    renderAuthUI();
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', init);
})();
