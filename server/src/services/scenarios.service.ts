// ============================================
// Scenarios Service
// ============================================

import db from '../db/index.js';
import { Scenario } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';

// ============================================
// Scenario Operations
// ============================================

export async function getAllScenarios(): Promise<Scenario[]> {
  const result = await db.query(
    `SELECT id, name, description, objection, client_persona, 
            first_message, voice_type, difficulty, display_order
     FROM scenarios 
     WHERE is_active = true 
     ORDER BY display_order ASC`
  );
  
  return result.rows.map(mapRowToScenario);
}

export async function getScenarioById(id: string): Promise<Scenario> {
  const result = await db.query(
    `SELECT * FROM scenarios WHERE id = $1 AND is_active = true`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Scenario not found');
  }

  return mapRowToScenario(result.rows[0]);
}

export async function getScenarioForConversation(id: string): Promise<{
  clientPersona: string;
  firstMessage?: string;
  voiceType?: string;
} | null> {
  const result = await db.query(
    'SELECT client_persona, first_message, voice_type FROM scenarios WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    clientPersona: row.client_persona,
    firstMessage: row.first_message,
    voiceType: row.voice_type,
  };
}

// ============================================
// Helper Functions
// ============================================

function mapRowToScenario(row: Record<string, unknown>): Scenario {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    objection: row.objection as string,
    clientPersona: row.client_persona as string,
    firstMessage: row.first_message as string | undefined,
    voiceType: row.voice_type as 'male' | 'female',
    difficulty: row.difficulty as 'easy' | 'medium' | 'hard',
    scriptContent: row.script_content as Record<string, unknown> | undefined,
    displayOrder: row.display_order as number,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as Date,
  };
}
