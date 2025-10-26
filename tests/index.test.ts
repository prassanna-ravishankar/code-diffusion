import { version } from '../src/index';

describe('Code Diffusion', () => {
  it('should export version', () => {
    expect(version).toBeDefined();
    expect(typeof version).toBe('string');
  });
});
