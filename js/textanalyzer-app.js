let currentTheme = 'light';
let analysisTimeout = null;
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    const icon = document.querySelector('.theme-toggle i');
    icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('tools-theme', currentTheme);
    localStorage.setItem('textanalyzer-theme', currentTheme);
}
function loadTheme() {
    const savedTheme = localStorage.getItem('tools-theme') || localStorage.getItem('textanalyzer-theme') || 'light';
    currentTheme = savedTheme;
    document.body.setAttribute('data-theme', currentTheme);
    const icon = document.querySelector('.theme-toggle i');
    icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}
function analyzeText() {
    if (analysisTimeout) clearTimeout(analysisTimeout);
    analysisTimeout = setTimeout(() => {
        const text = document.getElementById('textInput').value;
        const wordCount = countWords(text);
        const charCount = text.length;
        const charCountNoSpaces = text.replace(/\s/g, '').length;
        const lineCount = text ? text.split('\n').length : 0;
        const paragraphCount = countParagraphs(text);
        const sentenceCount = countSentences(text);
        const avgWordsPerSentence = sentenceCount > 0 ? Math.round(wordCount / sentenceCount * 10) / 10 : 0;
        const avgCharsPerWord = wordCount > 0 ? Math.round(charCountNoSpaces / wordCount * 10) / 10 : 0;
        const longestWord = findLongestWord(text);
        const mostFrequentWord = findMostFrequentWord(text);
        const readingTime = calculateReadingTime(wordCount);
        document.getElementById('wordCount').textContent = wordCount.toLocaleString();
        document.getElementById('charCount').textContent = charCount.toLocaleString();
        document.getElementById('charCountNoSpaces').textContent = charCountNoSpaces.toLocaleString();
        document.getElementById('lineCount').textContent = lineCount.toLocaleString();
        document.getElementById('paragraphCount').textContent = paragraphCount.toLocaleString();
        document.getElementById('sentenceCount').textContent = sentenceCount.toLocaleString();
        document.getElementById('avgWordsPerSentence').textContent = avgWordsPerSentence;
        document.getElementById('avgCharsPerWord').textContent = avgCharsPerWord;
        document.getElementById('longestWord').textContent = longestWord || '-';
        document.getElementById('mostFrequentWord').textContent = mostFrequentWord || '-';
        document.getElementById('readingTime').textContent = readingTime;
    }, 100);
}
function countWords(text) {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}
function countParagraphs(text) {
    if (!text.trim()) return 0;
    return text.trim().split(/\n\s*\n/).filter(para => para.trim().length > 0).length;
}
function countSentences(text) {
    if (!text.trim()) return 0;
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
}
function findLongestWord(text) {
    if (!text.trim()) return '';
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    return words.reduce((longest, current) => current.length > longest.length ? current : longest, '');
}
function findMostFrequentWord(text) {
    if (!text.trim()) return '';
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    if (words.length === 0) return '';
    const frequency = {};
    words.forEach(word => {
        if (word.length > 2) frequency[word] = (frequency[word] || 0) + 1;
    });
    if (Object.keys(frequency).length === 0) return '';
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
}
function calculateReadingTime(wordCount) {
    if (wordCount === 0) return 0;
    return Math.ceil(wordCount / 200);
}
async function copyText() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value;
    if (!text.trim()) { showFeedback('Nothing to copy', 'error'); return; }
    try {
        await navigator.clipboard.writeText(text);
        showFeedback('Text copied to clipboard!');
    } catch (error) {
        textInput.select();
        document.execCommand('copy');
        showFeedback('Text copied to clipboard!');
    }
}
function clearText() {
    if (confirm('Clear all text?')) {
        document.getElementById('textInput').value = '';
        analyzeText();
    }
}
function loadSample() {
    const sampleText = `The Art of Writing\nWriting is both an art and a craft that requires dedication, practice, and patience. It's a powerful tool for communication, self-expression, and storytelling that has shaped human civilization for thousands of years.\nWhether you're crafting a novel, composing an email, or jotting down notes, every piece of writing serves a purpose. The beauty of writing lies in its versatility - it can inform, persuade, entertain, or inspire.\nGood writing is clear, concise, and engaging. It respects the reader's time while delivering value. Remember, the best writing often comes from rewriting. Don't be afraid to edit, revise, and refine your work.\nPractice regularly, read widely, and never stop learning. Every word you write is a step forward in your journey as a writer.`;
    document.getElementById('textInput').value = sampleText;
    analyzeText();
}
function formatText() {
    const textInput = document.getElementById('textInput');
    let text = textInput.value;
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    textInput.value = text;
    analyzeText();
    showFeedback('Text formatted!');
}
function removeExtraSpaces() {
    const textInput = document.getElementById('textInput');
    let text = textInput.value;
    text = text.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').replace(/ \n/g, '\n').trim();
    textInput.value = text;
    analyzeText();
    showFeedback('Extra spaces removed!');
}
function removeDuplicateLines() {
    const textInput = document.getElementById('textInput');
    const lines = textInput.value.split('\n');
    textInput.value = [...new Set(lines)].join('\n');
    analyzeText();
    showFeedback('Duplicate lines removed!');
}
function convertCase(caseType) {
    const textInput = document.getElementById('textInput');
    let text = textInput.value;
    if (!text.trim()) { showFeedback('No text to convert', 'error'); return; }
    switch(caseType) {
        case 'upper': text = text.toUpperCase(); break;
        case 'lower': text = text.toLowerCase(); break;
        case 'title': text = text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()); break;
        case 'sentence': text = text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()); break;
    }
    textInput.value = text;
    analyzeText();
    showFeedback(`Converted to ${caseType} case!`);
}
function reverseText() {
    const textInput = document.getElementById('textInput');
    const text = textInput.value;
    if (!text.trim()) { showFeedback('No text to reverse', 'error'); return; }
    textInput.value = text.split('').reverse().join('');
    analyzeText();
    showFeedback('Text reversed!');
}
function sortLines() {
    const textInput = document.getElementById('textInput');
    const lines = textInput.value.split('\n');
    if (lines.length <= 1) { showFeedback('Need multiple lines to sort', 'error'); return; }
    textInput.value = lines.sort((a, b) => a.localeCompare(b)).join('\n');
    analyzeText();
    showFeedback('Lines sorted alphabetically!');
}
function showFeedback(message, type = 'success') {
    const feedback = document.createElement('div');
    feedback.className = 'success-feedback';
    feedback.textContent = message;
    if (type === 'error') feedback.style.backgroundColor = 'var(--error-color)';
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 3000);
}
document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'k': e.preventDefault(); clearText(); break;
                case 'l': e.preventDefault(); loadSample(); break;
            }
        }
    });
    analyzeText();
});
