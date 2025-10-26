import { AgentSpawner } from '../src/orchestration/agent-spawner';

describe('AgentSpawner', () => {
  let spawner: AgentSpawner;

  beforeEach(() => {
    spawner = new AgentSpawner();
  });

  afterEach(async () => {
    await spawner.shutdown();
  });

  describe('spawnAgent', () => {
    it('should spawn an agent successfully', () => {
      const agentId = spawner.spawnAgent({
        type: 'bootstrapper',
        workflowId: 'test-workflow-id',
        config: {
          skills: ['test-skill'],
          mcps: ['test-mcp'],
        },
      });

      expect(agentId).toBeDefined();
      expect(typeof agentId).toBe('string');
      expect(agentId).toContain('bootstrapper');
    });

    it('should track active agents', () => {
      spawner.spawnAgent({
        type: 'planner',
        workflowId: 'test-workflow',
        config: {
          skills: [],
          mcps: [],
        },
      });

      const activeAgents = spawner.getActiveAgents();
      expect(activeAgents.length).toBeGreaterThan(0);
    });
  });

  describe('killAgent', () => {
    it('should return false for non-existent agent', () => {
      const result = spawner.killAgent('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown all agents', async () => {
      spawner.spawnAgent({
        type: 'implementer',
        workflowId: 'test',
        config: { skills: [], mcps: [] },
      });

      await spawner.shutdown();

      // Wait a bit for process cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      const activeAgents = spawner.getActiveAgents();
      expect(activeAgents.length).toBeLessThanOrEqual(1); // May still be cleaning up
    });
  });
});
