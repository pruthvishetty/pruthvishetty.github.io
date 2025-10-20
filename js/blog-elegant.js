// Elegant Blog Manager
const BlogManager = {
  posts: [],
  filteredPosts: [],
  categories: new Set(),
  currentFilter: 'all',

  // Initialize
  async init() {
    this.setupEventListeners();
    await this.loadPosts();
    this.updateStats();
    this.render();
    this.checkURLParams();
  },

  // Check URL parameters for direct post links
  checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');

    if (postSlug) {
      // Find post by filename slug
      const post = this.posts.find(p => p.filename.replace('.md', '') === postSlug);
      if (post) {
        // Update meta tags
        this.updateMetaTags(post);
        // Open the post
        setTimeout(() => this.openArticle(post.filename), 100);
      }
    }
  },

  // Update meta tags for social sharing
  updateMetaTags(post) {
    const title = `${post.title} | Tokenized Thoughts`;
    const description = post.excerpt || post.content.substring(0, 150).replace(/[#*]/g, '');
    const url = `https://pruthvishetty.com/blog.html?post=${post.filename.replace('.md', '')}`;

    // Update title
    document.title = title;

    // Update or create meta tags
    this.setMetaTag('og:title', title);
    this.setMetaTag('og:description', description);
    this.setMetaTag('og:url', url);
    this.setMetaTag('twitter:title', title);
    this.setMetaTag('twitter:description', description);
    this.setMetaTag('twitter:url', url);
  },

  // Helper to set meta tag
  setMetaTag(property, content) {
    let tag = document.querySelector(`meta[property="${property}"]`) ||
              document.querySelector(`meta[name="${property}"]`);

    if (!tag) {
      tag = document.createElement('meta');
      if (property.startsWith('og:')) {
        tag.setAttribute('property', property);
      } else {
        tag.setAttribute('name', property);
      }
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
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
          this.closeArticle();
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

    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        this.handleFilter(filter);

        // Update active state
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Theme toggle
    const themeToggle = document.getElementById('blogThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Initialize theme
    this.initTheme();

    // Smooth scroll for header
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const header = document.querySelector('.blog-header');
      if (window.scrollY > lastScrollY && window.scrollY > 100) {
        header.style.transform = 'translateY(-100%)';
      } else {
        header.style.transform = 'translateY(0)';
      }
      lastScrollY = window.scrollY;
    });
  },

  // Load posts
  async loadPosts() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.classList.add('active');

    // Use embedded posts if available
    if (typeof blogPosts !== 'undefined' && blogPosts.length > 0) {
      this.posts = blogPosts.map(post => ({
        ...post,
        readingTime: Math.ceil(post.content.split(/\s+/).length / 200)
      }));
    }

    // Extract categories
    this.posts.forEach(post => {
      if (post.category) {
        this.categories.add(post.category);
      }
    });

    // Sort by date
    this.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.filteredPosts = [...this.posts];

    // Add category filters
    this.renderCategoryFilters();

    if (loadingState) loadingState.classList.remove('active');
  },

  // Render category filters
  renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    if (!container) return;

    Array.from(this.categories).forEach(category => {
      const pill = document.createElement('button');
      pill.className = 'filter-pill';
      pill.dataset.filter = category;
      pill.textContent = category;
      pill.addEventListener('click', (e) => {
        this.handleFilter(category);
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
      });
      container.appendChild(pill);
    });
  },

  // Update statistics
  updateStats() {
    const totalPosts = document.getElementById('totalPosts');
    const totalReadTime = document.getElementById('totalReadTime');

    if (totalPosts) {
      totalPosts.textContent = this.posts.length;
    }

    if (totalReadTime) {
      const totalTime = this.posts.reduce((sum, post) => sum + post.readingTime, 0);
      totalReadTime.textContent = totalTime;
    }
  },

  // Render posts
  render() {
    this.renderFeaturedHero();
    this.renderArticles();
  },

  // Render featured hero
  renderFeaturedHero() {
    const featuredHero = document.getElementById('featuredHero');
    if (!featuredHero) return;

    const featuredPost = this.filteredPosts.find(post => post.featured && post.order === 1);
    if (!featuredPost) {
      featuredHero.classList.remove('active');
      return;
    }

    featuredHero.classList.add('active');
    featuredHero.innerHTML = `
      <div class="featured-article">
        <div class="featured-content">
          <span class="featured-tag">Featured</span>
          <h2 class="featured-title" onclick="BlogManager.openArticle('${featuredPost.filename}')">
            ${featuredPost.title}
          </h2>
          <p class="featured-excerpt">${featuredPost.excerpt}</p>
          <div class="featured-meta">
            <span class="article-date">
              <i class="far fa-calendar"></i>
              ${this.formatDate(featuredPost.date)}
            </span>
            <span class="article-reading-time">
              <i class="far fa-clock"></i>
              ${featuredPost.readingTime} min read
            </span>
          </div>
        </div>
        <div class="featured-image">
          ${featuredPost.image ? `<img src="blogs/media/${featuredPost.image}" alt="${featuredPost.title}" onerror="this.style.display='none'">` : ''}
        </div>
      </div>
    `;
  },

  // Render articles
  renderArticles() {
    const grid = document.getElementById('articlesGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid) return;

    // Filter out the main featured post
    const articlesToShow = this.filteredPosts.filter(post =>
      !(post.featured && post.order === 1)
    );

    if (articlesToShow.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.add('active');
      return;
    }

    if (emptyState) emptyState.classList.remove('active');

    grid.innerHTML = articlesToShow.map(post => `
      <article class="article-card" onclick="BlogManager.openArticle('${post.filename}')">
        ${post.image ? `
          <div class="article-image">
            <img src="blogs/media/${post.image}" alt="${post.title}" onerror="this.parentElement.style.display='none'">
          </div>
        ` : ''}
        <span class="article-category">${post.category}</span>
        <h3 class="article-title">${post.title}</h3>
        <p class="article-excerpt">${post.excerpt}</p>
        <div class="article-footer">
          <span class="article-date">
            ${this.formatDate(post.date)}
          </span>
          <span class="article-reading-time">
            ${post.readingTime} min read
          </span>
        </div>
      </article>
    `).join('');
  },

  // Handle filter
  handleFilter(filter) {
    this.currentFilter = filter;

    if (filter === 'all') {
      this.filteredPosts = [...this.posts];
    } else if (filter === 'featured') {
      this.filteredPosts = this.posts.filter(post => post.featured);
    } else {
      this.filteredPosts = this.posts.filter(post => post.category === filter);
    }

    this.render();
  },

  // Handle search
  handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResults');

    if (!searchTerm) {
      this.clearSearch();
      return;
    }

    const results = this.posts.filter(post => {
      return post.title.toLowerCase().includes(searchTerm) ||
             post.excerpt.toLowerCase().includes(searchTerm) ||
             post.content.toLowerCase().includes(searchTerm) ||
             post.category.toLowerCase().includes(searchTerm);
    });

    if (resultsContainer) {
      if (results.length === 0) {
        resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No articles found for "${query}"
          </div>
        `;
      } else {
        resultsContainer.innerHTML = `
          <div style="margin-bottom: 1rem; color: var(--text-muted);">
            Found ${results.length} article${results.length !== 1 ? 's' : ''}
          </div>
          ${results.map(post => `
            <div class="search-result" onclick="BlogManager.openArticle('${post.filename}')" style="padding: 1.5rem 0; border-bottom: 1px solid var(--border-light); cursor: pointer;">
              <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">${post.title}</h4>
              <p style="color: var(--text-secondary); font-size: 0.925rem; margin-bottom: 0.5rem;">${post.excerpt}</p>
              <span style="color: var(--text-muted); font-size: 0.875rem;">${post.category} · ${this.formatDate(post.date)}</span>
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

  // Open article
  async openArticle(filename) {
    const post = this.posts.find(p => p.filename === filename);
    if (!post) return;

    const modal = document.getElementById('articleModal');
    const content = document.getElementById('articleContent');

    if (!modal || !content) return;

    // Close search overlay if open
    const searchOverlay = document.getElementById('searchOverlay');
    if (searchOverlay) searchOverlay.classList.remove('active');

    // Parse markdown
    let htmlContent = post.content;
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: function(code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return code;
        },
        breaks: true,
        gfm: true
      });
      htmlContent = marked.parse(post.content);
    }

    // Generate shareable URL
    const shareUrl = `https://pruthvishetty.com/blog.html?post=${post.filename.replace('.md', '')}`;

    // Render article
    content.innerHTML = `
      <div class="article-header">
        <div class="article-header-category">${post.category}</div>
        <h1 class="article-header-title">${post.title}</h1>
        <div class="article-header-meta">
          <span class="article-author">
            <i class="fas fa-user-circle"></i> ${post.author}
          </span>
          <span class="article-date">
            <i class="far fa-calendar"></i> ${this.formatDate(post.date)}
          </span>
          <span class="article-reading-time">
            <i class="far fa-clock"></i> ${post.readingTime} min read
          </span>
          <button class="article-share-btn" onclick="BlogManager.shareArticle('${post.filename}')" title="Share this article">
            <i class="fas fa-share-alt"></i>
          </button>
        </div>
      </div>
      <div class="article-body">
        ${htmlContent}
      </div>
    `;

    // Update URL without page reload
    window.history.pushState({}, '', shareUrl);

    // Update meta tags for sharing
    this.updateMetaTags(post);

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Highlight code blocks
    if (typeof hljs !== 'undefined') {
      content.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
  },

  // Share article
  async shareArticle(filename) {
    const post = this.posts.find(p => p.filename === filename);
    if (!post) return;

    const shareUrl = `https://pruthvishetty.com/blog.html?post=${post.filename.replace('.md', '')}`;
    const shareText = `${post.title} by Pruthvi Shetty`;

    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err) {
        // User cancelled or API not available
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard! Share it on your favorite platform.');
    } catch (err) {
      // Final fallback: show prompt
      prompt('Copy this link to share:', shareUrl);
    }
  },

  // Close article
  closeArticle() {
    const modal = document.getElementById('articleModal');
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
    const savedTheme = localStorage.getItem('blog-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  },

  // Toggle theme
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('blog-theme', newTheme);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  BlogManager.init();
});