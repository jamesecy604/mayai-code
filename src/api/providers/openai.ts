import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import { withRetry } from "../retry"
import { ApiHandlerOptions, azureOpenAiDefaultApiVersion, ModelInfo, openAiModelInfoSaneDefaults } from "@shared/api"
import { ApiHandler } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { convertToR1Format } from "../transform/r1-format"
import type { ChatCompletionReasoningEffort } from "openai/resources/chat/completions"
import { geminiDefaultModelId, GeminiModelId, geminiModels } from "../../shared/api"
import { DeepSeekModelId, deepSeekDefaultModelId, deepSeekModels } from "../../shared/api"
import { openRouterDefaultModelId, openRouterDefaultModelInfo } from "../../shared/api"
import { anthropicDefaultModelId, AnthropicModelId, anthropicModels } from "../../shared/api"
import { openAiNativeDefaultModelId, OpenAiNativeModelId, openAiNativeModels } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../utils/cost"

export class OpenAiHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		// Azure API shape slightly differs from the core API shape: https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
		// Use azureApiVersion to determine if this is an Azure endpoint, since the URL may not always contain 'azure.com'
		if (
			this.options.azureApiVersion ||
			((this.options.openAiBaseUrl?.toLowerCase().includes("azure.com") ||
				this.options.openAiBaseUrl?.toLowerCase().includes("azure.us")) &&
				!this.options.openAiModelId?.toLowerCase().includes("deepseek"))
		) {
			this.client = new AzureOpenAI({
				baseURL: this.options.openAiBaseUrl,
				apiKey: this.options.openAiApiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders: { ...this.options.openAiHeaders, "X-Task-ID": this.options.taskId },
			})
		} else {
			this.client = new OpenAI({
				baseURL: this.options.openAiBaseUrl,
				apiKey: this.options.openAiApiKey,
				defaultHeaders: { ...this.options.openAiHeaders, "X-Task-ID": this.options.taskId },
			})
		}
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const model = this.getModel()
		const modelId = model.id
		const isDeepseekReasoner = modelId.includes("deepseek-reasoner")
		const isR1FormatRequired = this.options.openAiModelInfo?.isR1FormatRequired ?? false
		const isReasoningModelFamily = modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")

		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]
		let temperature: number | undefined = this.options.openAiModelInfo?.temperature ?? openAiModelInfoSaneDefaults.temperature
		let reasoningEffort: ChatCompletionReasoningEffort | undefined = undefined
		let maxTokens: number | undefined

		if (this.options.openAiModelInfo?.maxTokens && this.options.openAiModelInfo.maxTokens > 0) {
			maxTokens = Number(this.options.openAiModelInfo.maxTokens)
		} else {
			maxTokens = undefined
		}

		if (isDeepseekReasoner || isR1FormatRequired) {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		if (isReasoningModelFamily) {
			openAiMessages = [{ role: "developer", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
			temperature = undefined // does not support temperature
			reasoningEffort = (this.options.o3MiniReasoningEffort as ChatCompletionReasoningEffort) || "medium"
		}

		const stream = await this.client.chat.completions.create({
			model: modelId,
			messages: openAiMessages,
			temperature,
			max_tokens: maxTokens,
			reasoning_effort: reasoningEffort,
			stream: true,
			stream_options: { include_usage: true },
		})
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					reasoning: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (chunk.usage) {
				yield* this.yieldUsage(model.info, chunk.usage)
			}
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

	private async *yieldUsage(info: ModelInfo, usage: OpenAI.Completions.CompletionUsage | undefined): ApiStream {
		interface openAiUsage extends OpenAI.CompletionUsage {
			prompt_cache_hit_tokens?: number
			prompt_cache_miss_tokens?: number
		}
		const deepUsage = usage as openAiUsage

		const inputTokens = deepUsage?.prompt_tokens || 0 // sum of cache hits and misses
		const outputTokens = deepUsage?.completion_tokens || 0
		const cacheReadTokens = deepUsage?.prompt_cache_hit_tokens || 0
		const cacheWriteTokens = deepUsage?.prompt_cache_miss_tokens || 0
		const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		const nonCachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens) // this will always be 0
		yield {
			type: "usage",
			inputTokens: inputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}
}
