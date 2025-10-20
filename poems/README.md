# How to Add a New Poem

## Quick Start

1. Create a new `.md` file in the `poems/` folder (e.g., `my-poem.md`)
2. Add frontmatter at the top with your poem's metadata
3. Write your poem below the frontmatter
4. Add the filename to `poems.js`

## File Format

Each poem should be a markdown file with YAML frontmatter:

```markdown
---
title: Your Poem Title
date: 2025-01-20
author: Pruthvi Shetty
theme: Optional brief description
---

# Your Poem Title

Your poem content goes here.
You can write freely.

Multiple stanzas work great.
Each line will display naturally.

---

*Optional notes or dedication*
```

## Frontmatter Fields

- **title**: The poem's title (required)
- **date**: Format as YYYY-MM-DD (required) - Poems display newest first
- **author**: Your name (required)
- **theme**: Optional one-line description shown in preview

## Steps to Add a Poem

### 1. Create the markdown file

Save your poem in `poems/your-poem-name.md`

Example (`poems/morning-chai.md`):
```markdown
---
title: Morning Chai
date: 2025-01-20
author: Pruthvi Shetty
theme: Simple moments over tea
---

# Morning Chai

Steam rises from the cup,
Thoughts settle like tea leaves,
Another day begins.

The world outside can wait,
This moment is mine alone,
With chai and silence.
```

### 2. Register the file

Edit `poems/poems.js` and add your filename to the array:

```javascript
const poemsFiles = [
  "digital-dreams.md",
  "morning-chai.md",  // Add your new file here
  // Add more poem filenames here
];
```

### 3. Commit and push

```bash
git add poems/morning-chai.md poems/poems.js
git commit -m "Add new poem: Morning Chai"
git push origin main
```

That's it! Your poem will automatically appear on the poetry page.

## Tips

- Poems are sorted by date (newest first)
- No need to use asterisks or italics - text displays naturally
- Use `---` for horizontal dividers
- The first few lines show as a preview on the main page
- Theme is optional but helps readers understand the poem's context
