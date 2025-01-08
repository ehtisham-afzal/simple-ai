import type { Registry } from "@/registry/schema";

export const examples: Registry = [
	{
		name: "chat-input-demo",
		type: "registry:example",
		registryDependencies: ["https://ai.alwurts.com/registry/chat-input.json"],
		files: [
			{
				path: "examples/chat-input-demo.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "markdown-content-demo",
		type: "registry:example",
		files: [
			{
				path: "examples/markdown-content-demo.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "markdown-streaming-demo",
		type: "registry:example",
		files: [
			{
				path: "examples/markdown-streaming-demo.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo-default",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo-default.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo-bubble",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo-bubble.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo-full",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo-full.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo-without-avatar",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo-without-avatar.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo-avatar-image",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo-avatar-image.tsx",
				type: "registry:example",
			},
		],
	},
	{
		name: "chat-message-demo-markdown-content",
		type: "registry:example",
		files: [
			{
				path: "examples/chat-message-demo-markdown-content.tsx",
				type: "registry:example",
			},
		],
	},
];
