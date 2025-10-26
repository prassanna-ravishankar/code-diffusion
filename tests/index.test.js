"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../src/index");
describe('Code Diffusion', () => {
    it('should export version', () => {
        expect(index_1.version).toBeDefined();
        expect(typeof index_1.version).toBe('string');
    });
});
//# sourceMappingURL=index.test.js.map