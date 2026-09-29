const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

class SupabaseService {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    this.configured = Boolean(url && key);
    this.client = this.configured ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }) : null;
  }

  status() {
    return {
      configured: this.configured,
      provider: 'Supabase',
      message: this.configured ? 'Cloud storage is configured.' : 'Add Supabase credentials to .env to enable cloud storage.',
    };
  }

  async saveInspection(inspection) {
    if (!this.client) return { ok: false, configured: false, reason: 'Supabase is not configured.' };

    const payload = {
      device_model: inspection.deviceModel,
      serial_last4: inspection.serialLast4,
      ios_version: inspection.iosVersion,
      battery_health: inspection.batteryHealth,
      cycle_count: inspection.cycleCount,
      condition_score: inspection.conditionScore,
      parts_summary: inspection.partsSummary || {},
      test_summary: inspection.testSummary || {},
      report_text: inspection.reportText || null,
    };

    const { data, error } = await this.client
      .from('inspections')
      .insert(payload)
      .select('id, created_at')
      .single();

    if (error) return { ok: false, configured: true, error: error.message };
    return { ok: true, configured: true, inspection: data };
  }

  async listInspections(limit = 20) {
    if (!this.client) return { ok: false, configured: false, inspections: [] };
    const { data, error } = await this.client
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, configured: true, inspections: [], error: error.message };
    return { ok: true, configured: true, inspections: data || [] };
  }
}

module.exports = { SupabaseService };
