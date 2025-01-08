import {
	ChatMessage,
	ChatMessageAvatar,
	ChatMessageContent,
} from "@/registry/ui/chat-message";

export default function ChatMessageDemoBubble() {
	return (
		<div className="w-full px-4 py-8 space-y-4 border rounded-lg">
			<ChatMessage key="1" id="1" type="outgoing" variant="bubble">
				<ChatMessageContent content="Hey how are you?" />
				<ChatMessageAvatar />
			</ChatMessage>

			<ChatMessage key="2" id="2" type="incoming" variant="bubble">
				<ChatMessageAvatar />
				<ChatMessageContent content="I'm fine, thanks for asking!" />
			</ChatMessage>

			<ChatMessage key="3" id="3" type="outgoing" variant="bubble">
				<ChatMessageContent content="Great!" />
				<ChatMessageAvatar />
			</ChatMessage>
		</div>
	);
}
