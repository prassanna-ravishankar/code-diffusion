import { NotionCRUDService } from '../src/services/notion-crud.service';

describe('NotionCRUDService', () => {
  let service: NotionCRUDService;
  const mockApiKey = 'test_api_key';
  const mockDbIds = {
    workflowsDbId: 'workflow-db-id',
    stagePagesDbId: 'stage-db-id',
    subagentTasksDbId: 'task-db-id',
  };

  beforeEach(() => {
    service = new NotionCRUDService(mockApiKey, mockDbIds);
  });

  describe('constructor', () => {
    it('should initialize with API key and database IDs', () => {
      expect(service).toBeInstanceOf(NotionCRUDService);
    });
  });

  // Note: Full integration tests would require actual Notion API access
  // These are structural tests to ensure the service is properly set up
  describe('service structure', () => {
    it('should have createWorkflow method', () => {
      expect(typeof service.createWorkflow).toBe('function');
    });

    it('should have updateWorkflowStatus method', () => {
      expect(typeof service.updateWorkflowStatus).toBe('function');
    });

    it('should have getWorkflow method', () => {
      expect(typeof service.getWorkflow).toBe('function');
    });

    it('should have createStagePage method', () => {
      expect(typeof service.createStagePage).toBe('function');
    });

    it('should have updateStagePage method', () => {
      expect(typeof service.updateStagePage).toBe('function');
    });

    it('should have createSubagentTask method', () => {
      expect(typeof service.createSubagentTask).toBe('function');
    });

    it('should have updateSubagentTask method', () => {
      expect(typeof service.updateSubagentTask).toBe('function');
    });
  });
});
