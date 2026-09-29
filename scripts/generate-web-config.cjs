const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
};

const output = `window.VERYFY_CONFIG = ${JSON.stringify(config)};\n`;
fs.writeFileSync(path.join(process.cwd(), 'vercel-config.js'), output, 'utf8');
console.log(`VeryFY web configuration generated. Supabase configured: ${Boolean(config.supabaseUrl && config.supabaseAnonKey)}`);
