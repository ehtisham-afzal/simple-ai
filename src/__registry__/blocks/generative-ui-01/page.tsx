"use client";

import { EditorLayout } from "@/registry/blocks/generative-ui-01/components/editor-layout";
import { Versions } from "@/registry/blocks/generative-ui-01/components/versions";

export default function Page() {
	return (
		<div className="flex w-screen h-screen justify-start">
			<Versions className="hidden md:flex" />
			<EditorLayout />
		</div>
	);
}
