// ======================= JIKAN API WRAPPER =======================
const JikanAPI = (() => {
  const BASE = 'https://api.jikan.moe/v4';
  let lastReq = 0;
  const minInterval = 1000;
  const cache = new Map();
  const CACHE_TTL = 10 * 60 * 1000;

  async function rateLimit() {
    const now = Date.now();
    const wait = lastReq + minInterval - now;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastReq = Date.now();
  }

  async function fetchJSON(endpoint, params = '') {
    const key = endpoint + params;
    if (cache.has(key) && Date.now() - cache.get(key).ts < CACHE_TTL)
      return cache.get(key).data;
    await rateLimit();
    try {
      const res = await fetch(`${BASE}${endpoint}${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cache.set(key, { data: json, ts: Date.now() });
      return json;
    } catch (err) {
      console.error(`API error ${endpoint}:`, err);
      return null;
    }
  }

  function getTrailerUrl(apiAnime) {
    // First try embed_url
    if (apiAnime.trailer?.embed_url) {
      return apiAnime.trailer.embed_url;
    }
    // Then try youtube_id
    if (apiAnime.trailer?.youtube_id) {
      return `https://www.youtube.com/embed/${apiAnime.trailer.youtube_id}`;
    }
    // Then try to extract from url
    if (apiAnime.trailer?.url) {
      const match = apiAnime.trailer.url.match(/[?&]v=([^&]+)/);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
    }
    // No trailer available
    return null;
  }

  function transform(apiAnime, id) {
    let poster = apiAnime.images?.jpg?.image_url;
    if (!poster || poster.includes('no_image')) {
      poster = `https://placehold.co/400x600/1e1a2f/white?text=${encodeURIComponent(apiAnime.title?.slice(0,12) || 'Anime')}`;
    }
    // Accurate status mapping from Jikan API
    let status = 'completed';
    if (apiAnime.status === 'Currently Airing') status = 'airing';
    else if (apiAnime.status === 'Not yet aired') status = 'upcoming';
    
    let year = apiAnime.year;
    if (!year && apiAnime.aired?.from) year = new Date(apiAnime.aired.from).getFullYear();
    if (!year) year = 'TBA';
    
    const type = apiAnime.type || 'Unknown';
    let seasonInfo = 'Unknown';
    if (apiAnime.season && apiAnime.year) seasonInfo = `${apiAnime.season.charAt(0).toUpperCase() + apiAnime.season.slice(1)} ${apiAnime.year}`;
    else if (apiAnime.aired?.from) {
      const d = new Date(apiAnime.aired.from);
      const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
      const month = d.getMonth();
      seasonInfo = `${seasons[Math.floor(month/3)]} ${d.getFullYear()}`;
    }
    const japaneseTitle = apiAnime.title_japanese || apiAnime.title || 'N/A';
    const englishTitle = apiAnime.title || 'Unknown';
    const score = apiAnime.score || 0;
    const rank = apiAnime.rank || 'N/A';
    const popularity = apiAnime.popularity || 0;
    const malUrl = apiAnime.url || `https://myanimelist.net/anime/${apiAnime.mal_id}`;

    // Get trailer URL (or null)
    const trailer = getTrailerUrl(apiAnime);

    return {
      id: id || apiAnime.mal_id,
      title: englishTitle,
      englishTitle: englishTitle,
      japaneseTitle: japaneseTitle,
      poster: poster,
      episodes: apiAnime.episodes || '?',
      status: status,
      year: year,
      season: seasonInfo,
      synopsis: apiAnime.synopsis || 'No synopsis available on MyAnimeList.',
      genres: apiAnime.genres?.map(g => g.name) || ['Unknown'],
      rating: score,
      score: score,
      rank: rank,
      popularity: popularity,
      malUrl: malUrl,
      trailer: trailer,
      type: type
    };
  }

  return {
    async getTop(page = 1, limit = 25) {
      const data = await fetchJSON('/top/anime', `?page=${page}&limit=${limit}&filter=bypopularity`);
      return data?.data?.map(a => transform(a, a.mal_id)) || [];
    },
    async getAiring(page = 1, limit = 25) {
      const data = await fetchJSON('/seasons/now', `?page=${page}&limit=${limit}`);
      return data?.data?.map(a => transform(a, a.mal_id)) || [];
    },
    async getUpcoming(page = 1, limit = 25) {
      const data = await fetchJSON('/seasons/upcoming', `?page=${page}&limit=${limit}`);
      return data?.data?.map(a => transform(a, a.mal_id)) || [];
    },
    async search(query, page = 1) {
      if (!query || query.length < 1) return [];
      const data = await fetchJSON('/anime', `?q=${encodeURIComponent(query)}&page=${page}&limit=20`);
      return data?.data?.map(a => transform(a, a.mal_id)) || [];
    },
    async getById(id) {
      const data = await fetchJSON(`/anime/${id}`, '');
      return data?.data ? transform(data.data, id) : null;
    },
    clearCache() { cache.clear(); }
  };
})();

// ======================= GLOBAL STATE =======================
let currentPage = 'home';
let searchQuery = '';
let searchResults = [];
let searchPage = 1;
let searchHasMore = true;
let isLoadingSearch = false;
let libraryData = [];
let libraryPage = 1;
let libraryHasMore = true;
let isLoadingLibrary = false;
let visibleLimit = 20;
let filters = { genre: 'all', status: 'all', minRating: 0, year: 'all', sortBy: 'rating' };

// DOM elements
const pages = { home: 'homePage', trending: 'trendingPage', upcoming: 'upcomingPage', library: 'libraryPage', search: 'searchPage', about: 'aboutPage' };
const navBtns = document.querySelectorAll('.nav-btn');
const searchInput = document.getElementById('globalSearch');
const searchResetBtn = document.getElementById('searchResetBtn');
const themeToggle = document.getElementById('themeToggle');
const genreFilter = document.getElementById('genreFilter');
const statusFilter = document.getElementById('statusFilter');
const ratingFilter = document.getElementById('ratingFilter');
const yearFilter = document.getElementById('yearFilter');
const sortSelect = document.getElementById('sortBy');
const resetBtn = document.getElementById('resetFiltersBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchLoadMoreBtn = document.getElementById('searchLoadMoreBtn');
const backToTop = document.getElementById('backToTop');
const searchQueryDisplay = document.getElementById('searchQueryDisplay');

// Theme icon
function updateThemeIcon() {
  const isLight = document.body.classList.contains('light');
  themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  updateThemeIcon();
});
updateThemeIcon();

// Cursor glow
const cursorGlow = document.querySelector('.cursor-glow');
document.addEventListener('mousemove', (e) => {
  if (cursorGlow) {
    cursorGlow.style.opacity = '0.6';
    cursorGlow.style.left = e.clientX - 150 + 'px';
    cursorGlow.style.top = e.clientY - 150 + 'px';
  }
});
document.addEventListener('mouseleave', () => { if(cursorGlow) cursorGlow.style.opacity = '0'; });

function escapeHtml(str) { 
  return String(str).replace(/[&<>]/g, function(m){
    if(m==='&') return '&amp;';
    if(m==='<') return '&lt;';
    if(m==='>') return '&gt;';
    return m;
  });
}

function renderCards(container, animeArray, dataSource = 'library') {
  if (!container) return;
  if (!animeArray || animeArray.length === 0) {
    container.innerHTML = '<div class="loading-indicator"><i class="fas fa-exclamation-circle"></i> No anime found. Try different filters or search.</div>';
    return;
  }
  container.innerHTML = animeArray.map(anime => `
    <div class="anime-card" data-id="${anime.id}">
      <div class="poster" style="background-image: url('${anime.poster}'); background-size: cover; background-position: center;"></div>
      <div class="card-info">
        <div class="card-title" title="${escapeHtml(anime.englishTitle)}">${escapeHtml(anime.englishTitle)}</div>
        <div class="japanese-subtitle" title="${escapeHtml(anime.japaneseTitle)}">${escapeHtml(anime.japaneseTitle.length > 35 ? anime.japaneseTitle.substring(0,32)+'...' : anime.japaneseTitle)}</div>
        <div class="genres">${anime.genres.slice(0,2).map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}</div>
        <div class="ep-status">
          <span>📺 ${anime.episodes} eps</span>
          <span>${anime.status === 'airing' ? '🟢 Airing' : anime.status === 'completed' ? '✅ Completed' : '⏳ Upcoming'}</span>
        </div>
        <div style="font-size:0.7rem; margin-top:4px;">⭐ ${anime.rating || '?'} | ${anime.type || 'TV'} | ${anime.season || '?'}</div>
      </div>
    </div>
  `).join('');

  // Fix broken images
  container.querySelectorAll('.poster').forEach(poster => {
    const bg = poster.style.backgroundImage.slice(5, -2);
    const testImg = new Image();
    testImg.onerror = () => {
      poster.style.backgroundImage = "url('https://placehold.co/400x600/1e1a2f/white?text=No+Poster')";
    };
    testImg.src = bg;
  });

  // Modal click
  container.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = parseInt(card.dataset.id);
      let anime = null;
      if (dataSource === 'library') anime = libraryData.find(a => a.id === id);
      else if (dataSource === 'search') anime = searchResults.find(a => a.id === id);
      if (!anime) anime = await JikanAPI.getById(id);
      if (anime) showModal(anime);
    });
  });
}

function showModal(anime) {
  const modal = document.getElementById('animeModal');
  const body = document.getElementById('modalBody');
  
  // Trailer embed or fallback message
  let trailerHtml = '';
  if (anime.trailer) {
    trailerHtml = `<div class="trailer-embed"><iframe width="100%" height="100%" src="${anime.trailer}" frameborder="0" allowfullscreen></iframe></div>`;
  } else {
    trailerHtml = `<div class="trailer-placeholder" style="background: var(--bg-card); border-radius: 20px; padding: 2rem; text-align: center; margin: 1rem 0; border: 1px solid var(--border);">
                     <i class="fas fa-video-slash" style="font-size: 3rem; color: var(--text-secondary);"></i>
                     <p style="margin-top: 0.5rem;">No trailer available for this anime.</p>
                   </div>`;
  }
  
  body.innerHTML = `
    <h2>${escapeHtml(anime.englishTitle)}</h2>
    <p style="color: var(--text-secondary); margin-top: -8px;">${escapeHtml(anime.japaneseTitle)}</p>
    ${trailerHtml}
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0;">
      <span><strong>⭐ Score:</strong> ${anime.score || 'N/A'}</span>
      <span><strong>🏆 Rank:</strong> #${anime.rank}</span>
      <span><strong>📊 Popularity:</strong> #${anime.popularity}</span>
    </div>
    <p><strong>📺 Type:</strong> ${anime.type} &nbsp;| <strong>🎬 Episodes:</strong> ${anime.episodes} &nbsp;| <strong>📅 Season:</strong> ${anime.season}</p>
    <p><strong>📖 Genres:</strong> ${anime.genres.join(', ')}</p>
    <p><strong>📝 Synopsis:</strong> ${escapeHtml(anime.synopsis)}</p>
    <p><strong>🔗 MyAnimeList:</strong> <a href="${anime.malUrl}" target="_blank" style="color: var(--accent);">${anime.malUrl}</a></p>
    <p><strong>💡 Source:</strong> Live from Jikan API (MyAnimeList)</p>
  `;
  modal.style.display = 'flex';
}

function showSkeletons(containerId, count = 6) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = Array(count).fill(0).map(() => `
      <div class="skeleton-card" style="height: 340px; border-radius: 1.5rem;"></div>
    `).join('');
  }
}

// ========== HOME, TRENDING, UPCOMING (no search mixing) ==========
async function fetchHome() {
  showSkeletons('featuredGrid', 6);
  showSkeletons('newestGrid', 6);
  showSkeletons('recommendedGrid', 6);
  const [top, airing, upcoming] = await Promise.all([
    JikanAPI.getTop(1, 12),
    JikanAPI.getAiring(1, 12),
    JikanAPI.getUpcoming(1, 12)
  ]);
  renderCards(document.getElementById('featuredGrid'), top.slice(0,6), 'library');
  renderCards(document.getElementById('newestGrid'), airing.slice(0,6), 'library');
  renderCards(document.getElementById('recommendedGrid'), [...upcoming.slice(0,3), ...top.slice(6,9)], 'library');
}

async function fetchTrending() {
  showSkeletons('trendingGrid', 12);
  const data = await JikanAPI.getAiring(1, 24);
  renderCards(document.getElementById('trendingGrid'), data, 'library');
}

async function fetchUpcoming() {
  showSkeletons('upcomingGrid', 12);
  const data = await JikanAPI.getUpcoming(1, 24);
  renderCards(document.getElementById('upcomingGrid'), data, 'library');
}

// ========== SEARCH PAGE (dedicated) ==========
async function performSearch(reset = true) {
  if (isLoadingSearch) return;
  isLoadingSearch = true;
  if (reset) {
    searchResults = [];
    searchPage = 1;
    searchHasMore = true;
    document.getElementById('searchGrid').innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-pulse"></i> Searching...</div>';
  }
  try {
    const results = await JikanAPI.search(searchQuery, searchPage);
    if (reset) searchResults = results;
    else searchResults = [...searchResults, ...results];
    searchHasMore = results.length === 20;
    renderCards(document.getElementById('searchGrid'), searchResults, 'search');
    searchLoadMoreBtn.style.display = searchHasMore ? 'block' : 'none';
    searchQueryDisplay.textContent = `Showing results for "${escapeHtml(searchQuery)}" (${searchResults.length} found)`;
  } catch(e) { console.error(e); }
  finally { isLoadingSearch = false; }
}

function onSearchLoadMore() {
  if (!searchHasMore || isLoadingSearch) return;
  searchPage++;
  performSearch(false);
}

// ========== LIBRARY with filters ==========
async function fetchLibrary(reset = true) {
  if (isLoadingLibrary) return;
  isLoadingLibrary = true;
  if (reset) {
    libraryData = [];
    libraryPage = 1;
    libraryHasMore = true;
    visibleLimit = 20;
    document.getElementById('libraryGrid').innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-pulse"></i> Loading anime data...</div>';
  }
  try {
    const [top, airing, upcoming] = await Promise.all([
      JikanAPI.getTop(libraryPage, 10),
      JikanAPI.getAiring(libraryPage, 10),
      JikanAPI.getUpcoming(libraryPage, 10)
    ]);
    let newAnime = [...top, ...airing, ...upcoming];
    libraryHasMore = newAnime.length === 30;
    if (reset) libraryData = newAnime;
    else libraryData = [...libraryData, ...newAnime];
    populateFiltersFromData();
    applyLibraryFiltersAndRender();
  } catch(e) { console.error(e); }
  finally { isLoadingLibrary = false; }
}

function populateFiltersFromData() {
  if (!libraryData.length) return;
  const genresSet = new Set();
  const yearsSet = new Set();
  libraryData.forEach(anime => {
    anime.genres.forEach(g => genresSet.add(g));
    if (anime.year && anime.year !== 'TBA') yearsSet.add(anime.year);
  });
  const currentGenre = genreFilter.value;
  genreFilter.innerHTML = '<option value="all">All Genres</option>' + 
    Array.from(genresSet).sort().map(g => `<option value="${g}">${g}</option>`).join('');
  if (currentGenre !== 'all' && genresSet.has(currentGenre)) genreFilter.value = currentGenre;
  else genreFilter.value = 'all';
  
  const currentYear = yearFilter.value;
  yearFilter.innerHTML = '<option value="all">All Years</option>' + 
    Array.from(yearsSet).sort((a,b)=>b-a).map(y => `<option value="${y}">${y}</option>`).join('');
  if (currentYear !== 'all' && yearsSet.has(parseInt(currentYear))) yearFilter.value = currentYear;
  else yearFilter.value = 'all';
}

function getFilteredAndSortedList() {
  let filtered = [...libraryData];
  if (filters.genre !== 'all') filtered = filtered.filter(a => a.genres.includes(filters.genre));
  if (filters.status !== 'all') filtered = filtered.filter(a => a.status === filters.status);
  if (filters.minRating > 0) filtered = filtered.filter(a => a.rating >= filters.minRating);
  if (filters.year !== 'all') {
    const targetYear = parseInt(filters.year);
    filtered = filtered.filter(a => {
      if (a.year === 'TBA') return false;
      return parseInt(a.year) === targetYear;
    });
  }
  // Sorting with multiple options
  if (filters.sortBy === 'rating') filtered.sort((a,b) => b.rating - a.rating);
  else if (filters.sortBy === 'yearDesc') filtered.sort((a,b) => {
    const ya = a.year === 'TBA' ? 0 : parseInt(a.year);
    const yb = b.year === 'TBA' ? 0 : parseInt(b.year);
    return yb - ya;
  });
  else if (filters.sortBy === 'yearAsc') filtered.sort((a,b) => {
    const ya = a.year === 'TBA' ? 9999 : parseInt(a.year);
    const yb = b.year === 'TBA' ? 9999 : parseInt(b.year);
    return ya - yb;
  });
  else if (filters.sortBy === 'popularity') filtered.sort((a,b) => a.popularity - b.popularity);
  else if (filters.sortBy === 'episodes') filtered.sort((a,b) => {
    const epsA = a.episodes === '?' ? 0 : parseInt(a.episodes);
    const epsB = b.episodes === '?' ? 0 : parseInt(b.episodes);
    return epsB - epsA;
  });
  return filtered;
}

function applyLibraryFiltersAndRender() {
  const filtered = getFilteredAndSortedList();
  const toShow = filtered.slice(0, visibleLimit);
  renderCards(document.getElementById('libraryGrid'), toShow, 'library');
  const hasMoreFiltered = filtered.length > visibleLimit;
  loadMoreBtn.style.display = (hasMoreFiltered || libraryHasMore) ? 'block' : 'none';
}

async function onLibraryLoadMore() {
  visibleLimit += 20;
  const filtered = getFilteredAndSortedList();
  if (visibleLimit >= filtered.length && libraryHasMore && !isLoadingLibrary) {
    libraryPage++;
    await fetchLibrary(false);
  } else {
    applyLibraryFiltersAndRender();
  }
}

// ========== PAGE SWITCHING ==========
async function refreshCurrentPage() {
  if (currentPage === 'home') await fetchHome();
  else if (currentPage === 'trending') await fetchTrending();
  else if (currentPage === 'upcoming') await fetchUpcoming();
  else if (currentPage === 'library') await fetchLibrary(true);
  else if (currentPage === 'search' && searchQuery) await performSearch(true);
}

function switchPage(pageId) {
  currentPage = pageId;
  Object.values(pages).forEach(id => document.getElementById(id).classList.remove('active-page'));
  document.getElementById(pages[pageId]).classList.add('active-page');
  navBtns.forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(navBtns).find(btn => btn.dataset.page === pageId);
  if (activeBtn) activeBtn.classList.add('active');
  refreshCurrentPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== SEARCH HANDLING ==========
function onSearchSubmit() {
  searchQuery = searchInput.value.trim();
  if (searchQuery.length === 0) return;
  searchResetBtn.style.display = 'flex';
  switchPage('search');
}

function resetSearch() {
  searchInput.value = '';
  searchQuery = '';
  searchResetBtn.style.display = 'none';
  if (currentPage === 'search') {
    switchPage('home');
  } else {
    refreshCurrentPage();
  }
}

let searchTimer;
function onSearchInput() {
  const query = searchInput.value.trim();
  if (query.length === 0) {
    searchResetBtn.style.display = 'none';
    if (currentPage === 'search') switchPage('home');
    return;
  }
  searchResetBtn.style.display = 'flex';
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = query;
    switchPage('search');
  }, 800);
}

// ========== EVENT LISTENERS ==========
searchInput.addEventListener('input', onSearchInput);
searchResetBtn.addEventListener('click', resetSearch);
searchLoadMoreBtn.addEventListener('click', onSearchLoadMore);
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  updateThemeIcon();
});
genreFilter.addEventListener('change', e => { filters.genre = e.target.value; visibleLimit = 20; applyLibraryFiltersAndRender(); });
statusFilter.addEventListener('change', e => { filters.status = e.target.value; visibleLimit = 20; applyLibraryFiltersAndRender(); });
ratingFilter.addEventListener('change', e => { filters.minRating = parseFloat(e.target.value); visibleLimit = 20; applyLibraryFiltersAndRender(); });
yearFilter.addEventListener('change', e => { filters.year = e.target.value; visibleLimit = 20; applyLibraryFiltersAndRender(); });
sortSelect.addEventListener('change', e => { filters.sortBy = e.target.value; visibleLimit = 20; applyLibraryFiltersAndRender(); });
resetBtn.addEventListener('click', () => {
  genreFilter.value = 'all';
  statusFilter.value = 'all';
  ratingFilter.value = '0';
  yearFilter.value = 'all';
  sortSelect.value = 'rating';
  filters = { genre:'all', status:'all', minRating:0, year:'all', sortBy:'rating' };
  visibleLimit = 20;
  applyLibraryFiltersAndRender();
});
loadMoreBtn.addEventListener('click', onLibraryLoadMore);
document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('animeModal').style.display = 'none');
window.onclick = e => { if(e.target === document.getElementById('animeModal')) document.getElementById('animeModal').style.display = 'none'; };
navBtns.forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.page)));

// Back to top
window.addEventListener('scroll', () => {
  if (window.scrollY > 500) backToTop.style.display = 'flex';
  else backToTop.style.display = 'none';
});
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Initialize
switchPage('home');