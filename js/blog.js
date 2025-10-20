// Blog configuration and management
const BlogManager = {
  posts: [],
  filteredPosts: [],
  categories: new Set(),

  // Initialize the blog
  async init() {
    this.setupEventListeners();
    await this.loadPosts();
    this.render();
  },

  // Setup event listeners
  setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => this.handleCategoryFilter(e.target.value));
    }

    // Sort filter
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => this.handleSort(e.target.value));
    }

    // Theme toggle
    const themeToggle = document.getElementById('blogThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Initialize theme
    this.initTheme();

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeArticle();
      }
    });

    // Close modal on background click
    const modal = document.getElementById('articleModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeArticle();
        }
      });
    }
  },

  // Load blog posts from markdown files
  async loadPosts() {
    // Check if posts are embedded (for local development)
    if (typeof blogPosts !== 'undefined' && blogPosts.length > 0) {
      this.posts = blogPosts.map(post => ({
        ...post,
        readingTime: Math.ceil(post.content.split(/\s+/).length / 200)
      }));

      // Add categories to set
      this.posts.forEach(post => {
        if (post.category) {
          this.categories.add(post.category);
        }
      });
    } else {
      // Fallback to fetching markdown files
      const postFiles = await this.getPostFiles();
      this.posts = [];

      for (const file of postFiles) {
        try {
          const response = await fetch(`blogs/${file}`);
          if (response.ok) {
            const content = await response.text();
            const post = this.parseMarkdown(content, file);
            this.posts.push(post);

            // Add category to set
            if (post.category) {
              this.categories.add(post.category);
            }
          }
        } catch (error) {
          console.error(`Error loading post ${file}:`, error);
        }
      }
    }

    // Sort posts by date (newest first)
    this.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.filteredPosts = [...this.posts];

    // Populate categories dropdown
    this.populateCategories();

    // Hide loading spinner
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
  },

  // Get list of post files
  async getPostFiles() {
    // In a real implementation, this would fetch from a server endpoint
    // For now, we'll define them manually or use a config file
    try {
      const response = await fetch('blogs/posts.json');
      if (response.ok) {
        const data = await response.json();
        return data.posts || [];
      }
    } catch (error) {
      console.log('No posts.json found, using default posts');
    }

    // Default posts for demonstration
    return [
      'building-ai-at-scale.md',
      'future-of-genai.md',
      'lessons-from-production.md'
    ];
  },

  // Parse markdown content
  parseMarkdown(content, filename) {
    // Extract frontmatter (metadata)
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    let metadata = {
      title: 'Untitled Post',
      date: new Date().toISOString().split('T')[0],
      category: 'General',
      author: 'Pruthvi Shetty',
      featured: false,
      order: 999,
      image: null,
      excerpt: ''
    };

    let markdown = content;

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      markdown = content.slice(frontmatterMatch[0].length).trim();

      // Parse frontmatter
      frontmatter.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          metadata[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      });

      // Convert string boolean to actual boolean
      metadata.featured = metadata.featured === 'true' || metadata.featured === true;
      metadata.order = parseInt(metadata.order) || 999;
    }

    // Generate excerpt if not provided
    if (!metadata.excerpt) {
      const plainText = markdown.replace(/[#*`[\]()]/g, '').slice(0, 200);
      metadata.excerpt = plainText + '...';
    }

    // Calculate reading time
    const wordCount = markdown.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute

    return {
      ...metadata,
      filename,
      content: markdown,
      readingTime
    };
  },

  // Populate categories dropdown
  populateCategories() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    // Clear existing options except the first one
    categoryFilter.innerHTML = '<option value="">All Categories</option>';

    // Add categories
    Array.from(this.categories).sort().forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  },

  // Render blog posts
  render() {
    this.renderFeaturedPosts();
    this.renderAllPosts();
  },

  // Render featured posts
  renderFeaturedPosts() {
    const featuredPosts = this.filteredPosts.filter(post => post.featured);
    const featuredSection = document.getElementById('featuredSection');
    const featuredGrid = document.getElementById('featuredPosts');

    if (!featuredSection || !featuredGrid) return;

    if (featuredPosts.length === 0) {
      featuredSection.style.display = 'none';
      return;
    }

    featuredSection.style.display = 'block';
    featuredGrid.innerHTML = featuredPosts
      .sort((a, b) => a.order - b.order)
      .map(post => this.createPostCard(post, true))
      .join('');
  },

  // Render all posts
  renderAllPosts() {
    const postsGrid = document.getElementById('blogPosts');
    const noPosts = document.getElementById('noPosts');
    const allPostsTitle = document.getElementById('allPostsTitle');

    if (!postsGrid) return;

    // Filter out featured posts if there are featured posts
    const hasFeatured = this.filteredPosts.some(post => post.featured);
    const postsToShow = hasFeatured
      ? this.filteredPosts.filter(post => !post.featured)
      : this.filteredPosts;

    if (postsToShow.length === 0) {
      postsGrid.innerHTML = '';
      if (noPosts) noPosts.style.display = 'block';
      return;
    }

    if (noPosts) noPosts.style.display = 'none';
    if (allPostsTitle && hasFeatured) {
      allPostsTitle.textContent = 'Recent Posts';
    }

    postsGrid.innerHTML = postsToShow
      .map(post => this.createPostCard(post, false))
      .join('');
  },

  // Create post card HTML
  createPostCard(post, isFeatured) {
    const imageHtml = post.image
      ? `<img src="${post.image.startsWith('http') ? post.image : `blogs/media/${post.image}`}"
          alt="${post.title}" class="card-image" onerror="this.style.display='none'">`
      : '';

    return `
      <div class="blog-card ${isFeatured ? 'featured' : ''}" onclick="BlogManager.openArticle('${post.filename}')">
        ${imageHtml}
        <div class="card-content">
          <div class="card-meta">
            <span class="card-date">
              <i class="far fa-calendar"></i>
              ${this.formatDate(post.date)}
            </span>
            <span class="card-category">${post.category}</span>
          </div>
          <h3 class="card-title">${post.title}</h3>
          <p class="card-excerpt">${post.excerpt}</p>
          <div class="card-footer">
            <span class="read-more">
              Read more <i class="fas fa-arrow-right"></i>
            </span>
            <span class="reading-time">
              <i class="far fa-clock"></i>
              ${post.readingTime} min read
            </span>
          </div>
        </div>
      </div>
    `;
  },

  // Open article in modal
  async openArticle(filename) {
    const post = this.posts.find(p => p.filename === filename);
    if (!post) return;

    const modal = document.getElementById('articleModal');
    const articleContent = document.getElementById('articleContent');

    if (!modal || !articleContent) return;

    // Configure marked options if available
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: function(code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          } else if (typeof hljs !== 'undefined') {
            return hljs.highlightAuto(code).value;
          }
          return code;
        },
        breaks: true,
        gfm: true,
        tables: true,
        smartLists: true,
        smartypants: true
      });

      // Parse markdown to HTML
      const htmlContent = marked.parse(post.content);

      // Create article HTML
      articleContent.innerHTML = `
        <div class="article-header">
          <h1 class="article-title">${post.title}</h1>
          <div class="article-meta">
            <span class="article-author">
              <i class="fas fa-user"></i> ${post.author}
            </span>
            <span class="article-date">
              <i class="far fa-calendar"></i> ${this.formatDate(post.date)}
            </span>
            <span class="article-reading-time">
              <i class="far fa-clock"></i> ${post.readingTime} min read
            </span>
          </div>
        </div>
        <div class="article-body">
          ${htmlContent}
        </div>
      `;
    } else {
      // Fallback for when marked is not available
      articleContent.innerHTML = `
        <div class="article-header">
          <h1 class="article-title">${post.title}</h1>
          <div class="article-meta">
            <span class="article-author">
              <i class="fas fa-user"></i> ${post.author}
            </span>
            <span class="article-date">
              <i class="far fa-calendar"></i> ${this.formatDate(post.date)}
            </span>
            <span class="article-reading-time">
              <i class="far fa-clock"></i> ${post.readingTime} min read
            </span>
          </div>
        </div>
        <div class="article-body">
          <pre style="white-space: pre-wrap; word-wrap: break-word;">${post.content}</pre>
        </div>
      `;
    }

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Initialize any mermaid diagrams
    if (typeof mermaid !== 'undefined') {
      mermaid.init();
    }

    // Highlight code blocks
    articleContent.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  },

  // Close article modal
  closeArticle() {
    const modal = document.getElementById('articleModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  },

  // Handle search
  handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) {
      this.filteredPosts = [...this.posts];
    } else {
      this.filteredPosts = this.posts.filter(post => {
        return post.title.toLowerCase().includes(searchTerm) ||
               post.excerpt.toLowerCase().includes(searchTerm) ||
               post.content.toLowerCase().includes(searchTerm) ||
               post.category.toLowerCase().includes(searchTerm) ||
               post.author.toLowerCase().includes(searchTerm);
      });
    }

    // Reapply current filters
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter && categoryFilter.value) {
      this.handleCategoryFilter(categoryFilter.value);
    } else {
      this.render();
    }
  },

  // Handle category filter
  handleCategoryFilter(category) {
    if (!category) {
      // If search is active, keep search results, otherwise show all
      const searchInput = document.getElementById('searchInput');
      if (!searchInput || !searchInput.value.trim()) {
        this.filteredPosts = [...this.posts];
      }
    } else {
      // Apply category filter on current filtered posts
      const searchInput = document.getElementById('searchInput');
      const baseArray = searchInput && searchInput.value.trim()
        ? this.filteredPosts
        : this.posts;

      this.filteredPosts = baseArray.filter(post => post.category === category);
    }

    this.render();
  },

  // Handle sort
  handleSort(sortType) {
    switch(sortType) {
      case 'date-asc':
        this.filteredPosts.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'date-desc':
        this.filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'title':
        this.filteredPosts.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    this.render();
  },

  // Format date
  formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  },

  // Initialize theme
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeToggle(savedTheme);
  },

  // Toggle theme
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeToggle(newTheme);
  },

  // Update theme toggle button
  updateThemeToggle(theme) {
    const themeToggle = document.getElementById('blogThemeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    }
  }
};

// Make closeArticle globally accessible
window.closeArticle = () => BlogManager.closeArticle();

// Initialize blog when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  BlogManager.init();
});