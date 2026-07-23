import { describe, expect, it } from "vitest";
import { parseGitStatus } from "./git-status.js";

describe("parseGitStatus", () => {
	it("returns zero counts for a clean working tree", () => {
		expect(parseGitStatus("")).toEqual({
			staged: 0,
			modified: 0,
			deleted: 0,
			untracked: 0,
			renamed: 0,
			conflicted: 0,
		});
	});

	it("counts staged and unstaged changes independently", () => {
		expect(
			parseGitStatus("M  staged.ts\0 M edited.ts\0MM both.ts\0"),
		).toEqual({
			staged: 2,
			modified: 2,
			deleted: 0,
			untracked: 0,
			renamed: 0,
			conflicted: 0,
		});
	});

	it("counts deleted, untracked, renamed, and conflicted files", () => {
		expect(
			parseGitStatus(
				" D removed.ts\0?? new.ts\0R  renamed.ts\0old-name.ts\0UU conflict.ts\0",
			),
		).toEqual({
			staged: 1,
			modified: 0,
			deleted: 1,
			untracked: 1,
			renamed: 1,
			conflicted: 1,
		});
	});

	it("does not parse a rename source path as another status entry", () => {
		expect(parseGitStatus("R  renamed.ts\0?? old-name.ts\0")).toEqual({
			staged: 1,
			modified: 0,
			deleted: 0,
			untracked: 0,
			renamed: 1,
			conflicted: 0,
		});
	});

	it("ignores ignored files", () => {
		expect(parseGitStatus("!! generated.log\0")).toEqual({
			staged: 0,
			modified: 0,
			deleted: 0,
			untracked: 0,
			renamed: 0,
			conflicted: 0,
		});
	});
});
