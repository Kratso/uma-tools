/**
 * UmaExtractor Data Decoder
 *
 * Converts UmaExtractor's JSON output format to the internal DecodedUma format
 * used by the umalator simulator.
 *
 * UmaExtractor outputs data from the game's Veteran List, which is then converted
 * to a format compatible with this simulator.
 */

import { DecodedUma } from './rosterDecoder';

/**
 * UmaExtractor output format
 * Represents a single trained character from the game
 */
interface UmaExtractorCharacter {
    trained_chara_id: number;
    card_id: number;
    talent_level: number;
    rank_score?: number;
    speed: number;
    stamina: number;
    power: number;
    wiz: number;  // wisdom/intelligence
    guts: number;
    proper_distance_short: number;  // 1-8
    proper_distance_mile: number;
    proper_distance_middle: number;
    proper_distance_long: number;
    proper_ground_turf: number;  // 1-8
    proper_ground_dirt: number;
    proper_running_style_nige: number;  // front runner (逃げ)
    proper_running_style_senko: number;  // pace chaser (先行)
    proper_running_style_sashi: number;   // late surger (差し)
    proper_running_style_oikomi: number;  // end closer (追込)
    factor_id_array?: number[];
    win_saddle_id_array?: number[];
    skill_array?: Array<{ skill_id?: number; id?: number; playing_level?: number; level?: number; [key: string]: any }>;
    succession_chara_array?: UmaExtractorCharacter[];
    [key: string]: any;  // allow other fields
}

/**
 * Convert a single UmaExtractor character to internal DecodedUma format
 */
function convertUmaExtractorCharacter(char: UmaExtractorCharacter): DecodedUma {
    return {
        card_id: char.card_id,
        talent_level: char.talent_level || 1,
        rank_score: char.rank_score,
        speed: char.speed ?? 0,
        stamina: char.stamina ?? 0,
        power: char.power ?? 0,
        guts: char.guts ?? 0,
        wisdom: char.wiz ?? 0,  // Map 'wiz' field to 'wisdom'
        apt_short: char.proper_distance_short ?? 1,
        apt_mile: char.proper_distance_mile ?? 1,
        apt_middle: char.proper_distance_middle ?? 1,
        apt_long: char.proper_distance_long ?? 1,
        apt_turf: char.proper_ground_turf ?? 1,
        apt_dirt: char.proper_ground_dirt ?? 1,
        apt_nige: char.proper_running_style_nige ?? 1,
        apt_senko: char.proper_running_style_senko ?? 1,
        apt_sashi: char.proper_running_style_sashi ?? 1,
        apt_oikomi: char.proper_running_style_oikomi ?? 1,
        skills: (char.skill_array ?? []).map((s: any) => ({
            id: Number(s.skill_id ?? s.id ?? 0),
            level: Number(s.playing_level ?? s.level ?? 1),
        })).filter(s => s.id > 0),
    };
}

/**
 * Parse UmaExtractor JSON data
 *
 * Handles multiple input formats:
 * 1. Array of characters (direct export)
 * 2. Object with array properties (wrapped export)
 * 3. Single character wrapped in an object
 */
function parseUmaExtractorJson(json: any): UmaExtractorCharacter[] {
    if (!json) return [];

    // If it's already an array, assume it's the character list
    if (Array.isArray(json)) {
        return json.filter((item) => item && typeof item === 'object' && 'card_id' in item);
    }

    // If it's an object, look for array properties that contain characters
    if (typeof json === 'object') {
        // Try common property names that might contain the character data
        for (const key of ['trainedCharas', 'trained_charas', 'characters', 'umas', 'data', 'result']) {
            if (Array.isArray(json[key])) {
                const items = json[key].filter((item: any) => item && typeof item === 'object' && 'card_id' in item);
                if (items.length > 0) {
                    return items;
                }
            }
        }

        // Check if the object itself looks like a single character
        if ('card_id' in json) {
            return [json];
        }

        // Last resort: try to find any array of objects with card_id
        for (const value of Object.values(json)) {
            if (Array.isArray(value)) {
                const items = value.filter((item: any) => item && typeof item === 'object' && 'card_id' in item);
                if (items.length > 0) {
                    return items;
                }
            }
        }
    }

    return [];
}

/**
 * Import UmaExtractor data from file
 *
 * Handles direct file uploads of data.json from UmaExtractor
 */
export async function importUmaExtractorFile(file: File): Promise<DecodedUma[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const json = JSON.parse(text);
                const characters = parseUmaExtractorJson(json);

                if (characters.length === 0) {
                    reject(new Error('No valid character data found in the JSON file'));
                    return;
                }

                const decoded = characters.map(convertUmaExtractorCharacter);
                resolve(decoded);
            } catch (error) {
                reject(new Error(`Failed to parse UmaExtractor file: ${(error as Error).message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Import UmaExtractor data from JSON string (for paste-based import)
 */
export function importUmaExtractorJson(jsonString: string): DecodedUma[] {
    try {
        const json = JSON.parse(jsonString);
        const characters = parseUmaExtractorJson(json);

        if (characters.length === 0) {
            throw new Error('No valid character data found in the JSON data');
        }

        return characters.map(convertUmaExtractorCharacter);
    } catch (error) {
        throw new Error(`Failed to parse UmaExtractor data: ${(error as Error).message}`);
    }
}

/**
 * Detect if input looks like UmaExtractor data
 *
 * Returns true if the input appears to be UmaExtractor JSON rather than a roster.uma.guide link
 */
export function isUmaExtractorData(input: string): boolean {
    const trimmed = input.trim();

    // Check if it's a JSON-like string or file content
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return true;
    }

    // Check if it's a URL (roster.uma.guide format) - those start with http or have # for hash
    if (trimmed.startsWith('http') || trimmed.includes('#')) {
        return false;
    }

    // If it's text that looks like it could be JSON, try to parse it
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
}
