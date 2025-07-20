const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) throw error;
    console.log('Connect to Supabase successfully');
  } catch (error) {
    console.error('Connect to Supabase failed', error.message);
  }
};
testConnection();

module.exports = supabase;
