import { WebSocket } from "ws"
import { withRetry } from "../retry"
import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "@shared/api"
import { ApiHandler } from "../index"
import { ApiStream } from "../transform/stream"
import { calculateApiCostOpenAI } from "../../utils/cost"

interface WebSocketMessage {
	choices?: Array<{
		delta: {
			content?: string
			reasoning_content?: string
		}
	}>
	usage?: {
		prompt_tokens: number
		completion_tokens: number
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

		let resolveNext: (value: any) => void
		let rejectNext: (reason?: any) => void
		let pendingPromise = new Promise<any>((resolve, reject) => {
			resolveNext = resolve
			rejectNext = reject
		})

		const messageHandler = (data: Buffer) => {
			try {
				const chunk: WebSocketMessage = JSON.parse(data.toString())
				if (chunk.error) {
					rejectNext(new Error(chunk.error))
					return
				}

				if (chunk.choices?.[0]?.delta?.content) {
					resolveNext({
						type: "text",
						text: chunk.choices[0].delta.content,
					})
				} else if (chunk.usage) {
					resolveNext({
						type: "usage",
						...this.getUsageData(model.info, chunk.usage),
					})
				}
			} catch (err) {
				rejectNext(err as Error)
			}

			pendingPromise = new Promise<any>((resolve, reject) => {
				resolveNext = resolve
				rejectNext = reject
			})
		}

		ws.on("message", messageHandler)

		try {
			while (true) {
				const result = await pendingPromise
				yield result
			}
		} finally {
			ws.off("message", messageHandler)
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.openAiModelId || "websocket-default",
			info: this.options.openAiModelInfo || openAiModelInfoSaneDefaults,
		}
	}

	private getUsageData(info: ModelInfo, usage: { prompt_tokens: number; completion_tokens: number }) {
		return {
			inputTokens: usage.prompt_tokens || 0,
			outputTokens: usage.completion_tokens || 0,
			cacheWriteTokens: 0,
			cacheReadTokens: 0,
			totalCost: calculateApiCostOpenAI(info, usage.prompt_tokens || 0, usage.completion_tokens || 0, 0, 0),
		}
	}
}
