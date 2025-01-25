import type { FlowEdge, FlowNode } from "@/registry/blocks/flow-01/types/flow";
import { NODE_TYPE_CONFIG } from "@/registry/blocks/flow-01/types/flow";
import type {
	WorkflowDefinition,
	WorkflowError,
	MultipleSourcesError,
	CycleError,
	MissingConnectionError,
	DependencyGraph,
	ConnectionMap,
} from "@/registry/blocks/flow-01/types/workflow";
import { nanoid } from "nanoid";

function buildDependencyGraph(edges: FlowEdge[]): {
	dependencies: DependencyGraph["dependencies"];
	dependents: DependencyGraph["dependents"];
	connectionMap: ConnectionMap;
} {
	const dependencies = new Map<
		string,
		{ node: string; sourceHandle: string }[]
	>();
	const dependents = new Map<
		string,
		{ node: string; targetHandle: string }[]
	>();
	const connectionMap = new Map<string, FlowEdge[]>();

	for (const edge of edges) {
		// Track connections per target handle
		const targetKey = `${edge.target}-${edge.targetHandle}`;
		const existingConnections = connectionMap.get(targetKey) || [];
		connectionMap.set(targetKey, [...existingConnections, edge]);

		// Build dependency graph
		const existingDependencies = dependencies.get(edge.target) || [];
		dependencies.set(edge.target, [
			...existingDependencies,
			{
				node: edge.source,
				sourceHandle: edge.sourceHandle,
			},
		]);

		const existingDependents = dependents.get(edge.source) || [];
		dependents.set(edge.source, [
			...existingDependents,
			{
				node: edge.target,
				targetHandle: edge.targetHandle,
			},
		]);
	}

	return { dependencies, dependents, connectionMap };
}

function topologicalSort(
	nodes: FlowNode[],
	dependencies: DependencyGraph["dependencies"],
	dependents: DependencyGraph["dependents"],
): string[] {
	const indegree = new Map<string, number>();
	const queue: string[] = [];
	const executionOrder: string[] = [];

	// Initialize in-degree
	for (const node of nodes) {
		const degree = dependencies.get(node.id)?.length || 0;
		indegree.set(node.id, degree);
		if (degree === 0) {
			queue.push(node.id);
		}
	}

	// Process nodes
	while (queue.length > 0) {
		const currentNode = queue.shift();
		if (!currentNode) {
			continue;
		}

		executionOrder.push(currentNode);

		const nodesDependentOnCurrent = dependents.get(currentNode) || [];
		for (const dependent of nodesDependentOnCurrent) {
			const currentDegree = indegree.get(dependent.node);
			if (typeof currentDegree === "number") {
				const newDegree = currentDegree - 1;
				indegree.set(dependent.node, newDegree);
				if (newDegree === 0) {
					queue.push(dependent.node);
				}
			}
		}
	}

	return executionOrder;
}

function validateMultipleSources(
	connectionMap: ConnectionMap,
): MultipleSourcesError[] {
	const errors: MultipleSourcesError[] = [];

	connectionMap.forEach((edges, targetKey) => {
		if (edges.length > 1) {
			const [targetNode, targetHandle] = targetKey.split("-");
			errors.push({
				type: "multiple-sources-for-target-handle",
				message: `Target handle "${targetHandle}" on node "${targetNode}" has ${edges.length} sources.`,
				edges: edges.map((edge) => ({
					id: edge.id,
					source: edge.source,
					target: edge.target,
					sourceHandle: edge.sourceHandle,
					targetHandle: edge.targetHandle,
				})),
			});
		}
	});

	return errors;
}

function detectCycles(
	nodes: FlowNode[],
	dependencies: DependencyGraph["dependencies"],
	dependents: DependencyGraph["dependents"],
	edges: FlowEdge[],
): CycleError[] {
	const executionOrder = topologicalSort(nodes, dependencies, dependents);
	if (executionOrder.length === nodes.length) {
		return [];
	}

	// Find cycle participants
	const indegree = new Map<string, number>();
	const queue: string[] = [];

	for (const node of nodes) {
		const degree = dependencies.get(node.id)?.length || 0;
		indegree.set(node.id, degree);
		if (degree === 0) {
			queue.push(node.id);
		}
	}

	// Kahn's algorithm to find remaining nodes
	while (queue.length > 0) {
		const currentNode = queue.shift();
		if (!currentNode) {
			continue;
		}

		const nodesDependentOnCurrent = dependents.get(currentNode) || [];
		for (const dependent of nodesDependentOnCurrent) {
			const currentDegree = indegree.get(dependent.node);
			if (typeof currentDegree === "number") {
				const newDegree = currentDegree - 1;
				indegree.set(dependent.node, newDegree);
				if (newDegree === 0) {
					queue.push(dependent.node);
				}
			}
		}
	}

	// Identify cycle nodes and edges
	const cycleNodes = Array.from(indegree.entries())
		.filter(([_, degree]) => degree > 0)
		.map(([nodeId]) => nodeId);

	const cycleEdges = edges.filter(
		(edge) =>
			cycleNodes.includes(edge.source) && cycleNodes.includes(edge.target),
	);

	if (cycleEdges.length === 0) {
		return [];
	}

	const error: CycleError = {
		type: "cycle",
		message: `Workflow contains cycles between nodes: ${cycleNodes.join(", ")}`,
		edges: cycleEdges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandle,
			targetHandle: edge.targetHandle,
		})),
	};

	return [error];
}

function validateRequiredHandles(
	nodes: FlowNode[],
	edges: FlowEdge[],
): MissingConnectionError[] {
	const errors: MissingConnectionError[] = [];
	const connectionsByTarget = new Map<string, FlowEdge[]>();
	const connectionsBySource = new Map<string, FlowEdge[]>();

	// Build connection maps
	for (const edge of edges) {
		const targetKey = `${edge.target}-${edge.targetHandle}`;
		const sourceKey = `${edge.source}-${edge.sourceHandle}`;

		const targetConnections = connectionsByTarget.get(targetKey) || [];
		connectionsByTarget.set(targetKey, [...targetConnections, edge]);

		const sourceConnections = connectionsBySource.get(sourceKey) || [];
		connectionsBySource.set(sourceKey, [...sourceConnections, edge]);
	}

	// Check each node against its type configuration
	for (const node of nodes) {
		const config = NODE_TYPE_CONFIG[node.type];

		// Check required target handles
		if (config.targets?.required) {
			for (const targetHandle of config.targets.required) {
				const key = `${node.id}-${targetHandle}`;
				const connections = connectionsByTarget.get(key);

				if (!connections || connections.length === 0) {
					errors.push({
						type: "missing-required-connection",
						message: `Node "${node.id}" requires a connection to its "${targetHandle}" input.`,
						node: {
							id: node.id,
							handleId: targetHandle,
						},
					});
				}
			}
		}

		// Check required source handles
		if (config.sources?.required) {
			for (const sourceHandle of config.sources.required) {
				const key = `${node.id}-${sourceHandle}`;
				const connections = connectionsBySource.get(key);

				if (!connections || connections.length === 0) {
					errors.push({
						type: "missing-required-connection",
						message: `Node "${node.id}" requires a connection from its "${sourceHandle}" output.`,
						node: {
							id: node.id,
							handleId: sourceHandle,
						},
					});
				}
			}
		}
	}

	return errors;
}

export function prepareWorkflow(
	nodes: FlowNode[],
	edges: FlowEdge[],
): WorkflowDefinition {
	const errors: WorkflowError[] = [];

	// First pass: Build dependency graph and check connection validity
	const { dependencies, dependents, connectionMap } =
		buildDependencyGraph(edges);

	/* console.log("dependencies", dependencies);
	console.log("dependents", dependents);
	console.log("connectionMap", connectionMap);
 */
	// Second pass: Validate multiple sources for single target handle
	errors.push(...validateMultipleSources(connectionMap));

	// Third pass: Detect cycles and get execution order
	const cycleErrors = detectCycles(nodes, dependencies, dependents, edges);
	errors.push(...cycleErrors);

	// Fourth pass: Validate required handles
	errors.push(...validateRequiredHandles(nodes, edges));

	// Get execution order if no cycles were detected
	const executionOrder =
		cycleErrors.length === 0
			? topologicalSort(nodes, dependencies, dependents)
			: [];

	return {
		id: nanoid(),
		nodes,
		edges,
		executionOrder,
		dependencies: Object.fromEntries(dependencies),
		dependents: Object.fromEntries(dependents),
		errors,
	};
}
