/**
 * Script to set up Notion databases for Code Diffusion
 * Usage: ts-node src/scripts/setup-notion-databases.ts <parent_page_id>
 */

import { config } from 'dotenv';
import { NotionService } from '../services/notion.service';

config();

async function main(): Promise<void> {
  const apiKey = process.env['NOTION_API_KEY'];
  const parentPageId = process.argv[2];

  if (!apiKey) {
    console.error('Error: NOTION_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!parentPageId) {
    console.error('Error: Parent page ID is required as argument');
    console.error('Usage: ts-node src/scripts/setup-notion-databases.ts <parent_page_id>');
    process.exit(1);
  }

  console.log('Setting up Notion databases...');

  const notionService = new NotionService(apiKey);

  try {
    const databases = await notionService.createAllDatabases(parentPageId);

    console.log('\n✓ Databases created successfully!');
    console.log('\nDatabase IDs:');
    console.log(`  Workflows DB: ${databases.workflowsDb.id}`);
    console.log(`  Stage Pages DB: ${databases.stagePagesDb.id}`);
    console.log(`  Subagent Tasks DB: ${databases.subagentTasksDb.id}`);
    console.log('\nSave these IDs in your .env file:');
    console.log(`NOTION_WORKFLOWS_DB_ID=${databases.workflowsDb.id}`);
    console.log(`NOTION_STAGE_PAGES_DB_ID=${databases.stagePagesDb.id}`);
    console.log(`NOTION_SUBAGENT_TASKS_DB_ID=${databases.subagentTasksDb.id}`);
  } catch (error) {
    console.error('Error creating databases:', error);
    process.exit(1);
  }
}

main().catch(console.error);
