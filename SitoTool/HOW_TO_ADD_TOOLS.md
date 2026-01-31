# How to Add Scripts to the Archive

This website is designed to be a simple, static archive of your scripts. It works without a database by using a local JavaScript file (`tools.js`) to store the list of tools.

## Step 1: Add Your Script Folder
1.  Create a new folder in this directory for your new script (e.g., `My New Script`).
2.  Place your `index.html`, `sketch.js` (if p5.js), and other files inside that folder.
3.  Make sure your script works independently when you open its `index.html`.

## Step 2: Update `tools.js`
1.  Open `tools.js` in a text editor.
2.  You will see a list called `const tools = [ ... ];`.
3.  Add a new object to the list for your new script.

**Example Entry:**
```javascript
    {
        id: "my-new-script",
        title: "My New Script",
        description: "A short description of what this cool script does.",
        path: "My New Script/index.html", // Relative path to the folder you created
        date: "2024-01-29",
        tags: ["p5.js", "experiment", "visuals"]
    },
```

## Step 3: Refresh
1.  Open or refresh the main `index.html` file.
2.  Your new script card should appear automatically!

## Tips
-   **Tags**: Use consistent tags to make searching easier.
-   **Order**: The order in `tools.js` is the order they appear on the site. You can add new ones to the top if you want them first.
