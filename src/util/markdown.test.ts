import { removeFrontmatter, removeObsidianComments, removeWikiLinks, replaceLinkAliases } from "./markdown";

describe('markdown regex utility', () => {
    describe('removeFrontmatter', () => {
        const mdWithFrontmatter = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

- Bullet point one
- Bullet point two

[Link to another file](other-file.md)

The end of the content.
`.trim();

    const mdWithoutFrontmatter = `
![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

- Bullet point one
- Bullet point two

[Link to another file](other-file.md)

The end of the content.
`.trim();
        it('removes frontmatter', () => {
            const result = removeFrontmatter(mdWithFrontmatter);
            expect(result).toBe(mdWithoutFrontmatter);
        })
    })
    describe('replaceLinkAliases', () => {
        const mdWithLinkAlias = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

[[Link to another file|Alias1]]

- Bullet point one
- Bullet point two

[[Link to another file|Alias2]]

The end of the content.
`.trim();

const mdWithoutLinkAlias = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

Alias1

- Bullet point one
- Bullet point two

Alias2

The end of the content.
`.trim();
        it('replaces link aliases and removes wiki links', () => {
            const result = replaceLinkAliases(mdWithLinkAlias);
            expect(result).toBe(mdWithoutLinkAlias);
        })
    })
    describe('removeWikiLinks', () => {
        const mdWithWikiLinks = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

[[Alias1]]

- Bullet point one
- Bullet point two

[[Alias2]]

The end of the content.
`.trim();

const mdWithoutWikiLinks = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

Alias1

- Bullet point one
- Bullet point two

Alias2

The end of the content.
`.trim();
        it('removes wiki links', () => {
            const result = removeWikiLinks(mdWithWikiLinks);
            expect(result).toBe(mdWithoutWikiLinks);
        })
    })
    describe('removesObsidianComments', () => {
        const mdWithObsidianComments = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

%%
A secret.
%%

This is an example markdown file with frontmatter. It contains various %%secrets%% elements like images, headings, and text.

## Subheading

%%

Another secret.

%%

Here is some more text under a subheading. It provides additional information about the markdown file.

[[Alias1]]

- Bullet point one
- Bullet point two

[[Alias2]]

The end of the content.
`.trim();

const mdWithoutObsidianComments = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading



This is an example markdown file with frontmatter. It contains various  elements like images, headings, and text.

## Subheading



Here is some more text under a subheading. It provides additional information about the markdown file.

[[Alias1]]

- Bullet point one
- Bullet point two

[[Alias2]]

The end of the content.
`.trim();
        it('removes Obsidian comments', () => {
            const result = removeObsidianComments(mdWithObsidianComments);
            expect(result).toBe(mdWithoutObsidianComments);
        })
    })
})