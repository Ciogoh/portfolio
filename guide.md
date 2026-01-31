# Portfolio User Guide

Welcome to your new portfolio! This guide will help you manage your content.

## 1. Quick Start
To update your website after making any changes (adding projects, editing text), you **must** run the update script:

```bash
node scan_projects.js
```

Then refresh your browser.

---

## 2. Managing Projects
All your work lives in the `projects/` folder.

### Adding a New Project
1.  **Create a Folder**: Make a new folder inside `projects/` (e.g., `projects/my-new-shoot`).
2.  **Add Images**: Drag and drop your images (`.jpg`, `.png`, `.gif`) into this folder.
    -   *Tip*: The image named `01.jpg` (or alphabetically first) will be the cover image.
3.  **Add Description**: Create a `description.md` file in the folder. You can use Markdown!
    ```markdown
    # My Project Title
    This is a description.
    ```
4.  **Add Metadata (Optional)**: Create a `info.json` file for tags and dates.
    ```json
    ```json
    {
      "title": "Who is this for?",
      "date": "2024",
      "tags": ["Photography", "Editorial"]
    }
    ```
    *Note: Use `info.json` if you want special characters like `?` or `!` in the title, as folder names might not support them.*

### Deleting a Project
Simply delete the project folder and run the update script.

---

## 3. Editing "About Me"
Edit the file `about.md` in the main folder.
It supports full Markdown (bold, headings, links, lists).

After editing, run `node scan_projects.js` to apply changes.

---

## 4. Customization
-   **Styles**: Edit `css/style.css` to change colors, fonts, or spacing.
-   **Structure**: Edit `index.html` if you need to add more links or change the layout skeleton.

## 5. Troubleshooting
-   **Images not showing?** Check if they are valid image files (jpg, png).
-   **Changes not appearing?** Did you run `node scan_projects.js`?
-   **Browser Cache?** Try Hard Refresh (Cmd+Shift+R).
# Guide Changes

- Fixed visibility by removing nested blend modes.
- Ensured text is black on white (via difference mode) by default.
# Guide Updates

- Updated to 'Architectural Bold' style: Thicker borders (4px), Ultra-Bold text (900 weight), and tight spacing.
