// Elegant Poems Manager
const PoemsManager = {
  poems: [],

  // Initialize
  async init() {
    this.setupEventListeners();
    await this.loadPoems();
    this.render();
  },

  // Setup event listeners
  setupEventListeners() {
    // Search toggle
    const searchToggle = document.getElementById('searchToggle');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchClose = document.getElementById('searchClose');
    const searchInput = document.getElementById('searchInput');

    if (searchToggle && searchOverlay) {
      searchToggle.addEventListener('click', () => {
        searchOverlay.classList.add('active');
        searchInput.focus();
      });

      searchClose.addEventListener('click', () => {
        searchOverlay.classList.remove('active');
        searchInput.value = '';
        this.clearSearch();
      });

      // Close on ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchOverlay.classList.remove('active');
          this.closePoem();
        }
      });

      // Search functionality
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.handleSearch(e.target.value);
        }, 300);
      });
    }

    // Theme toggle
    const themeToggle = document.getElementById('poemsThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Initialize theme
    this.initTheme();

    // Smooth scroll for header
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const header = document.querySelector('.poems-header');
      if (window.scrollY > lastScrollY && window.scrollY > 100) {
        header.style.transform = 'translateY(-100%)';
      } else {
        header.style.transform = 'translateY(0)';
      }
      lastScrollY = window.scrollY;
    });
  },

  // Load poems
  async loadPoems() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.classList.add('active');

    // Load poems from markdown files
    if (typeof poemsFiles !== 'undefined' && poemsFiles.length > 0) {
      const poemPromises = poemsFiles.map(async (filename) => {
        try {
          const response = await fetch(`poems/${filename}`);
          const text = await response.text();

          // Parse frontmatter
          const frontmatterMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

          if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1];
            const content = frontmatterMatch[2];

            // Parse YAML frontmatter
            const metadata = {};
            frontmatter.split('\n').forEach(line => {
              const [key, ...valueParts] = line.split(':');
              if (key && valueParts.length > 0) {
                metadata[key.trim()] = valueParts.join(':').trim();
              }
            });

            return {
              filename: filename,
              title: metadata.title || 'Untitled',
              date: metadata.date || new Date().toISOString().split('T')[0],
              author: metadata.author || 'Pruthvi Shetty',
              theme: metadata.theme || '',
              content: content.trim(),
              readingTime: Math.ceil(content.split(/\s+/).length / 150)
            };
          }

          // If no frontmatter, use the whole content
          return {
            filename: filename,
            title: filename.replace('.md', '').replace(/-/g, ' '),
            date: new Date().toISOString().split('T')[0],
            author: 'Pruthvi Shetty',
            theme: '',
            content: text.trim(),
            readingTime: Math.ceil(text.split(/\s+/).length / 150)
          };
        } catch (error) {
          console.error(`Error loading poem ${filename}:`, error);
          return null;
        }
      });

      this.poems = (await Promise.all(poemPromises)).filter(poem => poem !== null);
    }

    // Sort by date - chronological (newest first)
    this.poems.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (loadingState) loadingState.classList.remove('active');
  },

  // Render poems
  render() {
    this.renderPoems();
  },

  // Extract first verse from poem
  extractFirstVerse(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const verseLines = [];
    let foundFirstLine = false;

    for (let line of lines) {
      // Skip markdown headers
      if (line.startsWith('#')) continue;
      // Stop at horizontal rules
      if (line.trim() === '---') break;

      // Start collecting after we skip the title
      if (!foundFirstLine && line.trim().length > 0) {
        foundFirstLine = true;
      }

      // Collect verse lines (skip empty lines at start)
      if (foundFirstLine && line.trim().length > 0) {
        verseLines.push(line.trim());
        if (verseLines.length >= 4) break; // First stanza (4 lines)
      }

      // Stop after first empty line if we have some verses
      if (foundFirstLine && line.trim().length === 0 && verseLines.length > 0) {
        break;
      }
    }

    return verseLines.join('<br>') || '<em>Click to read...</em>';
  },

  // Render poems
  renderPoems() {
    const grid = document.getElementById('poemsGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid) return;

    if (this.poems.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.add('active');
      return;
    }

    if (emptyState) emptyState.classList.remove('active');

    grid.innerHTML = this.poems.map(poem => {
      const firstVerse = this.extractFirstVerse(poem.content);
      return `
        <article class="poem-card" onclick="PoemsManager.openPoem('${poem.filename}')">
          <div class="poem-ornament">
            <svg width="30" height="4" viewBox="0 0 30 4" fill="none">
              <path d="M1 2C1 2 6 0.5 15 2C24 3.5 29 2 29 2" stroke="currentColor" stroke-width="0.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h3 class="poem-title">${poem.title}</h3>
          <div class="poem-preview-card">
            ${firstVerse}
          </div>
          <div class="poem-footer">
            <span class="poem-date">${this.formatDate(poem.date)}</span>
          </div>
        </article>
      `;
    }).join('');
  },

  // Handle search
  handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResults');

    if (!searchTerm) {
      this.clearSearch();
      return;
    }

    const results = this.poems.filter(poem => {
      return poem.title.toLowerCase().includes(searchTerm) ||
             poem.content.toLowerCase().includes(searchTerm) ||
             (poem.theme && poem.theme.toLowerCase().includes(searchTerm));
    });

    if (resultsContainer) {
      if (results.length === 0) {
        resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No poems found for "${query}"
          </div>
        `;
      } else {
        resultsContainer.innerHTML = `
          <div style="margin-bottom: 1rem; color: var(--text-muted);">
            Found ${results.length} poem${results.length !== 1 ? 's' : ''}
          </div>
          ${results.map(poem => `
            <div class="search-result" onclick="PoemsManager.openPoem('${poem.filename}')" style="padding: 1.5rem 0; border-bottom: 1px solid var(--border-light); cursor: pointer;">
              <h4 style="color: var(--text-primary); margin-bottom: 0.5rem; font-style: normal;">${poem.title}</h4>
              <p style="color: var(--text-secondary); font-size: 0.925rem; margin-bottom: 0.5rem;">${poem.theme || poem.excerpt || ''}</p>
              <span style="color: var(--text-muted); font-size: 0.875rem;">${this.formatDate(poem.date)}</span>
            </div>
          `).join('')}
        `;
      }
    }
  },

  // Clear search
  clearSearch() {
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
    }
  },

  // Open poem
  async openPoem(filename) {
    const poem = this.poems.find(p => p.filename === filename);
    if (!poem) return;

    const modal = document.getElementById('poemModal');
    const content = document.getElementById('poemContent');

    if (!modal || !content) return;

    // Close search overlay if open
    const searchOverlay = document.getElementById('searchOverlay');
    if (searchOverlay) searchOverlay.classList.remove('active');

    // Parse markdown
    let htmlContent = poem.content;
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      htmlContent = marked.parse(poem.content);
    }

    // Render poem
    content.innerHTML = `
      <div class="poem-header">
        <div class="poem-ornament-large">
          <svg width="60" height="8" viewBox="0 0 60 8" fill="none">
            <path d="M2 4C2 4 12 1 30 4C48 7 58 4 58 4" stroke="currentColor" stroke-width="0.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="poem-header-title">${poem.title}</h1>
        ${poem.theme ? `<p class="poem-theme">${poem.theme}</p>` : ''}
        <div class="poem-header-meta">
          <span class="poem-author">
            <i class="fas fa-user-circle"></i> ${poem.author}
          </span>
          <span class="poem-date">
            <i class="far fa-calendar"></i> ${this.formatDate(poem.date)}
          </span>
        </div>
      </div>
      <div class="poem-body">
        ${htmlContent}
      </div>
      <div class="poem-footer-ornament">
        <svg width="80" height="12" viewBox="0 0 80 12" fill="none">
          <path d="M2 6C2 6 16 2 40 6C64 10 78 6 78 6" stroke="currentColor" stroke-width="0.5" stroke-linecap="round"/>
          <circle cx="40" cy="6" r="2" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>
    `;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  // Close poem
  closePoem() {
    const modal = document.getElementById('poemModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  // Format date
  formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  },

  // Initialize theme
  initTheme() {
    const savedTheme = localStorage.getItem('poems-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  },

  // Toggle theme
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('poems-theme', newTheme);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  PoemsManager.init();
});
