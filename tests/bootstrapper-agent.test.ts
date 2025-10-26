import { BootstrapperAgent, type BootstrapperConfig } from '../src/agents/bootstrapper-agent';

describe('BootstrapperAgent', () => {
  let config: BootstrapperConfig;

  beforeEach(() => {
    config = {
      agentId: 'test-bootstrapper-1',
      workflowId: 'test-workflow-id',
      notionApiKey: 'test-notion-key',
      claudeApiKey: 'test-claude-key',
      codebasePath: '/test/path',
      maxAnalysisDepth: 3,
      enableDependencyAnalysis: true,
    };
  });

  describe('Constructor', () => {
    it('should create a BootstrapperAgent instance', () => {
      const agent = new BootstrapperAgent(config);

      expect(agent).toBeInstanceOf(BootstrapperAgent);
      expect(agent.getStatus().agentId).toBe('test-bootstrapper-1');
      expect(agent.getStatus().type).toBe('BootstrapperAgent');
    });

    it('should require agent ID', () => {
      const invalidConfig = { ...config, agentId: '' };

      expect(() => new BootstrapperAgent(invalidConfig)).toThrow('Agent ID is required');
    });

    it('should require Notion API key', () => {
      const invalidConfig = { ...config, notionApiKey: '' };

      expect(() => new BootstrapperAgent(invalidConfig)).toThrow('Notion API key is required');
    });

    it('should require Claude API key', () => {
      const invalidConfig = { ...config, claudeApiKey: '' };

      expect(() => new BootstrapperAgent(invalidConfig)).toThrow('Claude API key is required');
    });
  });

  describe('Status', () => {
    it('should report not running initially', () => {
      const agent = new BootstrapperAgent(config);
      const status = agent.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.agentId).toBe('test-bootstrapper-1');
      expect(status.type).toBe('BootstrapperAgent');
    });
  });

  describe('Stop', () => {
    it('should stop the agent', () => {
      const agent = new BootstrapperAgent(config);

      agent.stop();

      expect(agent.getStatus().isRunning).toBe(false);
    });
  });
});
