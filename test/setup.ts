import { afterEach, vi } from 'vitest';

// Clean up mocks between tests to avoid bleed-over.
afterEach(() => {
	vi.clearAllMocks();
});
