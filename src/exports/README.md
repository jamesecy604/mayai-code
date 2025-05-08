# Mayai API

The Mayai extension exposes an API that can be used by other extensions. To use this API in your extension:

1. Copy `src/extension-api/mayai.d.ts` to your extension's source directory.
2. Include `mayai.d.ts` in your extension's compilation.
3. Get access to the API with the following code:

    ```ts
    const mayaiExtension = vscode.extensions.getExtension<MayaiAPI>("saoudrizwan.claude-dev")

    if (!mayaiExtension?.isActive) {
    	throw new Error("Mayai extension is not activated")
    }

    const mayai = mayaiExtension.exports

    if (mayai) {
    	// Now you can use the API

    	// Set custom instructions
    	await mayai.setCustomInstructions("Talk like a pirate")

    	// Get custom instructions
    	const instructions = await mayai.getCustomInstructions()
    	console.log("Current custom instructions:", instructions)

    	// Start a new task with an initial message
    	await mayai.startNewTask("Hello, Mayai! Let's make a new project...")

    	// Start a new task with an initial message and images
    	await mayai.startNewTask("Use this design language", ["data:image/webp;base64,..."])

    	// Send a message to the current task
    	await mayai.sendMessage("Can you fix the @problems?")

    	// Simulate pressing the primary button in the chat interface (e.g. 'Save' or 'Proceed While Running')
    	await mayai.pressPrimaryButton()

    	// Simulate pressing the secondary button in the chat interface (e.g. 'Reject')
    	await mayai.pressSecondaryButton()
    } else {
    	console.error("Mayai API is not available")
    }
    ```

    **Note:** To ensure that the `saoudrizwan.claude-dev` extension is activated before your extension, add it to the `extensionDependencies` in your `package.json`:

    ```json
    "extensionDependencies": [
        "saoudrizwan.claude-dev"
    ]
    ```

For detailed information on the available methods and their usage, refer to the `mayai.d.ts` file.
