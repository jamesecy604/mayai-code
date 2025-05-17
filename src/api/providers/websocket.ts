import { WebSocket } from "ws"
import { withRetry } from "../retry"
import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "@shared/api"
import { ApiHandler } from "../index"
import { ApiStream } from "../transform/stream"
import { calculateApiCostOpenAI } from "../../utils/cost"
import { geminiDefaultModelId, GeminiModelId, geminiModels } from "../../shared/api"
import { DeepSeekModelId, deepSeekDefaultModelId, deepSeekModels } from "../../shared/api"
import { openRouterDefaultModelId, openRouterDefaultModelInfo } from "../../shared/api"
import { anthropicDefaultModelId, AnthropicModelId, anthropicModels } from "../../shared/api"
import { openAiNativeDefaultModelId, OpenAiNativeModelId, openAiNativeModels } from "../../shared/api"

interface WebSocketMessage {
	choices?: Array<{
		delta: {
			content?: string
			reasoning_content?: string
		}
		finish_reason?: string
	}>
	usage?: {
		prompt_tokens: number
		completion_tokens: number
		prompt_cache_miss_tokens: number
		prompt_cache_hit_tokens: number
	}
	error?: string
}

export class WebSocketHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private ws: WebSocket | null = null
	private connectionPromise: Promise<void> | null = null

	constructor(options: ApiHandlerOptions) {
		this.options = options
	}

	private async ensureConnected(): Promise<WebSocket> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return this.ws
		}

		if (!this.connectionPromise) {
			this.connectionPromise = new Promise((resolve, reject) => {
				const ws = new WebSocket(this.options.openAiBaseUrl || "ws://localhost:3001", {
					headers: {
						Authorization: `Bearer ${this.options.openAiApiKey}`,
						"X-Task-ID": this.options.taskId,
					},
				})

				ws.on("open", () => {
					this.ws = ws
					this.connectionPromise = null
					resolve()
				})

				ws.on("error", (err: Error) => {
					this.connectionPromise = null
					reject(err)
				})

				ws.on("close", () => {
					this.ws = null
					this.connectionPromise = null
				})
			})
		}

		await this.connectionPromise
		return this.ws!
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: any[]): ApiStream {
		const ws = await this.ensureConnected()
		const model = this.getModel()

		const payload = {
			messages: [{ role: "system", content: systemPrompt }, ...messages],
			model: model.id,
			temperature: this.options.openAiModelInfo?.temperature,
			max_tokens: this.options.openAiModelInfo?.maxTokens,
			stream: true,
		}

		ws.send(JSON.stringify(payload))

		const messageQueue: any[] = []
		let resolveNext: (() => void) | null = null
		let isStreamComplete = false

		const messageHandler = (data: Buffer) => {
			try {
				const chunk: WebSocketMessage = JSON.parse(data.toString())
				if (chunk.error) {
					throw new Error(chunk.error)
				}

				if (chunk.usage) {
					messageQueue.push({
						type: "usage",
						...this.getUsageData(model.info, chunk.usage),
					})
				}

				// Check for stream completion
				if (chunk.choices?.[0]?.finish_reason) {
					isStreamComplete = true
					if (resolveNext) {
						resolveNext()
					}
					return
				}

				if (chunk.choices?.[0]?.delta?.content) {
					messageQueue.push({
						type: "text",
						text: chunk.choices[0].delta.content,
					})
				}
				if (chunk.choices?.[0]?.delta?.reasoning_content) {
					messageQueue.push({
						type: "reasoning",
						reasoning: chunk.choices[0].delta.reasoning_content,
					})
				}

				if (resolveNext) {
					resolveNext()
					resolveNext = null
				}
			} catch (error) {
				isStreamComplete = true
				messageQueue.push(Promise.reject(error))
				if (resolveNext) {
					resolveNext()
				}
			}
		}

		ws.on("message", messageHandler)

		try {
			while (true) {
				if (messageQueue.length > 0) {
					const message = messageQueue.shift()
					if (message instanceof Promise) {
						throw await message
					}
					yield message
				} else if (isStreamComplete) {
					return
				} else {
					await new Promise<void>((resolve) => {
						resolveNext = resolve
					})
				}
			}
		} finally {
			ws.off("message", messageHandler)
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.openAiModelId
		if (modelId) {
			if (modelId in deepSeekModels) {
				const id = modelId as DeepSeekModelId
				return { id, info: deepSeekModels[id] }
			}
			if (modelId in geminiModels) {
				const id = modelId as GeminiModelId
				return { id, info: geminiModels[id] }
			}
			if (modelId in openAiNativeModels) {
				const id = modelId as OpenAiNativeModelId
				return { id, info: openAiNativeModels[id] }
			}
			if (modelId in anthropicModels) {
				const id = modelId as AnthropicModelId
				return { id, info: anthropicModels[id] }
			}
		}

		return {
			id: this.options.openAiModelId ?? "",
			info: this.options.openAiModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}

	private getUsageData(
		info: ModelInfo,
		usage: {
			prompt_tokens: number
			completion_tokens: number
			prompt_cache_hit_tokens: number
			prompt_cache_miss_tokens: number
		},
	) {
		return {
			inputTokens: usage.prompt_tokens || 0,
			outputTokens: usage.completion_tokens || 0,
			cacheWriteTokens: usage.prompt_cache_miss_tokens || 0,
			cacheReadTokens: usage.prompt_cache_hit_tokens || 0,
			totalCost: calculateApiCostOpenAI(
				info,
				usage.prompt_tokens || 0,
				usage.completion_tokens || 0,
				usage.prompt_cache_miss_tokens || 0,
				usage.prompt_cache_hit_tokens || 0,
			),
		}
	}
}
