// type that represents json data that is sent from extension to webview, called ExtensionMessage and has 'type' enum which can be 'plusButtonClicked' or 'settingsButtonClicked' or 'hello'

import { GitCommit } from "../utils/git"
import { ApiConfiguration, ModelInfo } from "./api"
import { AutoApprovalSettings } from "./AutoApprovalSettings"
import { BrowserSettings } from "./BrowserSettings"
import { ChatSettings } from "./ChatSettings"
import { HistoryItem } from "./HistoryItem"
import { McpServer, McpMarketplaceCatalog, McpDownloadResponse, McpViewTab } from "./mcp"
import { TelemetrySetting } from "./TelemetrySetting"
import type { BalanceResponse, UsageTransaction, PaymentTransaction } from "../shared/MayaiAccount"
import { MayaiRulesToggles } from "./mayai-rules"

// webview will hold state
export interface ExtensionMessage {
	type:
		| "action"
		| "state"
		| "selectedImages"
		| "ollamaModels"
		| "lmStudioModels"
		| "theme"
		| "workspaceUpdated"
		| "invoke"
		| "partialMessage"
		| "openRouterModels"
		| "openAiModels"
		| "requestyModels"
		| "mcpServers"
		| "relinquishControl"
		| "authCallback"
		| "mcpMarketplaceCatalog"
		| "mcpDownloadDetails"
		| "commitSearchResults"
		| "openGraphData"
		| "didUpdateSettings"
		| "userCreditsBalance"
		| "userCreditsUsage"
		| "userCreditsPayments"
		| "totalTasksSize"
		| "addToInput"
		| "browserConnectionResult"
		| "scrollToSettings"
		| "browserRelaunchResult"
		| "fileSearchResults"
		| "grpc_response" // New type for gRPC responses
		| "setActiveQuote"
	text?: string
	action?:
		| "chatButtonClicked"
		| "mcpButtonClicked"
		| "settingsButtonClicked"
		| "historyButtonClicked"
		| "didBecomeVisible"
		| "accountLogoutClicked"
		| "accountButtonClicked"
		| "focusChatInput"
	invoke?: Invoke
	state?: ExtensionState
	images?: string[]
	ollamaModels?: string[]
	lmStudioModels?: string[]
	vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[]
	filePaths?: string[]
	partialMessage?: MayaiMessage
	openRouterModels?: Record<string, ModelInfo>
	openAiModels?: string[]
	requestyModels?: Record<string, ModelInfo>
	mcpServers?: McpServer[]
	customToken?: string
	mcpMarketplaceCatalog?: McpMarketplaceCatalog
	error?: string
	mcpDownloadDetails?: McpDownloadResponse
	commits?: GitCommit[]
	openGraphData?: {
		title?: string
		description?: string
		image?: string
		url?: string
		siteName?: string
		type?: string
	}
	url?: string
	isImage?: boolean
	userCreditsBalance?: BalanceResponse
	userCreditsUsage?: UsageTransaction[]
	userCreditsPayments?: PaymentTransaction[]
	totalTasksSize?: number | null
	success?: boolean
	endpoint?: string
	isBundled?: boolean
	isConnected?: boolean
	isRemote?: boolean
	host?: string
	mentionsRequestId?: string
	results?: Array<{
		path: string
		type: "file" | "folder"
		label?: string
	}>
	tab?: McpViewTab
	grpc_response?: {
		message?: any // JSON serialized protobuf message
		request_id: string // Same ID as the request
		error?: string // Optional error message
		is_streaming?: boolean // Whether this is part of a streaming response
		sequence_number?: number // For ordering chunks in streaming responses
	}
}

export type Invoke = "sendMessage" | "primaryButtonClick" | "secondaryButtonClick"

export type Platform = "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "win32" | "unknown"

export const DEFAULT_PLATFORM = "unknown"

export interface ExtensionState {
	apiConfiguration?: ApiConfiguration
	autoApprovalSettings: AutoApprovalSettings
	browserSettings: BrowserSettings
	remoteBrowserHost?: string
	chatSettings: ChatSettings
	checkpointTrackerErrorMessage?: string
	mayaiMessages: MayaiMessage[]
	currentTaskItem?: HistoryItem
	customInstructions?: string
	mcpMarketplaceEnabled?: boolean
	planActSeparateModelsSetting: boolean
	platform: Platform
	shouldShowAnnouncement: boolean
	taskHistory: HistoryItem[]
	telemetrySetting: TelemetrySetting
	shellIntegrationTimeout: number
	uriScheme?: string
	userInfo?: {
		displayName: string | null
		email: string | null
		photoURL: string | null
	}
	version: string
	vscMachineId: string
	globalMayaiRulesToggles: MayaiRulesToggles
	localMayaiRulesToggles: MayaiRulesToggles
	localCursorRulesToggles: MayaiRulesToggles
	localWindsurfRulesToggles: MayaiRulesToggles
}

export interface MayaiMessage {
	ts: number
	type: "ask" | "say"
	ask?: MayaiAsk
	say?: MayaiSay
	text?: string
	reasoning?: string
	images?: string[]
	partial?: boolean
	lastCheckpointHash?: string
	isCheckpointCheckedOut?: boolean
	isOperationOutsideWorkspace?: boolean
	conversationHistoryIndex?: number
	conversationHistoryDeletedRange?: [number, number] // for when conversation history is truncated for API requests
}

export type MayaiAsk =
	| "followup"
	| "plan_mode_respond"
	| "command"
	| "command_output"
	| "completion_result"
	| "tool"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"
	| "mistake_limit_reached"
	| "auto_approval_max_req_reached"
	| "browser_action_launch"
	| "use_mcp_server"
	| "new_task"
	| "condense"

export type MayaiSay =
	| "task"
	| "error"
	| "api_req_started"
	| "api_req_finished"
	| "text"
	| "reasoning"
	| "completion_result"
	| "user_feedback"
	| "user_feedback_diff"
	| "api_req_retried"
	| "command"
	| "command_output"
	| "tool"
	| "shell_integration_warning"
	| "browser_action_launch"
	| "browser_action"
	| "browser_action_result"
	| "mcp_server_request_started"
	| "mcp_server_response"
	| "use_mcp_server"
	| "diff_error"
	| "deleted_api_reqs"
	| "mayaiignore_error"
	| "checkpoint_created"
	| "load_mcp_documentation"

export interface MayaiSayTool {
	tool:
		| "editedExistingFile"
		| "newFileCreated"
		| "readFile"
		| "listFilesTopLevel"
		| "listFilesRecursive"
		| "listCodeDefinitionNames"
		| "searchFiles"
	path?: string
	diff?: string
	content?: string
	regex?: string
	filePattern?: string
	operationIsLocatedInWorkspace?: boolean
}

// must keep in sync with system prompt
export const browserActions = ["launch", "click", "type", "scroll_down", "scroll_up", "close"] as const
export type BrowserAction = (typeof browserActions)[number]

export interface MayaiSayBrowserAction {
	action: BrowserAction
	coordinate?: string
	text?: string
}

export type BrowserActionResult = {
	screenshot?: string
	logs?: string
	currentUrl?: string
	currentMousePosition?: string
}

export interface MayaiAskUseMcpServer {
	serverName: string
	type: "use_mcp_tool" | "access_mcp_resource"
	toolName?: string
	arguments?: string
	uri?: string
}

export interface MayaiPlanModeResponse {
	response: string
	options?: string[]
	selected?: string
}

export interface MayaiAskQuestion {
	question: string
	options?: string[]
	selected?: string
}

export interface MayaiAskNewTask {
	context: string
}

export interface MayaiApiReqInfo {
	request?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	cancelReason?: MayaiApiReqCancelReason
	streamingFailedMessage?: string
}

export type MayaiApiReqCancelReason = "streaming_failed" | "user_cancelled"

export const COMPLETION_RESULT_CHANGES_FLAG = "HAS_CHANGES"
