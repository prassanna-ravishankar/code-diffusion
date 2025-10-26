/**
 * Bootstrapper Agent for Code Diffusion
 * Analyzes feature requests and explores codebases to generate workflow specifications
 */

import { BaseAgent, type BaseAgentConfig } from './base-agent';
import Anthropic from '@anthropic-ai/sdk';
import { NotionCRUDService } from '../services/notion-crud.service';

export interface BootstrapperConfig extends BaseAgentConfig {
  codebasePath?: string;
  repositoryUrls?: string[];
  maxAnalysisDepth?: number;
  enableDependencyAnalysis?: boolean;
}

export interface WorkflowSpec {
  workflowId: string;
  featureRequest: string;
  targetRepositories: string[];
  codebaseContext: CodebaseContext;
  stages: StageSpec[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  suggestedApproach: string;
}

export interface CodebaseContext {
  languages: string[];
  frameworks: string[];
  patterns: string[];
  keyFiles: string[];
  dependencies: Record<string, string>;
  architecture: string;
}

export interface StageSpec {
  type: 'bootstrap' | 'plan' | 'implement';
  description: string;
  requiredSkills: string[];
  requiredMcps: string[];
  estimatedDuration: string;
}

/**
 * Bootstrapper Agent - Stage 1 of the diffusion model
 * Performs initial analysis and generates workflow specifications
 */
export class BootstrapperAgent extends BaseAgent {
  private anthropic: Anthropic;
  private notionService: NotionCRUDService;
  private bootstrapperConfig: BootstrapperConfig;

  constructor(config: BootstrapperConfig) {
    super(config);
    this.bootstrapperConfig = config;

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.claudeApiKey,
    });

    // Initialize Notion service with placeholder database IDs
    // In production, these would come from environment or config
    this.notionService = new NotionCRUDService(config.notionApiKey, {
      workflowsDbId: process.env['NOTION_WORKFLOWS_DB_ID'] || '',
      stagePagesDbId: process.env['NOTION_STAGE_PAGES_DB_ID'] || '',
      subagentTasksDbId: process.env['NOTION_SUBAGENT_TASKS_DB_ID'] || '',
    });

    this.logger.info('BootstrapperAgent initialized', {
      agentId: config.agentId,
      workflowId: config.workflowId,
      codebasePath: config.codebasePath,
      maxAnalysisDepth: config.maxAnalysisDepth || 3,
    });
  }

  protected getAgentType(): string {
    return 'BootstrapperAgent';
  }

  /**
   * Main execution method
   */
  async execute(): Promise<void> {
    this.logger.info('Starting bootstrapper execution', {
      workflowId: this.config.workflowId,
    });

    try {
      // Step 1: Fetch feature request from Notion
      const featureRequest = await this.fetchFeatureRequest();
      this.logger.info('Feature request fetched', { length: featureRequest.length });

      // Step 2: Analyze codebase (to be implemented in next subtasks)
      const codebaseContext = this.analyzeCodebase();
      this.logger.info('Codebase analysis complete', { context: codebaseContext });

      // Step 3: Generate workflow specification using Claude
      const workflowSpec = await this.generateWorkflowSpec(featureRequest, codebaseContext);
      this.logger.info('Workflow specification generated', {
        complexity: workflowSpec.estimatedComplexity,
      });

      // Step 4: Write results to Notion
      await this.writeResultsToNotion(workflowSpec);
      this.logger.info('Results written to Notion');
    } catch (error) {
      this.logger.error('Bootstrapper execution failed', { error });
      throw error;
    }
  }

  /**
   * Fetch feature request from Notion workflow page
   */
  private async fetchFeatureRequest(): Promise<string> {
    if (!this.config.workflowId) {
      throw new Error('Workflow ID is required for bootstrapper');
    }

    this.logger.debug('Fetching workflow from Notion', { workflowId: this.config.workflowId });

    // Fetch workflow page from Notion
    const workflow = await this.notionService.getWorkflow(this.config.workflowId);

    // Extract request field
    const request = workflow.properties['Request'];
    if (request && request.type === 'rich_text') {
      return request.rich_text.map((rt) => rt.plain_text).join('');
    }

    throw new Error('No feature request found in workflow');
  }

  /**
   * Analyze codebase to extract context
   * This is a placeholder - will be implemented in subtasks 5.2-5.4
   */
  private analyzeCodebase(): CodebaseContext {
    this.logger.info('Analyzing codebase', {
      path: this.bootstrapperConfig.codebasePath,
      depth: this.bootstrapperConfig.maxAnalysisDepth,
    });

    // Placeholder implementation
    // Will be replaced with actual file scanning, AST parsing, and dependency analysis
    return {
      languages: ['TypeScript', 'JavaScript'],
      frameworks: ['Node.js', 'Express'],
      patterns: ['MVC', 'Service Layer'],
      keyFiles: [],
      dependencies: {},
      architecture: 'Microservices',
    };
  }

  /**
   * Generate workflow specification using Claude AI
   */
  private async generateWorkflowSpec(
    featureRequest: string,
    codebaseContext: CodebaseContext
  ): Promise<WorkflowSpec> {
    this.logger.info('Generating workflow specification with Claude');

    const prompt = this.buildWorkflowSpecPrompt(featureRequest, codebaseContext);

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n');

    this.logger.debug('Claude response received', { length: responseText.length });

    // Parse JSON response
    const workflowSpec = this.parseWorkflowSpec(responseText);

    return workflowSpec;
  }

  /**
   * Build prompt for Claude API
   */
  private buildWorkflowSpecPrompt(
    featureRequest: string,
    codebaseContext: CodebaseContext
  ): string {
    return `You are an expert software architect analyzing a feature request for a development workflow.

Feature Request:
${featureRequest}

Codebase Context:
- Languages: ${codebaseContext.languages.join(', ')}
- Frameworks: ${codebaseContext.frameworks.join(', ')}
- Architecture: ${codebaseContext.architecture}
- Patterns: ${codebaseContext.patterns.join(', ')}

Generate a comprehensive workflow specification that includes:
1. Overall complexity assessment (low/medium/high)
2. Suggested implementation approach
3. Required stages with skills and tools needed
4. Key considerations and potential challenges

Return your response as a valid JSON object matching this structure:
{
  "estimatedComplexity": "low" | "medium" | "high",
  "suggestedApproach": "description of recommended approach",
  "stages": [
    {
      "type": "bootstrap" | "plan" | "implement",
      "description": "what this stage does",
      "requiredSkills": ["skill1", "skill2"],
      "requiredMcps": ["mcp1", "mcp2"],
      "estimatedDuration": "time estimate"
    }
  ],
  "keyConsiderations": ["consideration1", "consideration2"]
}`;
  }

  /**
   * Parse workflow specification from Claude response
   */
  private parseWorkflowSpec(response: string): WorkflowSpec {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, response];
      const jsonStr = jsonMatch[1] || response;

      const parsed = JSON.parse(jsonStr) as {
        estimatedComplexity: 'low' | 'medium' | 'high';
        suggestedApproach: string;
        stages: StageSpec[];
      };

      return {
        workflowId: this.config.workflowId || '',
        featureRequest: '',
        targetRepositories: this.bootstrapperConfig.repositoryUrls || [],
        codebaseContext: {
          languages: [],
          frameworks: [],
          patterns: [],
          keyFiles: [],
          dependencies: {},
          architecture: '',
        },
        estimatedComplexity: parsed.estimatedComplexity,
        suggestedApproach: parsed.suggestedApproach,
        stages: parsed.stages,
      };
    } catch (error) {
      this.logger.error('Failed to parse workflow spec', { error, response });
      throw new Error('Failed to parse workflow specification from Claude response');
    }
  }

  /**
   * Write results to Notion stage pages
   */
  private async writeResultsToNotion(workflowSpec: WorkflowSpec): Promise<void> {
    if (!this.config.workflowId) {
      throw new Error('Workflow ID is required');
    }

    this.logger.info('Writing workflow spec to Notion', {
      workflowId: this.config.workflowId,
      complexity: workflowSpec.estimatedComplexity,
    });

    // Create a stage page for the bootstrap results
    await this.notionService.createStagePage({
      workflowId: this.config.workflowId,
      stage: 'bootstrapper',
      content: JSON.stringify(workflowSpec, null, 2),
    });

    // Update workflow status to planning
    await this.notionService.updateWorkflowStatus(this.config.workflowId, 'planning');

    this.logger.info('Bootstrap stage complete, workflow moved to planning');
  }
}
