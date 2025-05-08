### .mayaiignore Support

To give you more control over which files are accessible to Mayai, we've implemented `.mayaiignore` functionality, similar to `.gitignore`. This allows you to specify files and directories that Mayai should **not** access or process. This is useful for:

*   **Privacy:** Preventing Mayai from accessing sensitive or private files in your workspace.
*   **Performance:**  Excluding large directories or files that are irrelevant to your tasks, potentially improving the efficiency of Mayai.
*   **Context Management:**  Focusing Mayai's attention on the relevant parts of your project.

**How to use `.mayaiignore`**

1.  **Create a `.mayaiignore` file:** In the root directory of your workspace (the same level as your `.vscode` folder, or the top level folder you opened in VS Code), create a new file named `.mayaiignore`.

2.  **Define ignore patterns:** Open the `.mayaiignore` file and specify the patterns for files and directories you want Mayai to ignore. The syntax is the same as `.gitignore`:

    *   Each line in the file represents a pattern.
    *   **Standard glob patterns are supported:**
        *   `*` matches zero or more characters
        *   `?` matches one character
        *   `[]` matches a character range
        *   `**` matches any number of directories and subdirectories.

    *   **Directory patterns:** Append `/` to the end of a pattern to specify a directory.
    *   **Negation patterns:** Start a pattern with `!` to negate (un-ignore) a previously ignored pattern.
    *   **Comments:** Start a line with `#` to add comments.

    **Example `.mayaiignore` file:**

    ```
    # Ignore log files
    *.log

    # Ignore the entire 'node_modules' directory
    node_modules/

    # Ignore all files in the 'temp' directory and its subdirectories
    temp/**

    # But DO NOT ignore 'important.log' even if it's in the root
    !important.log

    # Ignore any file named 'secret.txt' in any subdirectory
    **/secret.txt
    ```

3.  **Mayai respects your `.mayaiignore`:** Once you save the `.mayaiignore` file, Mayai will automatically recognize and apply these rules.

    *   **File Access Control:** Mayai will not be able to read the content of ignored files using tools like `read_file`. If you attempt to use a tool on an ignored file, Mayai will inform you that access is blocked due to `.mayaiignore` settings.
    *   **File Listing:** When you ask Mayai to list files in a directory (e.g., using `list_files`), ignored files and directories will still be listed, but they will be marked with a **🔒** symbol next to their name to indicate that they are ignored. This helps you understand which files Mayai can and cannot interact with.

4.  **Dynamic Updates:** Mayai monitors your `.mayaiignore` file for changes. If you modify, create, or delete your `.mayaiignore` file, Mayai will automatically update its ignore rules without needing to restart VS Code or the extension.

**In Summary**

The `.mayaiignore` file provides a powerful and flexible way to control Mayai's access to your workspace files, enhancing privacy, performance, and context management. By leveraging familiar `.gitignore` syntax, you can easily tailor Mayai's focus to the most relevant parts of your projects.