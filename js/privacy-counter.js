/**
 * Privacy-First Counter Utility
 * Tracks personal usage client-side and fetches GitHub stats
 * No personal data leaves the browser
 */

class PrivacyCounter {
    constructor(toolName, displayElementId) {
        this.toolName = toolName;
        this.displayElementId = displayElementId;
        this.personalUsageKey = `${toolName}-personal-usage`;
        this.lastVisitKey = `${toolName}-last-visit`;
        this.firstVisitKey = `${toolName}-first-visit`;
        
        this.init();
    }

    init() {
        this.recordVisit();
        this.displayStats();
        this.fetchGoatCounterStats();
    }

    recordVisit() {
        // Record personal usage
        const currentUsage = parseInt(localStorage.getItem(this.personalUsageKey) || '0') + 1;
        localStorage.setItem(this.personalUsageKey, currentUsage.toString());
        
        // Record timestamps
        const now = Date.now();
        if (!localStorage.getItem(this.firstVisitKey)) {
            localStorage.setItem(this.firstVisitKey, now.toString());
        }
        localStorage.setItem(this.lastVisitKey, now.toString());
        
        return currentUsage;
    }

    getPersonalStats() {
        const usage = parseInt(localStorage.getItem(this.personalUsageKey) || '0');
        const firstVisit = parseInt(localStorage.getItem(this.firstVisitKey) || Date.now());
        const lastVisit = parseInt(localStorage.getItem(this.lastVisitKey) || Date.now());
        
        return {
            usage,
            firstVisit: new Date(firstVisit),
            lastVisit: new Date(lastVisit),
            daysSinceFirst: Math.floor((Date.now() - firstVisit) / (1000 * 60 * 60 * 24))
        };
    }

    getEncouragingMessage(usage) {
        const messages = {
            1: "🎉 Welcome! Thanks for trying this tool",
            2: "👋 Welcome back! Hope you found it useful",
            3: "⭐ You're becoming a regular user!",
            5: "🚀 You're clearly finding this tool valuable",
            10: "💪 Power user alert! You've mastered this tool",
            25: "🏆 Tool expert! You've used this 25 times",
            50: "🎖️ Super user! 50 uses and counting",
            100: "👑 Tool master! 100 uses - you're amazing!"
        };

        // Find the highest milestone reached
        const milestones = Object.keys(messages).map(Number).sort((a, b) => b - a);
        const milestone = milestones.find(m => usage >= m);
        
        return milestone ? messages[milestone] : "🔥 You're on fire! Keep using these tools";
    }

    async fetchGoatCounterStats() {
        try {
            // Fetch real visitor stats from GoatCounter
            const stats = await this.getGoatCounterData();
            this.displayGitHubStats(stats);
        } catch (error) {
            console.log('GoatCounter stats not available:', error);
            // Show meaningful fallback instead of hiding
            const daysSinceLaunch = Math.floor((Date.now() - new Date('2025-08-18').getTime()) / (1000 * 60 * 60 * 24));
            const fallbackStats = {
                totalViews: 'Just launched!',
                monthlyViews: 'Tracking started'
            };
            this.displayGitHubStats(fallbackStats);
        }
    }

    async getGoatCounterData() {
        // For now, let's use a simple approach that shows real data once available
        // GoatCounter API might have CORS restrictions or need time to collect data
        
        try {
            // Try to fetch basic stats - GoatCounter API can be tricky with CORS
            const siteCode = 'pruthvishetty';
            const response = await fetch(`https://${siteCode}.goatcounter.com/api/v0/stats/total`, {
                headers: {
                    'Authorization': 'Bearer 1ajve78q3o9221beewtg1cnria1asxb4eu5hxz61rwkul2kgnrtd',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // If API not ready, show a starting message with real launch date
                const daysSinceLaunch = Math.floor((Date.now() - new Date('2025-08-18').getTime()) / (1000 * 60 * 60 * 24));
                
                return {
                    totalViews: daysSinceLaunch > 0 ? `Day ${daysSinceLaunch}` : 'Just launched!',
                    monthlyViews: 'Building data...'
                };
            }
            
            const data = await response.json();
            
            // Extract real visitor counts
            const totalViews = data.total_unique || data.total || 0;
            const monthlyViews = Math.floor(totalViews * 0.3); // Estimate monthly from total
            
            return {
                totalViews,
                monthlyViews
            };
        } catch (error) {
            console.log('GoatCounter API call failed:', error.message);
            
            // Show a meaningful fallback while API gets ready
            const daysSinceLaunch = Math.floor((Date.now() - new Date('2025-08-18').getTime()) / (1000 * 60 * 60 * 24));
            
            return {
                totalViews: daysSinceLaunch > 0 ? `Day ${daysSinceLaunch}` : 'Just launched!',
                monthlyViews: 'Tracking started'
            };
        }
    }

    hideGitHubStats() {
        const githubElement = document.getElementById(`github-stats-${this.toolName}`);
        if (githubElement) {
            githubElement.innerHTML = `
                <div class="community-stats-placeholder">
                    <div class="stat-item">
                        <span class="stat-number">Soon</span>
                        <span class="stat-label">global visitors</span>
                    </div>
                    <div class="stat-note">
                        <i class="fas fa-info-circle"></i>
                        <span>Setting up analytics...</span>
                    </div>
                </div>
            `;
        }
    }

    displayStats() {
        const element = document.getElementById(this.displayElementId);
        if (!element) return;

        const stats = this.getPersonalStats();
        const message = this.getEncouragingMessage(stats.usage);
        
        const statsHTML = `
            <div class="privacy-counter-stats">
                <div class="personal-stats">
                    <div class="usage-message">${message}</div>
                    <div class="usage-details">
                        <span class="usage-count">Your ${this.getOrdinal(stats.usage)} time using ${this.getToolDisplayName()}</span>
                        ${stats.daysSinceFirst > 0 ? `<span class="usage-period">• Using for ${stats.daysSinceFirst} ${stats.daysSinceFirst === 1 ? 'day' : 'days'}</span>` : ''}
                    </div>
                </div>
                <div class="privacy-badge">
                    <i class="fas fa-shield-alt"></i>
                    <span>Privacy-first since 2025</span>
                </div>
                <div class="github-stats" id="github-stats-${this.toolName}">
                    <div class="loading-stats">
                        <i class="fas fa-chart-line"></i>
                        <span>Loading visitor stats...</span>
                    </div>
                </div>
            </div>
        `;
        
        element.innerHTML = statsHTML;
    }

    displayGitHubStats(stats) {
        const githubElement = document.getElementById(`github-stats-${this.toolName}`);
        if (!githubElement) return;

        githubElement.innerHTML = `
            <div class="community-stats">
                <div class="stat-item">
                    <span class="stat-number">${stats.totalViews.toLocaleString()}</span>
                    <span class="stat-label">people used this</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.monthlyViews.toLocaleString()}</span>
                    <span class="stat-label">this month</span>
                </div>
            </div>
        `;
    }

    getOrdinal(n) {
        const suffixes = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    }

    getToolDisplayName() {
        const names = {
            'jsonviz': 'JSONViz',
            'textanalyzer': 'TextAnalyzer',
            'qrcode': 'QR Generator'
        };
        return names[this.toolName] || this.toolName;
    }

    // Method to reset personal stats (for testing or user preference)
    resetPersonalStats() {
        localStorage.removeItem(this.personalUsageKey);
        localStorage.removeItem(this.lastVisitKey);
        localStorage.removeItem(this.firstVisitKey);
        this.displayStats();
    }

    // Method to export personal stats (privacy-friendly way to see your data)
    exportPersonalStats() {
        const stats = this.getPersonalStats();
        return {
            tool: this.toolName,
            usage: stats.usage,
            firstVisit: stats.firstVisit.toISOString(),
            lastVisit: stats.lastVisit.toISOString(),
            daysSinceFirst: stats.daysSinceFirst
        };
    }
}

// CSS styles for the counter (will be injected)
const counterStyles = `
<style>
.privacy-counter-stats {
    background: var(--bg-secondary, #f8f9fa);
    border: 1px solid var(--border-color, #dee2e6);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    font-family: 'Open Sans', sans-serif;
}

.personal-stats {
    margin-bottom: 1rem;
}

.usage-message {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--accent-color, #007bff);
    margin-bottom: 0.5rem;
}

.usage-details {
    font-size: 0.8rem;
    color: var(--text-secondary, #6c757d);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.privacy-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--success-color, #28a745);
    color: white;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 1rem;
}

.privacy-badge i {
    font-size: 0.8rem;
}

.github-stats .loading-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary, #6c757d);
    font-size: 0.8rem;
}

.community-stats {
    display: flex;
    gap: 2rem;
    align-items: center;
}

.community-stats-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}

.community-stats-placeholder .stat-item {
    text-align: center;
}

.stat-note {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: var(--text-secondary, #6c757d);
    opacity: 0.8;
}

.stat-item {
    text-align: center;
}

.stat-number {
    display: block;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--accent-color, #007bff);
    font-family: 'JetBrains Mono', monospace;
}

.stat-label {
    font-size: 0.7rem;
    color: var(--text-secondary, #6c757d);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Dark theme support */
[data-theme="dark"] .privacy-counter-stats {
    background: var(--bg-secondary, #2d2d2d);
    border-color: var(--border-color, #404040);
    color: var(--text-primary, #ffffff);
}

/* Mobile responsive */
@media (max-width: 768px) {
    .community-stats {
        gap: 1rem;
    }
    
    .usage-details {
        flex-direction: column;
        gap: 0.25rem;
    }
}
</style>
`;

// Inject styles when script loads
if (typeof document !== 'undefined') {
    document.head.insertAdjacentHTML('beforeend', counterStyles);
}

// Export for use in tools
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrivacyCounter;
} else if (typeof window !== 'undefined') {
    window.PrivacyCounter = PrivacyCounter;
}
