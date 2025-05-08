import path from "path"
import { ensureRulesDirectoryExists, GlobalFileNames } from "@core/storage/disk"
import { fileExistsAtPath, isDirectory, readDirectory } from "@utils/fs"
import { formatResponse } from "@core/prompts/responses"
import fs from "fs/promises"
import { MayaiRulesToggles } from "@shared/mayai-rules"
import { getGlobalState, getWorkspaceState, updateGlobalState, updateWorkspaceState } from "@core/storage/state"
import * as vscode from "vscode"
import { synchronizeRuleToggles, getRuleFilesTotalContent } from "@core/context/instructions/user-instructions/rule-helpers"

/**
 * Converts .mayairules file to directory and places old .mayairule file inside directory, renaming it
 * Doesn't do anything if .mayairules dir already exists or doesn't exist
 * Returns whether there are any uncaught errors
 */
export async function ensureLocalMayairulesDirExists(cwd: string): Promise<boolean> {
	const mayairulePath = path.resolve(cwd, GlobalFileNames.mayaiRules)
	const defaultRuleFilename = "default-rules.md"

	try {
		const exists = await fileExistsAtPath(mayairulePath)

		if (exists && !(await isDirectory(mayairulePath))) {
			// logic to convert .mayairules file into directory, and rename the rules file to {defaultRuleFilename}
			const content = await fs.readFile(mayairulePath, "utf8")
			const tempPath = mayairulePath + ".bak"
			await fs.rename(mayairulePath, tempPath) // create backup
			try {
				await fs.mkdir(mayairulePath, { recursive: true })
				await fs.writeFile(path.join(mayairulePath, defaultRuleFilename), content, "utf8")
				await fs.unlink(tempPath).catch(() => {}) // delete backup

				return false // conversion successful with no errors
			} catch (conversionError) {
				// attempt to restore backup on conversion failure
				try {
					await fs.rm(mayairulePath, { recursive: true, force: true }).catch(() => {})
					await fs.rename(tempPath, mayairulePath) // restore backup
				} catch (restoreError) {}
				return true // in either case here we consider this an error
			}
		}
		// exists and is a dir or doesn't exist, either of these cases we dont need to handle here
		return false
	} catch (error) {
		return true
	}
}

export const getGlobalMayaiRules = async (globalMayaiRulesFilePath: string, toggles: MayaiRulesToggles) => {
	if (await fileExistsAtPath(globalMayaiRulesFilePath)) {
		if (await isDirectory(globalMayaiRulesFilePath)) {
			try {
				const rulesFilePaths = await readDirectory(globalMayaiRulesFilePath)
				const rulesFilesTotalContent = await getRuleFilesTotalContent(rulesFilePaths, globalMayaiRulesFilePath, toggles)
				if (rulesFilesTotalContent) {
					const mayaiRulesFileInstructions = formatResponse.mayaiRulesGlobalDirectoryInstructions(
						globalMayaiRulesFilePath,
						rulesFilesTotalContent,
					)
					return mayaiRulesFileInstructions
				}
			} catch {
				console.error(`Failed to read .mayairules directory at ${globalMayaiRulesFilePath}`)
			}
		} else {
			console.error(`${globalMayaiRulesFilePath} is not a directory`)
			return undefined
		}
	}

	return undefined
}

export const getLocalMayaiRules = async (cwd: string, toggles: MayaiRulesToggles) => {
	const mayaiRulesFilePath = path.resolve(cwd, GlobalFileNames.mayaiRules)

	let mayaiRulesFileInstructions: string | undefined

	if (await fileExistsAtPath(mayaiRulesFilePath)) {
		if (await isDirectory(mayaiRulesFilePath)) {
			try {
				const rulesFilePaths = await readDirectory(mayaiRulesFilePath)
				const rulesFilesTotalContent = await getRuleFilesTotalContent(rulesFilePaths, cwd, toggles)
				if (rulesFilesTotalContent) {
					mayaiRulesFileInstructions = formatResponse.mayaiRulesLocalDirectoryInstructions(cwd, rulesFilesTotalContent)
				}
			} catch {
				console.error(`Failed to read .mayairules directory at ${mayaiRulesFilePath}`)
			}
		} else {
			try {
				if (mayaiRulesFilePath in toggles && toggles[mayaiRulesFilePath] !== false) {
					const ruleFileContent = (await fs.readFile(mayaiRulesFilePath, "utf8")).trim()
					if (ruleFileContent) {
						mayaiRulesFileInstructions = formatResponse.mayaiRulesLocalFileInstructions(cwd, ruleFileContent)
					}
				}
			} catch {
				console.error(`Failed to read .mayairules file at ${mayaiRulesFilePath}`)
			}
		}
	}

	return mayaiRulesFileInstructions
}

export async function refreshMayaiRulesToggles(
	context: vscode.ExtensionContext,
	workingDirectory: string,
): Promise<{
	globalToggles: MayaiRulesToggles
	localToggles: MayaiRulesToggles
}> {
	// Global toggles
	const globalMayaiRulesToggles = ((await getGlobalState(context, "globalMayaiRulesToggles")) as MayaiRulesToggles) || {}
	const globalMayaiRulesFilePath = await ensureRulesDirectoryExists()
	const updatedGlobalToggles = await synchronizeRuleToggles(globalMayaiRulesFilePath, globalMayaiRulesToggles)
	await updateGlobalState(context, "globalMayaiRulesToggles", updatedGlobalToggles)

	// Local toggles
	const localMayaiRulesToggles = ((await getWorkspaceState(context, "localMayaiRulesToggles")) as MayaiRulesToggles) || {}
	const localMayaiRulesFilePath = path.resolve(workingDirectory, GlobalFileNames.mayaiRules)
	const updatedLocalToggles = await synchronizeRuleToggles(localMayaiRulesFilePath, localMayaiRulesToggles)
	await updateWorkspaceState(context, "localMayaiRulesToggles", updatedLocalToggles)

	return {
		globalToggles: updatedGlobalToggles,
		localToggles: updatedLocalToggles,
	}
}

export const createRuleFile = async (isGlobal: boolean, filename: string, cwd: string) => {
	try {
		let filePath: string
		if (isGlobal) {
			const globalMayaiRulesFilePath = await ensureRulesDirectoryExists()
			filePath = path.join(globalMayaiRulesFilePath, filename)
		} else {
			const localMayaiRulesFilePath = path.resolve(cwd, GlobalFileNames.mayaiRules)

			const hasError = await ensureLocalMayairulesDirExists(cwd)
			if (hasError === true) {
				return { filePath: null, fileExists: false }
			}

			await fs.mkdir(localMayaiRulesFilePath, { recursive: true })

			filePath = path.join(localMayaiRulesFilePath, filename)
		}

		const fileExists = await fileExistsAtPath(filePath)

		if (fileExists) {
			return { filePath, fileExists }
		}

		await fs.writeFile(filePath, "", "utf8")

		return { filePath, fileExists: false }
	} catch (error) {
		return { filePath: null, fileExists: false }
	}
}

export async function deleteRuleFile(
	context: vscode.ExtensionContext,
	rulePath: string,
	isGlobal: boolean,
): Promise<{ success: boolean; message: string }> {
	try {
		// Check if file exists
		const fileExists = await fileExistsAtPath(rulePath)
		if (!fileExists) {
			return {
				success: false,
				message: `Rule file does not exist: ${rulePath}`,
			}
		}

		// Delete the file from disk
		await fs.unlink(rulePath)

		// Get the filename for messages
		const fileName = path.basename(rulePath)

		// Update the appropriate toggles
		if (isGlobal) {
			const toggles = ((await getGlobalState(context, "globalMayaiRulesToggles")) as MayaiRulesToggles) || {}
			delete toggles[rulePath]
			await updateGlobalState(context, "globalMayaiRulesToggles", toggles)
		} else {
			const toggles = ((await getWorkspaceState(context, "localMayaiRulesToggles")) as MayaiRulesToggles) || {}
			delete toggles[rulePath]
			await updateWorkspaceState(context, "localMayaiRulesToggles", toggles)
		}

		return {
			success: true,
			message: `Rule file "${fileName}" deleted successfully`,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`Error deleting rule file: ${errorMessage}`, error)
		return {
			success: false,
			message: `Failed to delete rule file.`,
		}
	}
}
