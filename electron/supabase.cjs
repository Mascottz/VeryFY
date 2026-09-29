const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

class SupabaseService {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    this.configured = Boolean(url && key);
    this.session = null;
    this.authListeners = new Set();
    this.client = this.configured ? createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        transport: WebSocket,
      },
    }) : null;

    if (this.client) {
      this.client.auth.onAuthStateChange((_event, session) => {
        this.session = session;
        this.authListeners.forEach((listener) => listener(this.authStatus()));
      });
    }
  }

  authStatus() {
    return {
      configured: this.configured,
      signedIn: Boolean(this.session?.user),
      email: this.session?.user?.email || null,
    };
  }

  status() {
    return {
      ...this.authStatus(),
      provider: 'Supabase',
      message: this.configured ? 'Cloud storage is configured.' : 'Add Supabase credentials to .env to enable cloud storage.',
    };
  }

  onAuthStateChange(listener) {
    this.authListeners.add(listener);
    return () => this.authListeners.delete(listener);
  }

  async signIn(email, password) {
    if (!this.client) return { ok: false, configured: false, error: 'Supabase is not configured.' };
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, configured: true, error: error.message };
    this.session = data.session;
    return { ok: true, configured: true, auth: this.authStatus() };
  }

  async signOut() {
    if (!this.client) return { ok: false, configured: false, error: 'Supabase is not configured.' };
    const { error } = await this.client.auth.signOut();
    if (error) return { ok: false, configured: true, error: error.message };
    this.session = null;
    return { ok: true, configured: true, auth: this.authStatus() };
  }

  async saveInspection(inspection) {
    if (!this.client) return { ok: false, configured: false, reason: 'Supabase is not configured.' };
    if (!this.session?.user) return { ok: false, configured: true, authenticated: false, reason: 'Sign in before saving inspections.' };

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

    if (error) return { ok: false, configured: true, authenticated: true, error: error.message };
    return { ok: true, configured: true, authenticated: true, inspection: data };
  }

  async listInspections(limit = 20) {
    if (!this.client) return { ok: false, configured: false, inspections: [] };
    if (!this.session?.user) return { ok: false, configured: true, authenticated: false, inspections: [], reason: 'Sign in before loading inspection history.' };
    const { data, error } = await this.client
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, configured: true, authenticated: true, inspections: [], error: error.message };
    return { ok: true, configured: true, authenticated: true, inspections: data || [] };
  }
}

module.exports = { SupabaseService };
