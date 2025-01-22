import {
	type NodeProps,
	Position,
	useUpdateNodeInternals,
} from "@xyflow/react";

import { BaseNode } from "@/components/flow/base-node";
import { LabeledHandle } from "@/components/flow/labeled-handle";
import {
	NodeHeaderAction,
	NodeHeaderIcon,
	NodeHeaderTitle,
} from "@/components/flow/node-header";
import { NodeHeader, NodeHeaderActions } from "@/components/flow/node-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EditableToolHandle } from "@/registry/blocks/flow-01/components/flow/editable-tool-handle";
import {
	MODELS,
	type TGenerateTextNode,
	type TModel,
	useStore,
} from "@/registry/blocks/flow-01/hooks/store";
import { Bot, Plus, Trash } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

export function GenerateTextNode({
	id,
	selected,
	deletable,
	data,
}: NodeProps<TGenerateTextNode>) {
	const updateNode = useStore((state) => state.updateNode);
	const addDynamicTool = useStore((state) => state.addDynamicTool);
	const removeDynamicTool = useStore((state) => state.removeDynamicTool);
	const runtime = useStore((state) => state.runtime);
	const isProcessing = runtime.isRunning && runtime.currentNodeIds.includes(id);
	const updateNodeInternals = useUpdateNodeInternals();

	const handleModelChange = useCallback(
		(value: string) => {
			updateNode(id, {
				config: {
					...data.config,
					model: value as TModel,
				},
			});
		},
		[id, data.config, updateNode],
	);

	const addTool = useCallback(() => {
		addDynamicTool(id);
		updateNodeInternals(id);
	}, [id, addDynamicTool, updateNodeInternals]);

	const removeTool = useCallback(
		(toolId: string) => {
			removeDynamicTool(id, toolId);
			updateNodeInternals(id);
		},
		[id, removeDynamicTool, updateNodeInternals],
	);

	const updateTool = useCallback(
		(toolId: string, newName: string, newDescription: string): boolean => {
			if (!newName) {
				toast.error("Tool name cannot be empty");
				return false;
			}

			const existingTool = data.config.tools.find(
				(tool) => tool.name === newName && tool.id !== toolId,
			);
			if (existingTool) {
				toast.error("Tool name already exists");
				return false;
			}

			updateNode(id, {
				config: {
					...data.config,
					tools: data.config.tools.map((tool) =>
						tool.id === toolId
							? { ...tool, name: newName, description: newDescription }
							: tool,
					),
				},
			});
			updateNodeInternals(id);
			return true;
		},
		[id, data.config, updateNode, updateNodeInternals],
	);

	const executionStatus = data.lastRun?.status || "idle";
	const statusColors = {
		idle: "bg-muted text-muted-foreground",
		processing: "bg-orange-500 text-white",
		success: "bg-green-500 text-white",
		error: "bg-red-500 text-white",
	};

	return (
		<BaseNode
			selected={selected}
			isProcessing={isProcessing}
			className="px-0 pb-0 flex flex-col w-[350px]"
		>
			<NodeHeader className="px-8 mb-0">
				<NodeHeaderIcon>
					<Bot />
				</NodeHeaderIcon>
				<NodeHeaderTitle>Generate Text</NodeHeaderTitle>
				<NodeHeaderActions>
					<Badge
						variant="secondary"
						className={cn("mr-2 font-normal", statusColors[executionStatus])}
					>
						{executionStatus}
					</Badge>
					{deletable && <NodeHeaderDeleteAction id={id} />}
				</NodeHeaderActions>
			</NodeHeader>
			<Separator />
			<div className="p-4 flex flex-col gap-4">
				<Select value={data.config.model} onValueChange={handleModelChange}>
					<SelectTrigger className="w-full nodrag">
						<SelectValue placeholder="Select model" />
					</SelectTrigger>
					<SelectContent>
						{MODELS.map((model) => (
							<SelectItem key={model} value={model}>
								{model}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="grid grid-cols-[2fr,1fr] gap-2 pt-2 text-sm">
				<div className="flex flex-col gap-2 min-w-0">
					<LabeledHandle
						id="system"
						title="System"
						type="target"
						position={Position.Left}
					/>
					<LabeledHandle
						id="prompt"
						title="Prompt"
						type="target"
						position={Position.Left}
						className="col-span-2"
					/>
				</div>
				<div className="justify-self-end">
					<LabeledHandle
						id="output"
						title="Result"
						type="source"
						position={Position.Right}
					/>
				</div>
			</div>
			<div className="border-t border-border mt-2">
				<div>
					<div className="flex items-center justify-between py-2 px-4 bg-muted">
						<span className="text-sm font-medium">Tools</span>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2"
							onClick={addTool}
						>
							<Plus className="h-4 w-4 mr-1" />
							New Tool
						</Button>
					</div>
					<div className="flex flex-col">
						{data.config.tools.map((tool) => (
							<EditableToolHandle
								key={tool.id}
								nodeId={id}
								handleId={tool.id}
								name={tool.name}
								description={tool.description}
								type="source"
								position={Position.Right}
								wrapperClassName="w-full"
								onToolChange={updateTool}
								onDelete={removeTool}
							/>
						))}
					</div>
				</div>
			</div>
		</BaseNode>
	);
}

const NodeHeaderDeleteAction = ({ id }: { id: string }) => {
	const deleteNode = useStore((state) => state.deleteNode);
	const handleClick = useCallback(() => {
		deleteNode(id);
	}, [id, deleteNode]);

	return (
		<NodeHeaderAction onClick={handleClick} variant="ghost" label="Delete node">
			<Trash />
		</NodeHeaderAction>
	);
};
