import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { CSSProperties, memo } from "react"
import { getAsVar, VSC_DESCRIPTION_FOREGROUND, VSC_INACTIVE_SELECTION_BACKGROUND } from "@/utils/vscStyles"
import { Accordion, AccordionItem } from "@heroui/react"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}

const containerStyle: CSSProperties = {
	backgroundColor: getAsVar(VSC_INACTIVE_SELECTION_BACKGROUND),
	borderRadius: "3px",
	padding: "12px 16px",
	margin: "5px 15px 5px 15px",
	position: "relative",
	flexShrink: 0,
}
const closeIconStyle: CSSProperties = { position: "absolute", top: "8px", right: "8px" }
const h3TitleStyle: CSSProperties = { margin: "0 0 8px" }
const ulStyle: CSSProperties = { margin: "0 0 8px", paddingLeft: "12px" }
const accountIconStyle: CSSProperties = { fontSize: 11 }
const hrStyle: CSSProperties = {
	height: "1px",
	background: getAsVar(VSC_DESCRIPTION_FOREGROUND),
	opacity: 0.1,
	margin: "8px 0",
}
const linkContainerStyle: CSSProperties = { margin: "0" }
const linkStyle: CSSProperties = { display: "inline" }

/*
You must update the latestAnnouncementId in MayaiProvider for new announcements to show to users. This new id will be compared with what's in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ version, hideAnnouncement }: AnnouncementProps) => {
	const minorVersion = version.split(".").slice(0, 2).join(".") // 2.0.0 -> 2.0
	return (
		<div style={containerStyle}>
			<VSCodeButton appearance="icon" onClick={hideAnnouncement} style={closeIconStyle}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h3 style={h3TitleStyle}>
				🎉{"  "}New in v{minorVersion}
			</h3>
			<ul style={ulStyle}>
				<li>
					<b>Gemini prompt caching:</b> Gemini and Vertex providers now support prompt caching and price tracking for
					Gemini models.
				</li>
				<li>
					<b>Copy Buttons:</b> Buttons were added to Markdown and Code blocks that allow you to copy their contents
					easily.
				</li>
				<li>
					<b>/newrule command:</b> New slash command to have mayai write your .mayairules for you based on your
					workflow.
				</li>
				<li>
					<b>Drag and drop improvements:</b> Don't forget to hold shift while dragging files!
				</li>
				<li>Added more checkpoints across the task, allowing you to restore from more than just file changes.</li>
				<li>Added support for rendering LaTeX in message responses. (Try asking Mayai to show the quadratic formula)</li>
			</ul>
			<Accordion isCompact className="pl-0">
				<AccordionItem
					key="1"
					aria-label="Previous Updates"
					title="Previous Updates:"
					classNames={{
						trigger: "bg-transparent border-0 pl-0 pb-0 w-fit",
						title: "font-bold text-[var(--vscode-foreground)]",
						indicator:
							"text-[var(--vscode-foreground)] mb-0.5 -rotate-180 data-[open=true]:-rotate-90 rtl:rotate-0 rtl:data-[open=true]:-rotate-90",
					}}>
					<ul style={ulStyle}>
						<li>
							<b>Global Mayai Rules:</b> store multiple rules files in Documents/Mayai/Rules to share between
							projects.
						</li>
						<li>
							<b>Mayai Rules Popup:</b> New button in the chat area to view workspace and global mayai rules files
							to plug and play specific rules for the task
						</li>
						<li>
							<b>Slash Commands:</b> Type <code>/</code> in chat to see the list of quick actions, like starting a
							new task (more coming soon!)
						</li>
						<li>
							<b>Edit Messages:</b> You can now edit a message you sent previously by clicking on it. Optionally
							restore your project when the message was sent!
						</li>
					</ul>
				</AccordionItem>
			</Accordion>

			{/*
			// Leave this here for an example of how to structure the announcement
			<ul style={{ margin: "0 0 8px", paddingLeft: "12px" }}>
				 <li>
					OpenRouter now supports prompt caching! They also have much higher rate limits than other providers,
					so I recommend trying them out.
					<br />
					{!apiConfiguration?.openRouterApiKey && (
						<VSCodeButtonLink
							href={getOpenRouterAuthUrl(vscodeUriScheme)}
							style={{
								transform: "scale(0.85)",
								transformOrigin: "left center",
								margin: "4px -30px 2px 0",
							}}>
							Get OpenRouter API Key
						</VSCodeButtonLink>
					)}
					{apiConfiguration?.openRouterApiKey && apiConfiguration?.apiProvider !== "openrouter" && (
						<VSCodeButton
							onClick={() => {
								vscode.postMessage({
									type: "apiConfiguration",
									apiConfiguration: { ...apiConfiguration, apiProvider: "openrouter" },
								})
							}}
							style={{
								transform: "scale(0.85)",
								transformOrigin: "left center",
								margin: "4px -30px 2px 0",
							}}>
							Switch to OpenRouter
						</VSCodeButton>
					)}
				</li>
				<li>
					<b>Edit Mayai's changes before accepting!</b> When he creates or edits a file, you can modify his
					changes directly in the right side of the diff view (+ hover over the 'Revert Block' arrow button in
					the center to undo "<code>{"// rest of code here"}</code>" shenanigans)
				</li>
				<li>
					New <code>search_files</code> tool that lets Mayai perform regex searches in your project, letting
					him refactor code, address TODOs and FIXMEs, remove dead code, and more!
				</li>
				<li>
					When Mayai runs commands, you can now type directly in the terminal (+ support for Python
					environments)
				</li>
			</ul>*/}
			<div style={hrStyle} />
			<p style={linkContainerStyle}>
				Join us on{" "}
				<VSCodeLink style={linkStyle} href="https://x.com/mayai">
					X,
				</VSCodeLink>{" "}
				<VSCodeLink style={linkStyle} href="https://discord.gg/mayai">
					discord,
				</VSCodeLink>{" "}
				or{" "}
				<VSCodeLink style={linkStyle} href="https://www.reddit.com/r/mayai/">
					r/mayai
				</VSCodeLink>
				for more updates!
			</p>
		</div>
	)
}

export default memo(Announcement)
