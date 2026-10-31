module.exports = {
	// e2e specs run under wdio/Mocha (npm run test:e2e), and .claude/ holds agent worktrees
	// that contain copies of this repo's tests.
	testPathIgnorePatterns: ["/node_modules/", "<rootDir>/test/specs/", "<rootDir>/\\.claude/"],
	modulePathIgnorePatterns: ["<rootDir>/\\.claude/"],
};
