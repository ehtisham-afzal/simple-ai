import { promises as fs, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registryCategories } from "@/registry/registry-categories";
import { rimraf } from "rimraf";
import { Project, ScriptKind } from "ts-morph";
import type { z } from "zod";
import { registry } from "../registry";
import {
	type Registry,
	registryItemSchema,
	type registryItemTypeSchema,
	registrySchema,
} from "../registry/schema";

const REGISTRY_INDEX_WHITELIST: z.infer<typeof registryItemTypeSchema>[] = [
	"registry:ui",
	"registry:lib",
	"registry:hook",
	//"registry:theme",
	"registry:block",
	"registry:example",
	//"registry:internal",
];

const REGISTRY_BASE_PATH = "src/registry";
const REGISTRY_PUBLIC_PATH = "public/r";
const REGISTRY_GENERATED_PATH = "src/__registry__";

const project = new Project({
	compilerOptions: {},
});

async function createTempSourceFile(filename: string) {
	const dir = await fs.mkdtemp(path.join(tmpdir(), "simple-ai-"));
	return path.join(dir, filename);
}

// ----------------------------------------------------------------------------
// Build __registry__/index.tsx. and public/registry/index.json.
// ----------------------------------------------------------------------------
async function buildRegistry(registry: Registry) {
	let index = `// @ts-nocheck
// This file is autogenerated by scripts/build-registry.ts
// Do not edit this file directly.
import * as React from "react"

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const Index: Record<string, any> = {
`;

	for (const item of registry) {
		// Turns blocks/chat-01/page.tsx into src/registry/blocks/chat-01/page.tsx
		const resolveFiles = item.files?.map(
			(file) => `${REGISTRY_BASE_PATH}/${file.path}`,
		);
		if (!resolveFiles) {
			continue;
		}

		// Validate categories from registry-categories.ts.
		if (item.categories) {
			const invalidCategories = item.categories.filter(
				(category) => !registryCategories.some((c) => c.slug === category),
			);

			if (invalidCategories.length > 0) {
				console.error(
					`${item.name} has invalid categories: ${invalidCategories}`,
				);
				process.exit(1);
			}
		}

		// Gets the type of the item, e.g. "registry:block" -> "block"
		const type = item.type.split(":")[1];

		let sourceFilename = "";

		if (item.type === "registry:block") {
			const file = resolveFiles[0];
			const filename = path.basename(file);
			let raw: string;
			try {
				raw = await fs.readFile(file, "utf8");
			} catch (_) {
				continue;
			}
			const tempFile = await createTempSourceFile(filename);
			const sourceFile = project.createSourceFile(tempFile, raw, {
				scriptKind: ScriptKind.TSX,
			});

			// Write the source file for blocks only.
			// We always have files?, so we can use the first file as the component path always?
			sourceFilename = `${REGISTRY_GENERATED_PATH}/${item.name}/${type}/${item.name}.tsx`;

			if (item.files) {
				if (item.files?.length) {
					sourceFilename = `${REGISTRY_GENERATED_PATH}/${item.files[0].path}`;
				}
			}

			const sourcePath = path.join(process.cwd(), sourceFilename);
			if (!existsSync(sourcePath)) {
				await fs.mkdir(sourcePath, { recursive: true });
			}

			rimraf.sync(sourcePath);
			await fs.writeFile(sourcePath, sourceFile.getText());
		}

		// We always have files?, so we can use the first file as the component path always?
		let componentPath = `@/registry/${type}/${item.name}`;

		if (item.files) {
			if (item.files.length) {
				componentPath = `@/registry/${item.files[0].path}`;
			}
		}

		index += `	"${item.name}": {
		name: "${item.name}",
		description: "${item.description ?? ""}",
		type: "${item.type}",
		registryDependencies: ${JSON.stringify(item.registryDependencies)},
		files: [${item.files?.map((file) => {
			const filePath = `${REGISTRY_BASE_PATH}/${file.path}`;
			return `{
			path: "${filePath}",
			type: "${file.type}",
			target: "${file.target ?? ""}"
		}`;
		})}],
		categories: ${JSON.stringify(item.categories)},
		component: React.lazy(() => import("${componentPath}")),
		source: "${sourceFilename}",
		meta: ${JSON.stringify(item.meta)},
    },`;
	}

	index += `
}
`;
	const generatedPath = path.join(process.cwd(), REGISTRY_GENERATED_PATH);
	rimraf.sync(path.join(generatedPath, "index.tsx"));
	await fs.writeFile(path.join(generatedPath, "index.tsx"), index, "utf8");

	// Create public/registry/index.json with registry:ui items. Might not be needed?

	const uiRegistryItems = registry.filter((item) =>
		["registry:ui"].includes(item.type),
	);

	const publicPath = path.join(process.cwd(), REGISTRY_PUBLIC_PATH);
	const registryJson = JSON.stringify(uiRegistryItems, null, 2);
	rimraf.sync(path.join(publicPath, "index.json"));
	await fs.writeFile(path.join(publicPath, "index.json"), registryJson, "utf8");
}

// ----------------------------------------------------------------------------
// Build public/registry/[name].json.
// ----------------------------------------------------------------------------
async function buildStyles(registry: Registry) {
	const targetPath = path.join(process.cwd(), REGISTRY_PUBLIC_PATH);
	// Create directory if it doesn't exist.
	if (!existsSync(targetPath)) {
		await fs.mkdir(targetPath, { recursive: true });
	}

	for (const item of registry) {
		if (!REGISTRY_INDEX_WHITELIST.includes(item.type)) {
			continue;
		}

		// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
		let files;
		if (item.files) {
			files = await Promise.all(
				item.files.map(async (file) => {
					let content: string;
					try {
						content = await fs.readFile(
							path.join(process.cwd(), REGISTRY_BASE_PATH, file.path),
							"utf8",
						);
					} catch (_) {
						return;
					}

					const tempFile = await createTempSourceFile(file.path);
					const sourceFile = project.createSourceFile(tempFile, content, {
						scriptKind: ScriptKind.TSX,
					});

					// Replace @/registry/ui imports with @/components/ui
					for (const importDecl of sourceFile.getImportDeclarations()) {
						const moduleSpecifier = importDecl.getModuleSpecifierValue();

						// Handle @/registry/ui/flow imports first
						if (moduleSpecifier.startsWith("@/registry/ui/flow")) {
							importDecl.setModuleSpecifier(
								moduleSpecifier.replace(
									"@/registry/ui/flow",
									"@/components/flow",
								),
							);
						}
						// Handle other @/registry/ui imports
						else if (moduleSpecifier.startsWith("@/registry/ui")) {
							importDecl.setModuleSpecifier(
								moduleSpecifier.replace("@/registry/ui", "@/components/ui"),
							);
						}
						if (moduleSpecifier.startsWith("@/registry/lib")) {
							importDecl.setModuleSpecifier(
								moduleSpecifier.replace("@/registry/lib", "@/lib"),
							);
						}
						if (moduleSpecifier.startsWith("@/registry/hooks")) {
							importDecl.setModuleSpecifier(
								moduleSpecifier.replace("@/registry/hooks", "@/hooks"),
							);
						}
						if (
							moduleSpecifier.startsWith(
								`@/registry/blocks/${item.name}/components`,
							)
						) {
							importDecl.setModuleSpecifier(
								moduleSpecifier.replace(
									`@/registry/blocks/${item.name}/components`,
									"@/components",
								),
							);
						}
					}

					sourceFile.getVariableDeclaration("iframeHeight")?.remove();
					sourceFile.getVariableDeclaration("containerClassName")?.remove();
					sourceFile.getVariableDeclaration("description")?.remove();

					// Remove tracking code
					// Remove the import
					for (const importDecl of sourceFile.getImportDeclarations()) {
						if (importDecl.getModuleSpecifierValue() === "@/lib/events") {
							importDecl.remove();
						}
					}

					let code = sourceFile.getFullText();

					// Remove track variable declaration
					code = code.replace(
						/const\s+track\s*=\s*useTrackEvent\(\);?\n?/g,
						"",
					);

					// Remove track function calls - handles multiline with any indentation
					code = code.replace(
						/\n(\t|\s)*track\(\{\n(\t|\s)*name:[\s\S]*?\}\s*\)\s*;/g,
						"",
					);

					// Update source file with cleaned code
					sourceFile.replaceWithText(code);

					const target = file.target || "";

					return {
						path: file.path,
						type: file.type,
						content: sourceFile.getText(),
						target,
					};
				}),
			);
		}

		const payload = registryItemSchema.safeParse({
			...item,
			files,
		});

		if (payload.success) {
			await fs.writeFile(
				path.join(targetPath, `${item.name}.json`),
				JSON.stringify(payload.data, null, 2),
				"utf8",
			);
		}
	}
}

const main = async () => {
	try {
		console.log("💽 Building registry...");
		const result = registrySchema.safeParse(registry);

		if (!result.success) {
			console.error(result.error);
			process.exit(1);
		}

		await buildRegistry(result.data);
		await buildStyles(result.data);

		console.log("✅ Done!\n");
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
};

main();
