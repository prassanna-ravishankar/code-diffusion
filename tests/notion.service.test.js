"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notion_service_1 = require("../src/services/notion.service");
describe('NotionService', () => {
    let service;
    const mockApiKey = 'test_api_key';
    beforeEach(() => {
        service = new notion_service_1.NotionService(mockApiKey);
    });
    describe('constructor', () => {
        it('should initialize with API key', () => {
            expect(service).toBeInstanceOf(notion_service_1.NotionService);
        });
    });
    describe('getDatabaseIds', () => {
        it('should return empty IDs initially', () => {
            const ids = service.getDatabaseIds();
            expect(ids.workflowsDbId).toBeUndefined();
            expect(ids.stagePagesDbId).toBeUndefined();
            expect(ids.subagentTasksDbId).toBeUndefined();
        });
    });
    describe('setDatabaseIds', () => {
        it('should set database IDs', () => {
            const testIds = {
                workflowsDbId: 'workflow-id',
                stagePagesDbId: 'stage-id',
                subagentTasksDbId: 'task-id',
            };
            service.setDatabaseIds(testIds);
            const ids = service.getDatabaseIds();
            expect(ids.workflowsDbId).toBe(testIds.workflowsDbId);
            expect(ids.stagePagesDbId).toBe(testIds.stagePagesDbId);
            expect(ids.subagentTasksDbId).toBe(testIds.subagentTasksDbId);
        });
    });
});
//# sourceMappingURL=notion.service.test.js.map