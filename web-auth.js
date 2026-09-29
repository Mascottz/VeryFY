(() => {
  const config = window.VERYFY_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;

  import('https://esm.sh/@supabase/supabase-js@2')
    .then(({ createClient }) => {
      const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });

      const authState = { configured: true, signedIn: false, email: null };
      const notify = () => window.dispatchEvent(new CustomEvent('veryfy:web-auth', { detail: { ...authState } }));
      const syncSession = (session) => {
        authState.signedIn = Boolean(session?.user);
        authState.email = session?.user?.email || null;
        notify();
      };

      client.auth.getSession().then(({ data }) => syncSession(data.session));
      client.auth.onAuthStateChange((_event, session) => syncSession(session));

      window.veryfyWeb = {
        isWeb: true,
        async getCloudStatus() {
          return { ...authState, provider: 'Supabase', message: 'Cloud storage is configured.' };
        },
        async getAuthStatus() {
          return { ...authState };
        },
        onAuthState(callback) {
          const listener = (event) => callback(event.detail);
          window.addEventListener('veryfy:web-auth', listener);
          return () => window.removeEventListener('veryfy:web-auth', listener);
        },
        async signIn(email, password) {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) return { ok: false, configured: true, error: error.message };
          syncSession(data.session);
          return { ok: true, configured: true, auth: { ...authState } };
        },
        async signOut() {
          const { error } = await client.auth.signOut();
          if (error) return { ok: false, configured: true, error: error.message };
          syncSession(null);
          return { ok: true, configured: true, auth: { ...authState } };
        },
        async saveInspection(inspection) {
          if (!authState.signedIn) return { ok: false, configured: true, authenticated: false, reason: 'Sign in before saving inspections.' };
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
          const { data, error } = await client.from('inspections').insert(payload).select('id, created_at').single();
          if (error) return { ok: false, configured: true, authenticated: true, error: error.message };
          return { ok: true, configured: true, authenticated: true, inspection: data };
        },
        async listInspections() {
          if (!authState.signedIn) return { ok: false, configured: true, authenticated: false, inspections: [] };
          const { data, error } = await client.from('inspections').select('*').order('created_at', { ascending: false }).limit(20);
          if (error) return { ok: false, configured: true, authenticated: true, inspections: [], error: error.message };
          return { ok: true, configured: true, authenticated: true, inspections: data || [] };
        },
      };
      window.dispatchEvent(new CustomEvent('veryfy:web-ready'));
    })
    .catch((error) => {
      window.dispatchEvent(new CustomEvent('veryfy:web-error', { detail: error.message }));
    });
})();
